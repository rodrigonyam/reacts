/**
 * ReminderBadge — Shows the scheduled reminder status for a booking.
 * Displays a compact summary of pending/sent/failed reminders.
 */
import type { ScheduledReminder } from '../../types';
import { timingLabel } from '../../services/reminderService';

interface ReminderBadgeProps {
  reminders: ScheduledReminder[];
}

const STATUS_STYLES: Record<ScheduledReminder['status'], string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  sent:    'bg-green-50 text-green-700 border-green-200',
  failed:  'bg-red-50 text-red-700 border-red-200',
};

const STATUS_ICONS: Record<ScheduledReminder['status'], string> = {
  pending: '⏳',
  sent:    '✅',
  failed:  '❌',
};

const CHANNEL_ICONS: Record<string, string> = {
  email: '✉️',
  sms:   '📱',
};

export function ReminderBadge({ reminders }: ReminderBadgeProps) {
  if (!reminders || reminders.length === 0) {
    return <span className="text-xs text-gray-400 italic">No reminders</span>;
  }

  const pending = reminders.filter((r) => r.status === 'pending').length;
  const sent    = reminders.filter((r) => r.status === 'sent').length;
  const failed  = reminders.filter((r) => r.status === 'failed').length;

  return (
    <div className="group relative inline-block">
      {/* Summary pill */}
      <span className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700">
        🔔 {reminders.length} reminder{reminders.length !== 1 ? 's' : ''}
        {pending > 0 && <span className="text-amber-600">·{pending} pending</span>}
        {failed  > 0 && <span className="text-red-600">·{failed} failed</span>}
        {sent    > 0 && <span className="text-green-600">·{sent} sent</span>}
      </span>

      {/* Hover tooltip detail */}
      <div className="invisible absolute bottom-full left-0 z-20 mb-2 min-w-[220px] rounded-lg border border-gray-200 bg-white p-3 shadow-lg group-hover:visible">
        <p className="mb-2 text-xs font-semibold text-gray-700">Scheduled Reminders</p>
        <ul className="space-y-1">
          {reminders.map((r) => (
            <li key={r.id} className={`flex items-center gap-2 rounded border px-2 py-1 text-xs ${STATUS_STYLES[r.status]}`}>
              <span>{CHANNEL_ICONS[r.channel] ?? '🔔'}</span>
              <span className="flex-1">{timingLabel(r.timing)}</span>
              <span>{STATUS_ICONS[r.status]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
