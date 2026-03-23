import type { BookingStatus } from '../../types';

const BADGE: Record<BookingStatus, string> = {
  confirmed: 'bg-green-100 text-green-800 ring-green-200',
  pending: 'bg-amber-100 text-amber-800 ring-amber-200',
  cancelled: 'bg-red-100 text-red-800 ring-red-200',
  completed: 'bg-blue-100 text-blue-800 ring-blue-200',
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset capitalize ${BADGE[status]}`}
    >
      {status}
    </span>
  );
}
