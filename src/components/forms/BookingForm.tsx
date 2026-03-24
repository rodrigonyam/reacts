import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { BookingFormData, Service, TimeSlot, ReminderConfig, PaymentInfo } from '../../types';
import { bookingService } from '../../services/bookingService';
import { useBookingStore } from '../../store/bookingStore';
import { buildMockReminders } from '../../services/reminderService';
import { ReminderSettings } from '../reminders/ReminderSettings';
import { PaymentForm } from '../payment/PaymentForm';

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

const STEP_LABELS = ['Details', 'Reminders', 'Payment'];

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

  const [step, setStep] = useState(1);
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig>({
    enabled: true,
    channels: 'email',
    timings: ['24h', '2h'],
  });
  const [pendingFormData, setPendingFormData] = useState<BookingFormData | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BookingFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: defaultDate ?? format(new Date(), 'yyyy-MM-dd'),
    },
  });

  const selectedDate = watch('date');
  const selectedServiceId = watch('serviceId');

  useEffect(() => {
    if (selectedDate) fetchSlots(selectedDate);
  }, [selectedDate, fetchSlots]);

  const filteredSlots = slots.filter(
    (s) =>
      s.date === selectedDate &&
      s.available &&
      (!selectedServiceId || !s.serviceId || s.serviceId === selectedServiceId),
  );

  const selectedService = services.find((s) => s.id === selectedServiceId);

  const createBooking = async (data: BookingFormData, paymentInfo: PaymentInfo) => {
    const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.DEV;
    const slot = slots.find((s) => s.id === data.slotId);
    const service = services.find((s) => s.id === data.serviceId);
    const appointmentIso = slot ? `${slot.date}T${slot.startTime}:00` : new Date().toISOString();

    try {
      if (USE_MOCK) {
        const bookingId = `b-${Date.now()}`;
        const mockBooking = {
          id: bookingId,
          userId: `u-${Date.now()}`,
          user: {
            id: `u-${Date.now()}`,
            name: data.name,
            email: data.email,
            phone: data.phone,
            createdAt: new Date().toISOString(),
          },
          slotId: data.slotId,
          slot,
          serviceId: data.serviceId,
          service,
          status: 'confirmed' as const,
          notes: data.notes ?? '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          payment: paymentInfo,
          reminders: reminderConfig.enabled
            ? buildMockReminders(bookingId, appointmentIso, reminderConfig)
            : [],
        };
        addBooking(mockBooking);
        toast.success('Booking confirmed!');
        onSuccess?.();
        return;
      }

      const booking = await bookingService.create(data);
      addBooking(booking);
      toast.success('Booking confirmed!');
      onSuccess?.();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // Step 1 submits → stores data, advances to step 2
  const onStep1Submit = handleSubmit((data) => {
    setPendingFormData(data);
    setStep(2);
  });

  const inputClass =
    'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-gray-50 disabled:cursor-not-allowed';

  const Field = ({
    label,
    error,
    children,
  }: {
    label: string;
    error?: string;
    children: React.ReactNode;
  }) => (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center">
        {STEP_LABELS.map((label, i) => {
          const num = i + 1;
          const active = num === step;
          const done = num < step;
          return (
            <div key={label} className="flex flex-1 items-center">
              <div className={`flex items-center gap-2 ${active ? 'text-sky-600' : done ? 'text-green-600' : 'text-gray-400'}`}>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    active ? 'bg-sky-600 text-white' : done ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {done ? '✓' : num}
                </span>
                <span className="text-xs font-medium">{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`mx-2 h-px flex-1 ${done ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Details ── */}
      {step === 1 && (
        <form onSubmit={onStep1Submit} className="space-y-5" noValidate>
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
              className="rounded-lg bg-sky-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 transition-colors"
            >
              Next: Reminders →
            </button>
          </div>
        </form>
      )}

      {/* ── Step 2: Reminders ── */}
      {step === 2 && (
        <div className="space-y-5">
          <ReminderSettings value={reminderConfig} onChange={setReminderConfig} />
          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-lg bg-sky-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 transition-colors"
            >
              Next: Payment →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Payment ── */}
      {step === 3 && (
        <PaymentForm
          amount={(selectedService?.price ?? 0) * 100}
          serviceName={selectedService?.name ?? 'Service'}
          onSuccess={(paymentInfo) => {
            if (pendingFormData) createBooking(pendingFormData, paymentInfo);
          }}
          onCancel={() => setStep(2)}
        />
      )}
    </div>
  );
}
