import { useEffect, useState } from 'react';
import type { SlotInfo } from 'react-big-calendar';
import { format } from 'date-fns';
import { useBookingStore } from '../../store/bookingStore';
import { BookingCalendar } from '../calendar/BookingCalendar';
import { BookingForm } from '../forms/BookingForm';
import { Modal } from '../ui/Modal';
import { StatusBadge } from '../ui/StatusBadge';
import { Spinner } from '../ui/Spinner';
import type { Booking, CalendarEvent } from '../../types';

export function Dashboard() {
  const { bookings, slots, services, externalEvents, loading, fetchBookings, fetchSlots, fetchServices, fetchExternalEvents, updateBookingStatus } =
    useBookingStore();

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [defaultDate, setDefaultDate] = useState('');

  useEffect(() => {
    fetchBookings();
    fetchSlots();
    fetchServices();
    fetchExternalEvents();
  }, [fetchBookings, fetchSlots, fetchServices, fetchExternalEvents]);

  // Stats
  const total = bookings.length;
  const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
  const pending = bookings.filter((b) => b.status === 'pending').length;
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayCount = bookings.filter((b) => b.slot?.date === today).length;

  const handleSlotSelect = (info: SlotInfo) => {
    setDefaultDate(format(info.start, 'yyyy-MM-dd'));
    setShowBookingModal(true);
  };

  const handleEventSelect = (event: CalendarEvent) => {
    setSelectedBooking(event.resource);
    setShowDetailModal(true);
  };

  const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className={`rounded-xl border bg-white p-5 shadow-sm`}>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <button
          onClick={() => { setDefaultDate(''); setShowBookingModal(true); }}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 transition-colors"
        >
          <span className="text-lg leading-none">+</span> New Booking
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Bookings" value={total} color="text-gray-900" />
        <StatCard label="Confirmed" value={confirmed} color="text-green-600" />
        <StatCard label="Pending" value={pending} color="text-amber-600" />
        <StatCard label="Today" value={todayCount} color="text-sky-600" />
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="py-16"><Spinner /></div>
      ) : (
        <BookingCalendar
          bookings={bookings}
          slots={slots}
          showAvailability={true}
          externalEvents={externalEvents}
          onSelectSlot={handleSlotSelect}
          onSelectEvent={handleEventSelect}
        />
      )}

      {/* Recent bookings table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Recent Bookings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-6 py-3 text-left">Name</th>
                <th className="px-6 py-3 text-left">Service</th>
                <th className="px-6 py-3 text-left">Date & Time</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bookings.slice(0, 10).map((b) => (
                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{b.user?.name ?? '—'}</td>
                  <td className="px-6 py-4 text-gray-600">{b.service?.name ?? '—'}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {b.slot ? `${b.slot.date} · ${b.slot.startTime}` : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex gap-2">
                      {b.status === 'pending' && (
                        <button
                          onClick={() => updateBookingStatus(b.id, 'confirmed')}
                          className="rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors"
                        >
                          Confirm
                        </button>
                      )}
                      {b.status !== 'cancelled' && b.status !== 'completed' && (
                        <button
                          onClick={() => updateBookingStatus(b.id, 'cancelled')}
                          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    No bookings yet. Click a calendar slot or "+ New Booking" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New booking modal */}
      {showBookingModal && (
        <Modal title="New Booking" onClose={() => setShowBookingModal(false)}>
          <BookingForm
            services={services}
            slots={slots}
            defaultDate={defaultDate}
            onSuccess={() => { setShowBookingModal(false); fetchBookings(); }}
            onCancel={() => setShowBookingModal(false)}
          />
        </Modal>
      )}

      {/* Booking detail modal */}
      {showDetailModal && selectedBooking && (
        <Modal title="Booking Details" onClose={() => setShowDetailModal(false)}>
          <BookingDetail
            booking={selectedBooking}
            onStatusChange={(status) => {
              updateBookingStatus(selectedBooking.id, status);
              setShowDetailModal(false);
            }}
            onClose={() => setShowDetailModal(false)}
          />
        </Modal>
      )}
    </div>
  );
}

// ── Inline detail panel ───────────────────────────────────────────────────────
function BookingDetail({
  booking,
  onStatusChange,
  onClose,
}: {
  booking: Booking;
  onStatusChange: (s: Booking['status']) => void;
  onClose: () => void;
}) {
  const rows: [string, string][] = [
    ['Name', booking.user?.name ?? '—'],
    ['Email', booking.user?.email ?? '—'],
    ['Phone', booking.user?.phone ?? '—'],
    ['Service', booking.service?.name ?? '—'],
    ['Date', booking.slot?.date ?? '—'],
    ['Time', booking.slot ? `${booking.slot.startTime} – ${booking.slot.endTime}` : '—'],
    ['Price', booking.service ? `$${booking.service.price}` : '—'],
    ['Notes', booking.notes ?? '—'],
    ['Created', new Date(booking.createdAt).toLocaleString()],
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <StatusBadge status={booking.status} />
        <span className="text-sm text-gray-500">ID: {booking.id}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="font-medium text-gray-500">{label}</dt>
            <dd className="mt-0.5 text-gray-900 break-all">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
        {booking.status === 'pending' && (
          <button
            onClick={() => onStatusChange('confirmed')}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
          >
            Confirm
          </button>
        )}
        {booking.status !== 'completed' && booking.status !== 'cancelled' && (
          <button
            onClick={() => onStatusChange('completed')}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Mark Complete
          </button>
        )}
        {booking.status !== 'cancelled' && (
          <button
            onClick={() => onStatusChange('cancelled')}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={onClose}
          className="ml-auto rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
