import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { BookingFormData, Service, TimeSlot } from '../../types';
import { bookingService } from '../../services/bookingService';
import { useBookingStore } from '../../store/bookingStore';

// ── Validation schema ─────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().min(7, 'Enter a valid phone number'),
  serviceId: z.string().min(1, 'Please select a service'),
  date: z.string().min(1, 'Please pick a date'),
  slotId: z.string().min(1, 'Please select a time slot'),
  notes: z.string().optional(),
});

interface BookingFormProps {
  services: Service[];
  slots: TimeSlot[];
  defaultDate?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function BookingForm({
  services,
  slots,
  defaultDate,
  onSuccess,
  onCancel,
}: BookingFormProps) {
  const { addBooking, fetchSlots } = useBookingStore();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: defaultDate ?? format(new Date(), 'yyyy-MM-dd'),
    },
  });

  const selectedDate = watch('date');
  const selectedServiceId = watch('serviceId');

  // Re-fetch slots when date changes
  useEffect(() => {
    if (selectedDate) fetchSlots(selectedDate);
  }, [selectedDate, fetchSlots]);

  // Filter slots by selected service and availability
  const filteredSlots = slots.filter(
    (s) =>
      s.date === selectedDate &&
      s.available &&
      (!selectedServiceId || !s.serviceId || s.serviceId === selectedServiceId),
  );

  const onSubmit = async (data: BookingFormData) => {
    try {
      const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.DEV;

      if (USE_MOCK) {
        // Simulate API call with mock data
        const mockBooking = {
          id: `b-${Date.now()}`,
          userId: `u-${Date.now()}`,
          user: { id: `u-${Date.now()}`, name: data.name, email: data.email, phone: data.phone, createdAt: new Date().toISOString() },
          slotId: data.slotId,
          slot: slots.find((s) => s.id === data.slotId),
          serviceId: data.serviceId,
          service: services.find((s) => s.id === data.serviceId),
          status: 'pending' as const,
          notes: data.notes ?? '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        addBooking(mockBooking);
        toast.success('Booking created successfully!');
        onSuccess?.();
        return;
      }

      const booking = await bookingService.create(data);
      addBooking(booking);
      toast.success('Booking created successfully!');
      onSuccess?.();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );

  const inputClass =
    'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-gray-50 disabled:cursor-not-allowed';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Full Name" error={errors.name?.message}>
          <input {...register('name')} type="text" placeholder="Jane Smith" className={inputClass} />
        </Field>

        <Field label="Email Address" error={errors.email?.message}>
          <input {...register('email')} type="email" placeholder="jane@example.com" className={inputClass} />
        </Field>

        <Field label="Phone Number" error={errors.phone?.message}>
          <input {...register('phone')} type="tel" placeholder="555-0100" className={inputClass} />
        </Field>

        <Field label="Service" error={errors.serviceId?.message}>
          <select {...register('serviceId')} className={inputClass}>
            <option value="">— Select a service —</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.durationMinutes} min · ${s.price})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Date" error={errors.date?.message}>
          <input
            {...register('date')}
            type="date"
            min={format(new Date(), 'yyyy-MM-dd')}
            className={inputClass}
          />
        </Field>

        <Field label="Available Time Slot" error={errors.slotId?.message}>
          <select
            {...register('slotId')}
            className={inputClass}
            disabled={filteredSlots.length === 0}
          >
            <option value="">— Select a slot —</option>
            {filteredSlots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.startTime} – {s.endTime} ({s.capacity - s.booked} spots left)
              </option>
            ))}
          </select>
          {filteredSlots.length === 0 && selectedDate && (
            <p className="mt-1 text-xs text-amber-600">No available slots for this date. Try another day.</p>
          )}
        </Field>
      </div>

      <Field label="Additional Notes (optional)" error={errors.notes?.message}>
        <textarea
          {...register('notes')}
          rows={3}
          placeholder="Any special requirements or notes…"
          className={inputClass}
        />
      </Field>

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-sky-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Booking…' : 'Confirm Booking'}
        </button>
      </div>
    </form>
  );
}
