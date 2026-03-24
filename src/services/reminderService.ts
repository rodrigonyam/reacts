/**
 * Reminder service — schedules and tracks email/SMS reminders.
 * In mock mode reminders are stored in memory and shown in the UI.
 * In production they are created via /api/reminders on your backend,
 * which integrates with SendGrid (email) and Twilio (SMS).
 */
import api from './api';
import type { ScheduledReminder, ReminderConfig, ReminderTiming, ReminderChannel } from '../types';
import { addDays, addHours, addMinutes, addWeeks, subHours, subMinutes, subWeeks, parseISO } from 'date-fns';

export const reminderService = {
  /** Schedule reminders for a booking */
  schedule: async (bookingId: string, config: ReminderConfig): Promise<ScheduledReminder[]> => {
    const { data } = await api.post<ScheduledReminder[]>(`/reminders/${bookingId}`, config);
    return data;
  },

  /** Get all reminders for a booking */
  getForBooking: async (bookingId: string): Promise<ScheduledReminder[]> => {
    const { data } = await api.get<ScheduledReminder[]>(`/reminders/${bookingId}`);
    return data;
  },

  /** Cancel a specific reminder */
  cancel: async (reminderId: string): Promise<void> => {
    await api.delete(`/reminders/${reminderId}`);
  },

  /** Cancel all reminders for a booking (e.g. on cancellation) */
  cancelAll: async (bookingId: string): Promise<void> => {
    await api.delete(`/reminders/booking/${bookingId}`);
  },

  /** Resend (retry) a previously failed or upcoming reminder immediately */
  resend: async (reminderId: string): Promise<ScheduledReminder> => {
    const { data } = await api.post<ScheduledReminder>(`/reminders/${reminderId}/resend`);
    return data;
  },
};

// ── Mock reminder generation ──────────────────────────────────────────────────

function offsetFromTiming(appointmentTime: Date, timing: ReminderTiming): Date {
  switch (timing) {
    case '1week':  return addWeeks(appointmentTime, -1);
    case '24h':    return addHours(appointmentTime, -24);
    case '2h':     return addHours(appointmentTime, -2);
    case '30min':  return addMinutes(appointmentTime, -30);
  }
}

export function buildMockReminders(
  bookingId: string,
  appointmentIso: string,
  config: ReminderConfig,
): ScheduledReminder[] {
  const apptTime = parseISO(appointmentIso);
  const channels: Array<'email' | 'sms'> =
    config.channels === 'both' ? ['email', 'sms'] :
    config.channels === 'email' ? ['email'] : ['sms'];

  const reminders: ScheduledReminder[] = [];
  config.timings.forEach((timing) => {
    channels.forEach((channel) => {
      reminders.push({
        id: `rm-${Date.now()}-${timing}-${channel}`,
        bookingId,
        channel,
        timing,
        scheduledFor: offsetFromTiming(apptTime, timing).toISOString(),
        status: 'pending',
      });
    });
  });
  return reminders;
}

/** Human-readable label for a timing value */
export function timingLabel(timing: ReminderTiming): string {
  switch (timing) {
    case '1week':  return '1 week before';
    case '24h':    return '24 hours before';
    case '2h':     return '2 hours before';
    case '30min':  return '30 minutes before';
  }
}

/** Channel icon */
export function channelIcon(channel: ReminderChannel): string {
  switch (channel) {
    case 'email': return '✉️';
    case 'sms':   return '📱';
    case 'both':  return '✉️📱';
  }
}

// ── Mock: full reminder dataset across all demo bookings ─────────────────────

function apptDate(dayOffset: number, hour: number): Date {
  const d = addDays(new Date(), dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function makeReminder(
  id: string,
  bookingId: string,
  channel: 'email' | 'sms',
  timing: ReminderTiming,
  scheduledFor: Date,
  forceStatus?: ScheduledReminder['status'],
): ScheduledReminder {
  const isPast = scheduledFor < new Date();
  const status = forceStatus ?? (isPast ? 'sent' : 'pending');
  return {
    id,
    bookingId,
    channel,
    timing,
    scheduledFor: scheduledFor.toISOString(),
    sentAt: status === 'sent' ? scheduledFor.toISOString() : undefined,
    status,
  };
}

/**
 * Generates a realistic set of mock reminders for all demo bookings.
 * Statuses are derived dynamically from current time so the data
 * always looks correct regardless of when the app runs.
 */
export function buildMockAllReminders(): ScheduledReminder[] {
  // b1 — Alice / General Consultation  / today 9am  (confirmed)
  const b1 = apptDate(0, 9);
  // b2 — Bob   / Nutritional Counseling / today 2pm  (pending)
  const b2 = apptDate(0, 14);
  // b3 — Carol / Mental Wellness        / tomorrow 11am (confirmed)
  const b3 = apptDate(1, 11);
  // b4 — Alice / Physical Therapy       / today 10am (cancelled)
  const b4 = apptDate(0, 10);

  return [
    // b1: 1-week + 24h already in the past → 'sent'; 2h + 30min depend on time of day
    makeReminder('rm-001', 'b1', 'email', '1week',  subWeeks(b1, 1)),
    makeReminder('rm-002', 'b1', 'email', '24h',    subHours(b1, 24)),
    makeReminder('rm-003', 'b1', 'sms',   '2h',     subHours(b1, 2)),
    makeReminder('rm-004', 'b1', 'sms',   '30min',  subMinutes(b1, 30)),
    // b2
    makeReminder('rm-005', 'b2', 'email', '24h', subHours(b2, 24)),
    makeReminder('rm-006', 'b2', 'sms',   '2h',  subHours(b2, 2)),
    // b3: force 1-week to 'failed' to demonstrate at-risk alert
    makeReminder('rm-007', 'b3', 'email', '1week', subWeeks(b3, 1), 'failed'),
    makeReminder('rm-008', 'b3', 'email', '24h',   subHours(b3, 24)),
    makeReminder('rm-009', 'b3', 'sms',   '2h',    subHours(b3, 2)),
    // b4: one reminder was sent before it was cancelled
    makeReminder('rm-010', 'b4', 'email', '24h', subHours(b4, 24)),
  ];
}
