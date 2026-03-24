/**
 * RescheduleModal — lets an admin pick a new time slot for an existing booking.
 * Shows policy rules, eligibility status, and an admin override option.
 */
import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { Modal } from '../ui/Modal';
import { useBookingStore } from '../../store/bookingStore';
import type { Booking, TimeSlot } from '../../types';
import { checkRescheduleEligibility } from '../../services/policyService';

interface RescheduleModalProps {
  booking: Booking;
  onClose: () => void;
}

export function RescheduleModal({ booking, onClose }: RescheduleModalProps) {
  const { slots, fetchSlots, rescheduleBooking, policy } = useBookingStore();
  const [date, setDate] = useState(booking.slot?.date ?? format(new Date(), 'yyyy-MM-dd'));
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [adminOverride, setAdminOverride] = useState(false);

  useEffect(() => {
    fetchSlots(date);
  }, [date, fetchSlots]);

  const availableSlots: TimeSlot[] = slots.filter(
    (s) => s.date === date && s.available && s.id !== booking.slotId,
  );

  const eligibility = useMemo(
    () => checkRescheduleEligibility(booking, policy),
    [booking, policy],
  );

  const canReschedule = eligibility.eligible || (policy.adminCanOverride && adminOverride);

  const handleReschedule = async () => {
    if (!selectedSlotId) { toast.error('Please select a new time slot.'); return; }
    setSubmitting(true);
    try {
      await rescheduleBooking(booking.id, selectedSlotId);
      toast.success('Booking rescheduled successfully!');
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm ' +
    'focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';

  return (
    <Modal title="Reschedule Booking" onClose={onClose}>
      <div className="space-y-5">
        {/* Current booking info */}
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm">
          <p className="font-medium text-amber-800">Current appointment</p>
          <p className="text-amber-700 mt-0.5">
            {booking.user?.name} · {booking.service?.name}
            {booking.slot && (
              <> · {format(parseISO(booking.slot.date), 'MMM d, yyyy')} at {booking.slot.startTime}</>
            )}
          </p>
          {(booking.rescheduleCount ?? 0) > 0 && (
            <p className="mt-1 text-xs text-amber-600">
              Rescheduled {booking.rescheduleCount} time{booking.rescheduleCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Policy info banner */}
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-2.5 text-xs text-gray-600 space-y-0.5">
          <p className="font-semibold text-gray-500 uppercase tracking-wide text-xs mb-1">📋 Policy</p>
          {policy.rescheduleEnabled ? (
            <>
              <p>Max reschedules: {policy.maxReschedules === 0 ? 'Unlimited' : policy.maxReschedules}</p>
              <p>Notice required: {policy.rescheduleNoticeHours}h before appointment</p>
            </>
          ) : (
            <p>Rescheduling is disabled by policy.</p>
          )}
        </div>

        {/* Policy eligibility alert */}
        {!eligibility.eligible && (
          <div className={`rounded-lg px-4 py-3 text-sm ${policy.adminCanOverride ? 'bg-yellow-50 border border-yellow-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`font-semibold ${policy.adminCanOverride ? 'text-yellow-800' : 'text-red-800'}`}>
              {policy.adminCanOverride ? '⚠️ Policy violation' : '🚫 Cannot reschedule'}
            </p>
            <p className={`mt-0.5 text-xs ${policy.adminCanOverride ? 'text-yellow-700' : 'text-red-700'}`}>
              {eligibility.reason}
            </p>
            {policy.adminCanOverride && (
              <label className="mt-2 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={adminOverride}
                  onChange={(e) => setAdminOverride(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-yellow-400 text-yellow-600"
                />
                <span className="text-xs font-medium text-yellow-700">Override policy (admin)</span>
              </label>
            )}
          </div>
        )}

        {/* Eligibility warning (still eligible but close to limit) */}
        {eligibility.eligible && eligibility.warning && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-2.5 text-xs text-yellow-800">
            ⚠️ {eligibility.warning}
          </div>
        )}

        {/* Date picker */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">New date</label>
          <input
            type="date"
            value={date}
            min={format(new Date(), 'yyyy-MM-dd')}
            onChange={(e) => { setDate(e.target.value); setSelectedSlotId(''); }}
            className={inputCls}
          />
        </div>

        {/* Available slots */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Available time slots on {date ? format(parseISO(date), 'MMMM d, yyyy') : ''}
          </label>
          {availableSlots.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 py-6 text-center text-sm text-gray-400">
              No available slots on this date.
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
                    className={`rounded-lg border px-3 py-2.5 text-center text-xs font-medium transition-colors ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50 text-sky-700 ring-1 ring-sky-500'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-sky-300 hover:bg-sky-50'
                    }`}
                  >
                    <div className="font-semibold">{s.startTime}</div>
                    <div className={`mt-0.5 ${spotsLeft <= 1 ? 'text-red-500' : 'text-gray-400'}`}>
                      {spotsLeft} left
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleReschedule}
            disabled={!selectedSlotId || submitting || !canReschedule}
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving…
              </>
            ) : (
              'Confirm Reschedule'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
