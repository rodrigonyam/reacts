import { useEffect, useState } from 'react';
import { useBookingStore } from '../../store/bookingStore';
import { StatusBadge } from '../ui/StatusBadge';
import { Spinner } from '../ui/Spinner';
import { Modal } from '../ui/Modal';
import { BookingForm } from '../forms/BookingForm';
import type { BookingStatus } from '../../types';

const STATUS_FILTERS: (BookingStatus | 'all')[] = ['all', 'pending', 'confirmed', 'completed', 'cancelled'];

export function BookingsList() {
  const { bookings, slots, services, loading, fetchBookings, fetchSlots, fetchServices, updateBookingStatus, removeBooking } =
    useBookingStore();
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchBookings();
    fetchSlots();
    fetchServices();
  }, [fetchBookings, fetchSlots, fetchServices]);

  const filtered = bookings.filter((b) => {
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      b.user?.name.toLowerCase().includes(q) ||
      b.user?.email.toLowerCase().includes(q) ||
      b.service?.name.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Bookings</h1>
          <p className="mt-1 text-sm text-gray-500">{bookings.length} total bookings</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 transition-colors"
        >
          <span className="text-lg leading-none">+</span> New Booking
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Search by name, email, service…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                statusFilter === s
                  ? 'bg-sky-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16"><Spinner /></div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-6 py-3 text-left">Client</th>
                  <th className="px-6 py-3 text-left">Service</th>
                  <th className="px-6 py-3 text-left">Date</th>
                  <th className="px-6 py-3 text-left">Time</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{b.user?.name ?? '—'}</p>
                      <p className="text-xs text-gray-500">{b.user?.email}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{b.service?.name ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{b.slot?.date ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {b.slot ? `${b.slot.startTime}–${b.slot.endTime}` : '—'}
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={b.status} /></td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex gap-1">
                        {b.status === 'pending' && (
                          <button
                            onClick={() => updateBookingStatus(b.id, 'confirmed')}
                            className="rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                          >Confirm</button>
                        )}
                        {(b.status === 'confirmed' || b.status === 'pending') && (
                          <button
                            onClick={() => updateBookingStatus(b.id, 'completed')}
                            className="rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                          >Complete</button>
                        )}
                        {b.status !== 'cancelled' && (
                          <button
                            onClick={() => updateBookingStatus(b.id, 'cancelled')}
                            className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >Cancel</button>
                        )}
                        <button
                          onClick={() => { if (window.confirm('Delete this booking?')) removeBooking(b.id); }}
                          className="rounded px-2 py-1 text-xs font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">
                      No bookings match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <Modal title="New Booking" onClose={() => setShowForm(false)}>
          <BookingForm
            services={services}
            slots={slots}
            onSuccess={() => { setShowForm(false); fetchBookings(); }}
            onCancel={() => setShowForm(false)}
          />
        </Modal>
      )}
    </div>
  );
}
