/**
 * ReschedulePage — public client-facing page.
 * Clients arrive here from a link like /reschedule/<token> sent in
 * their confirmation email. They see their current booking, the applicable
 * policy rules, and can pick a new slot or cancel (with refund info).
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useBookingStore } from '../store/bookingStore';
import type { Booking, TimeSlot } from '../types';
import { Spinner } from '../components/ui/Spinner';
import {
  checkRescheduleEligibility,
  checkCancellationEligibility,
  getPolicySummaryLines,
} from '../services/policyService';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.DEV;

export function ReschedulePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const {
    bookings,
    slots,
    fetchBookings,
    fetchSlots,
    rescheduleBooking,
    updateBookingStatus,
    policy,
  } = useBookingStore();

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Cancel flow state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);

  /* ── Validate token & load booking ─────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        await fetchBookings();
        if (USE_MOCK && token) {
          // Decode mock token: base64(bookingId:timestamp)
          const decoded = atob(token.padEnd(token.length + ((4 - (token.length % 4)) % 4), '='));
          const bookingId = decoded.split(':')[0];
          const found = bookings.find((b) => b.id === bookingId) ?? null;
          if (!found) throw new Error('Booking not found or this link has already been used.');
          if (found.status === 'cancelled') throw new Error('This booking has been cancelled.');
          setBooking(found);
          setDate(found.slot?.date ?? format(new Date(), 'yyyy-MM-dd'));
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /* ── Load slots when date changes ──────────────────────────────────────── */
  useEffect(() => {
    if (date) fetchSlots(date);
  }, [date, fetchSlots]);

  const availableSlots: TimeSlot[] = slots.filter(
    (s) => s.date === date && s.available && s.id !== booking?.slotId,
  );

  // Policy eligibility — recomputed whenever booking or policy changes
  const rescheduleCheck = useMemo(
    () => (booking ? checkRescheduleEligibility(booking, policy) : null),
    [booking, policy],
  );
  const cancelCheck = useMemo(
    () => (booking ? checkCancellationEligibility(booking, policy) : null),
    [booking, policy],
  );
  const policySummary = useMemo(() => getPolicySummaryLines(policy), [policy]);

  /* ── Handlers ───────────────────────────────────────────────────────────── */
  const handleReschedule = async () => {
    if (!booking || !selectedSlotId) return;
    setSubmitting(true);
    try {
      await rescheduleBooking(booking.id, selectedSlotId);
      setDone(true);
      toast.success('Your appointment has been rescheduled!');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!booking) return;
    setCancelSubmitting(true);
    try {
      await updateBookingStatus(booking.id, 'cancelled');
      setCancelDone(true);
      toast.success('Your booking has been cancelled.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCancelSubmitting(false);
      setShowCancelConfirm(false);
    }
  };

  /* ── Full-screen states ─────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center">
        <span className="text-5xl">⚠️</span>
        <h1 className="text-xl font-semibold text-gray-800">Link expired or invalid</h1>
        <p className="max-w-sm text-sm text-gray-500">{error}</p>
        <a href="/" className="text-sm font-medium text-sky-600 hover:underline">
          Return to booking site
        </a>
      </div>
    );
  }

  if (cancelDone) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center">
        <span className="text-5xl">✅</span>
        <h1 className="text-2xl font-bold text-gray-900">Booking Cancelled</h1>
        <p className="max-w-sm text-sm text-gray-600">
          Your appointment has been cancelled.
          {cancelCheck?.refundPct !== undefined && cancelCheck.refundPct > 0 && (
            <> You will receive a <strong>{cancelCheck.refundPct}% refund</strong> ({cancelCheck.refundLabel}) to your original payment method.</>
          )}
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
        >
          Back to home
        </button>
      </div>
    );
  }

  if (done) {
    const newSlot = slots.find((s) => s.id === selectedSlotId);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center">
        <span className="text-6xl">🎉</span>
        <h1 className="text-2xl font-bold text-gray-900">All set!</h1>
        <p className="max-w-sm text-sm text-gray-600">
          Your appointment has been rescheduled to{' '}
          <strong>
            {newSlot
              ? `${format(parseISO(newSlot.date), 'MMMM d, yyyy')} at ${newSlot.startTime}`
              : 'your new time'}
          </strong>
          . A confirmation will be sent to your email.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
        >
          Back to home
        </button>
      </div>
    );
  }

  const inputCls =
    'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm ' +
    'focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <span className="text-4xl">📆</span>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Manage Your Appointment</h1>
          <p className="mt-1 text-sm text-gray-500">
            Hi {booking?.user?.name?.split(' ')[0] ?? 'there'} — reschedule or cancel your booking below.
          </p>
        </div>

        <div className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          {/* ── Current booking summary ──────────────────────────────────── */}
          {booking && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm">
              <p className="font-semibold text-amber-800">Your current appointment</p>
              <p className="mt-0.5 text-amber-700">
                {booking.service?.name}
                {booking.slot && (
                  <> · {format(parseISO(booking.slot.date), 'EEEE, MMMM d')} at {booking.slot.startTime}</>
                )}
              </p>
              {(booking.rescheduleCount ?? 0) > 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  Rescheduled {booking.rescheduleCount} time{booking.rescheduleCount !== 1 ? 's' : ''}
                  {policy.maxReschedules > 0
                    ? ` (${policy.maxReschedules - (booking.rescheduleCount ?? 0)} remaining)`
                    : ''}
                </p>
              )}
            </div>
          )}

          {/* ── Policy rules banner ──────────────────────────────────────── */}
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">📋 Booking Policy</p>
            <ul className="space-y-0.5">
              {policySummary.map((line, i) => (
                <li key={i} className="text-xs text-gray-600 leading-relaxed">{line}</li>
              ))}
            </ul>
          </div>

          {/* ── RESCHEDULE SECTION ───────────────────────────────────────── */}
          {rescheduleCheck && !rescheduleCheck.eligible ? (
            /* Rescheduling blocked */
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-4 text-sm">
              <p className="font-semibold text-red-800">Rescheduling unavailable</p>
              <p className="mt-1 text-red-700">{rescheduleCheck.reason}</p>
            </div>
          ) : (
            <>
              {/* Reschedule warning (e.g. last reschedule remaining) */}
              {rescheduleCheck?.warning && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
                  ⚠️ {rescheduleCheck.warning}
                </div>
              )}

              {/* Date picker */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Choose a new date</label>
                <input
                  type="date"
                  value={date}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  onChange={(e) => { setDate(e.target.value); setSelectedSlotId(''); }}
                  className={inputCls}
                />
              </div>

              {/* Slot picker */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Available times on {date ? format(parseISO(date), 'MMMM d, yyyy') : ''}
                </label>
                {availableSlots.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-400">
                    No available slots on this date. Try another day.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {availableSlots.map((s) => {
                      const spotsLeft = s.capacity - s.booked;
                      const isSelected = selectedSlotId === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedSlotId(s.id)}
                          className={`rounded-xl border-2 px-3 py-3 text-center text-sm transition-all ${
                            isSelected
                              ? 'border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-200'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-sky-300'
                          }`}
                        >
                          <div className="font-semibold">{s.startTime}</div>
                          <div className={`mt-1 text-xs ${spotsLeft <= 1 ? 'text-red-500' : 'text-gray-400'}`}>
                            {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Submit reschedule */}
              <button
                type="button"
                onClick={handleReschedule}
                disabled={!selectedSlotId || submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving…
                  </>
                ) : (
                  'Confirm New Appointment'
                )}
              </button>
            </>
          )}

          {/* ── CANCEL SECTION ───────────────────────────────────────────── */}
          {cancelCheck && (
            <div className="border-t border-gray-100 pt-4">
              {cancelCheck.eligible ? (
                <>
                  {cancelCheck.warning && (
                    <p className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      ⚠️ {cancelCheck.warning}
                    </p>
                  )}
                  {!cancelCheck.warning && cancelCheck.refundPct === 100 && (
                    <p className="mb-3 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      ✅ You qualify for a <strong>full refund</strong> if you cancel now.
                    </p>
                  )}

                  {!showCancelConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(true)}
                      className="w-full rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:border-red-300 hover:text-red-600 transition-colors"
                    >
                      Cancel this appointment
                    </button>
                  ) : (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                      <p className="text-sm font-semibold text-red-800">Confirm cancellation</p>
                      <p className="text-sm text-red-700">
                        Are you sure you want to cancel?
                        {cancelCheck.refundPct !== undefined && (
                          <> You will receive a <strong>{cancelCheck.refundPct}%</strong> refund ({cancelCheck.refundLabel}).</>
                        )}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowCancelConfirm(false)}
                          className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Keep appointment
                        </button>
                        <button
                          type="button"
                          onClick={handleCancel}
                          disabled={cancelSubmitting}
                          className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          {cancelSubmitting ? 'Cancelling…' : 'Yes, cancel'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-500">
                  <p className="font-medium text-gray-700">Cancellation unavailable</p>
                  <p className="mt-0.5">{cancelCheck.reason}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Need help? Contact us at support@bookease.com
        </p>
      </div>
    </div>
  );
}
