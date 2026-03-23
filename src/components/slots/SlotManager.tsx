import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useBookingStore } from '../../store/bookingStore';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { SlotForm } from '../forms/SlotForm';
import type { TimeSlot } from '../../types';

export function SlotManager() {
  const { slots, services, loading, fetchSlots, fetchServices, removeSlot } = useBookingStore();
  const [showForm, setShowForm] = useState(false);
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    fetchServices();
    fetchSlots(filterDate);
  }, [fetchServices, fetchSlots, filterDate]);

  const filtered = slots.filter((s) => !filterDate || s.date === filterDate);

  const handleDelete = async (slot: TimeSlot) => {
    if (slot.booked > 0) {
      toast.error('Cannot delete a slot with active bookings');
      return;
    }
    if (!window.confirm(`Delete slot ${slot.startTime}–${slot.endTime} on ${slot.date}?`)) return;
    await removeSlot(slot.id);
    toast.success('Slot deleted');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Slot Manager</h1>
          <p className="mt-1 text-sm text-gray-500">Manage available time slots for bookings</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 transition-colors"
        >
          <span className="text-lg leading-none">+</span> New Slot
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Filter by date:</label>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <button
          onClick={() => setFilterDate('')}
          className="text-sm text-sky-600 hover:underline"
        >
          Show all
        </button>
      </div>

      {/* Slot grid */}
      {loading ? (
        <div className="py-16"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <p className="text-gray-500">No slots found.{filterDate ? ' Try another date or clear the filter.' : ''}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((slot) => {
            const pct = (slot.booked / slot.capacity) * 100;
            const service = services.find((s) => s.id === slot.serviceId);
            return (
              <div
                key={slot.id}
                className={`relative rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
                  !slot.available ? 'border-red-200 opacity-70' : 'border-gray-200'
                }`}
              >
                {/* Date */}
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {format(parseISO(slot.date), 'EEE, MMM d, yyyy')}
                </p>
                {/* Time */}
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {slot.startTime} – {slot.endTime}
                </p>
                {/* Service tag */}
                {service && (
                  <span
                    className="mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: service.color }}
                  >
                    {service.name}
                  </span>
                )}
                {/* Capacity bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{slot.booked} / {slot.capacity} booked</span>
                    <span>{slot.available ? 'Available' : 'Full'}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 100 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
                {/* Delete */}
                <button
                  onClick={() => handleDelete(slot)}
                  className="absolute right-3 top-3 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                  title="Delete slot"
                >
                  🗑
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Create slot modal */}
      {showForm && (
        <Modal title="Create New Time Slot" onClose={() => setShowForm(false)}>
          <SlotForm
            services={services}
            defaultDate={filterDate}
            onSuccess={() => {
              setShowForm(false);
              fetchSlots(filterDate);
            }}
            onCancel={() => setShowForm(false)}
          />
        </Modal>
      )}
    </div>
  );
}
