/**
 * Policy Service — defines and enforces rescheduling & cancellation rules.
 *
 * Rules are configured by the admin (stored in localStorage) and enforced
 * on both the client-facing ReschedulePage and the admin RescheduleModal.
 */
import type { Booking, BookingPolicy, PolicyCheckResult, RefundTier } from '../types';

export const POLICY_STORAGE_KEY = 'sos_booking_policy';

// ── Default policy ────────────────────────────────────────────────────────────

export const DEFAULT_POLICY: BookingPolicy = {
  rescheduleEnabled: true,
  maxReschedules: 2,
  rescheduleNoticeHours: 24,

  cancellationEnabled: true,
  cancellationNoticeHours: 12,

  refundTiers: [
    { hoursBeforeAppointment: 48, refundPct: 100, label: 'Full refund' },
    { hoursBeforeAppointment: 24, refundPct: 50,  label: '50% refund' },
    { hoursBeforeAppointment: 0,  refundPct: 0,   label: 'No refund'  },
  ],

  adminCanOverride: true,
};

// ── Persistence ───────────────────────────────────────────────────────────────

export function loadPolicy(): BookingPolicy {
  try {
    const raw = localStorage.getItem(POLICY_STORAGE_KEY);
    if (raw) return { ...DEFAULT_POLICY, ...JSON.parse(raw) } as BookingPolicy;
  } catch {
    // ignore corrupt data
  }
  return DEFAULT_POLICY;
}

export function savePolicy(policy: BookingPolicy): void {
  localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(policy));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the number of hours between now and the appointment start.
 * Returns -1 if the appointment time cannot be determined.
 */
export function getHoursUntilAppointment(booking: Booking): number {
  if (!booking.slot) return -1;
  const { date, startTime } = booking.slot;
  const appointmentMs = new Date(`${date}T${startTime}:00`).getTime();
  const nowMs = Date.now();
  return (appointmentMs - nowMs) / (1000 * 60 * 60);
}

/**
 * Returns how far in the past an appointment is (positive = already past).
 */
export function isAppointmentPast(booking: Booking): boolean {
  return getHoursUntilAppointment(booking) < 0;
}

// ── Policy checks ─────────────────────────────────────────────────────────────

/**
 * Checks whether a booking is eligible to be rescheduled under the given policy.
 */
export function checkRescheduleEligibility(
  booking: Booking,
  policy: BookingPolicy,
): PolicyCheckResult {
  if (!policy.rescheduleEnabled) {
    return { eligible: false, reason: 'Rescheduling is not available for this service.' };
  }

  if (isAppointmentPast(booking)) {
    return { eligible: false, reason: 'This appointment has already passed.' };
  }

  const rescheduleCount = booking.rescheduleCount ?? 0;
  if (policy.maxReschedules > 0 && rescheduleCount >= policy.maxReschedules) {
    return {
      eligible: false,
      reason: `You have reached the maximum of ${policy.maxReschedules} reschedule${policy.maxReschedules !== 1 ? 's' : ''} for this booking.`,
    };
  }

  const hoursLeft = getHoursUntilAppointment(booking);
  if (policy.rescheduleNoticeHours > 0 && hoursLeft < policy.rescheduleNoticeHours) {
    return {
      eligible: false,
      reason: `Rescheduling must be done at least ${policy.rescheduleNoticeHours} hour${policy.rescheduleNoticeHours !== 1 ? 's' : ''} before the appointment. Your appointment is in ${Math.max(0, Math.floor(hoursLeft))} hour${Math.floor(hoursLeft) !== 1 ? 's' : ''}.`,
    };
  }

  const remaining = policy.maxReschedules > 0
    ? policy.maxReschedules - rescheduleCount
    : null;

  return {
    eligible: true,
    warning: remaining !== null && remaining <= 1
      ? `You have ${remaining} reschedule remaining for this booking.`
      : undefined,
  };
}

/**
 * Checks whether a booking is eligible to be cancelled under the given policy,
 * and returns which refund tier applies.
 */
export function checkCancellationEligibility(
  booking: Booking,
  policy: BookingPolicy,
): PolicyCheckResult {
  if (!policy.cancellationEnabled) {
    return { eligible: false, reason: 'Cancellations are not available for this service.' };
  }

  if (isAppointmentPast(booking)) {
    return { eligible: false, reason: 'This appointment has already passed.' };
  }

  const hoursLeft = getHoursUntilAppointment(booking);
  if (policy.cancellationNoticeHours > 0 && hoursLeft < policy.cancellationNoticeHours) {
    return {
      eligible: false,
      reason: `Cancellations must be made at least ${policy.cancellationNoticeHours} hour${policy.cancellationNoticeHours !== 1 ? 's' : ''} before the appointment.`,
    };
  }

  // Find the best matching refund tier
  const tier = getApplicableRefundTier(hoursLeft, policy.refundTiers);

  return {
    eligible: true,
    refundPct: tier?.refundPct ?? 0,
    refundLabel: tier?.label ?? 'No refund',
    warning:
      tier && tier.refundPct < 100
        ? `${tier.label} applies — you will receive ${tier.refundPct}% of your payment back.`
        : undefined,
  };
}

/**
 * Given the hours remaining until the appointment, returns the applicable refund tier.
 * Tiers are evaluated from most generous (highest hoursBeforeAppointment) down.
 */
export function getApplicableRefundTier(
  hoursLeft: number,
  tiers: RefundTier[],
): RefundTier | null {
  // Sort descending by hoursBeforeAppointment so most generous is evaluated first
  const sorted = [...tiers].sort((a, b) => b.hoursBeforeAppointment - a.hoursBeforeAppointment);
  for (const tier of sorted) {
    if (hoursLeft >= tier.hoursBeforeAppointment) return tier;
  }
  return sorted[sorted.length - 1] ?? null;
}

/**
 * Returns a short human-readable summary of the policy rules.
 */
export function getPolicySummaryLines(policy: BookingPolicy): string[] {
  const lines: string[] = [];

  if (policy.rescheduleEnabled) {
    const limit =
      policy.maxReschedules > 0
        ? `up to ${policy.maxReschedules} time${policy.maxReschedules !== 1 ? 's' : ''}`
        : 'unlimited times';
    const notice =
      policy.rescheduleNoticeHours > 0
        ? `, at least ${policy.rescheduleNoticeHours}h before appointment`
        : '';
    lines.push(`Rescheduling allowed ${limit}${notice}.`);
  } else {
    lines.push('Rescheduling is not allowed.');
  }

  if (policy.cancellationEnabled) {
    const notice =
      policy.cancellationNoticeHours > 0
        ? `at least ${policy.cancellationNoticeHours}h before`
        : 'anytime';
    lines.push(`Cancellations allowed ${notice}.`);
    if (policy.refundTiers.length > 0) {
      const sorted = [...policy.refundTiers].sort(
        (a, b) => b.hoursBeforeAppointment - a.hoursBeforeAppointment,
      );
      sorted.forEach((t) => {
        if (t.hoursBeforeAppointment > 0) {
          lines.push(`  • ${t.label} if cancelled ≥${t.hoursBeforeAppointment}h before.`);
        } else {
          lines.push(`  • ${t.label} if cancelled less than ${sorted[sorted.indexOf(t) - 1]?.hoursBeforeAppointment ?? '?'}h before.`);
        }
      });
    }
  } else {
    lines.push('Cancellations are not allowed.');
  }

  return lines;
}
