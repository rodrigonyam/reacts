/**
 * ReschedulePage — public client-facing page.
 * Clients arrive here from a link like /reschedule/<token> that was sent in
 * their confirmation email. They see their current booking and can pick a new slot.
 *
 * In mock mode the token is decoded from base64 (bookingId:timestamp) and the
 * booking is looked up from the store. In production, the token is validated
 * server-side via rescheduleService.validateToken().
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useBookingStore } from '../store/bookingStore';
import type { Booking, TimeSlot } from '../types';
import { Spinner } from '../components/ui/Spinner';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.DEV;

export function ReschedulePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { bookings, slots, fetchBookings, fetchSlots, rescheduleBooking } = useBookingStore();

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

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
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Reschedule Your Appointment</h1>
          <p className="mt-1 text-sm text-gray-500">
            Hi {booking?.user?.name?.split(' ')[0] ?? 'there'}, pick a new time that works for you.
          </p>
        </div>

        <div className="space-y-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          {/* Current booking summary */}
          {booking && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm">
              <p className="font-semibold text-amber-800">Your current appointment</p>
              <p className="mt-0.5 text-amber-700">
                {booking.service?.name}
                {booking.slot && (
                  <> · {format(parseISO(booking.slot.date), 'EEEE, MMMM d')} at {booking.slot.startTime}</>
                )}
              </p>
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

          {/* Submit */}
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
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Need help? Contact us at support@bookease.com
        </p>
      </div>
    </div>
  );
}
