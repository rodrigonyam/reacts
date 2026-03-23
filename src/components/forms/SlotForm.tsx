import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { Service } from '../../types';
import { slotService } from '../../services/slotService';
import { useBookingStore } from '../../store/bookingStore';

const schema = z
  .object({
    date: z.string().min(1, 'Date is required'),
    startTime: z.string().min(1, 'Start time is required'),
    endTime: z.string().min(1, 'End time is required'),
    capacity: z.number().min(1, 'Capacity must be at least 1').max(100),
    serviceId: z.string().optional(),
  })
  .refine((d) => d.startTime < d.endTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

type SlotFormValues = z.infer<typeof schema>;

interface SlotFormProps {
  services: Service[];
  defaultDate?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function SlotForm({ services, defaultDate, onSuccess, onCancel }: SlotFormProps) {
  const { addSlot } = useBookingStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SlotFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: defaultDate ?? format(new Date(), 'yyyy-MM-dd'),
      capacity: 3,
    },
  });

  const onSubmit = async (data: SlotFormValues) => {
    try {
      const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.DEV;

      if (USE_MOCK) {
        const mockSlot = {
          id: `slot-${Date.now()}`,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          capacity: data.capacity,
          booked: 0,
          available: true,
          serviceId: data.serviceId,
        };
        addSlot(mockSlot);
        toast.success('Slot created!');
        onSuccess?.();
        return;
      }

      const slot = await slotService.create(data);
      addSlot(slot);
      toast.success('Slot created!');
      onSuccess?.();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const inputClass =
    'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';

  const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date" error={errors.date?.message}>
          <input
            {...register('date')}
            type="date"
            min={format(new Date(), 'yyyy-MM-dd')}
            className={inputClass}
          />
        </Field>

        <Field label="Service (optional)" error={errors.serviceId?.message}>
          <select {...register('serviceId')} className={inputClass}>
            <option value="">— Any service —</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Start Time" error={errors.startTime?.message}>
          <input {...register('startTime')} type="time" className={inputClass} />
        </Field>

        <Field label="End Time" error={errors.endTime?.message}>
          <input {...register('endTime')} type="time" className={inputClass} />
        </Field>

        <Field label="Capacity" error={errors.capacity?.message}>
          <input
            {...register('capacity', { valueAsNumber: true, setValueAs: (v) => Number(v) })}
            type="number"
            min={1}
            max={100}
            className={inputClass}
          />
        </Field>
      </div>

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
          className="rounded-lg bg-sky-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60 transition-colors"
        >
          {isSubmitting ? 'Saving…' : 'Create Slot'}
        </button>
      </div>
    </form>
  );
}
