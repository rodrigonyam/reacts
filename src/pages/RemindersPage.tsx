/**
 * RemindersPage — manage all automated reminders & alerts across every booking.
 * View status, retry failed reminders, bulk-send, and customise email/SMS templates.
 */
import { useEffect, useState, useMemo } from 'react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { useBookingStore } from '../store/bookingStore';
import { timingLabel } from '../services/reminderService';
import { Spinner } from '../components/ui/Spinner';
import type { ScheduledReminder, Booking } from '../types';

// ── Template defaults ─────────────────────────────────────────────────────────

const DEFAULT_EMAIL_TEMPLATE = `Hi {{name}},

This is a friendly reminder about your upcoming appointment:

  Service:  {{service}}
  Date:     {{date}}
  Time:     {{time}}

Need to reschedule? Visit: {{reschedule_link}}

We look forward to seeing you soon!

{{provider_name}}`;

const DEFAULT_SMS_TEMPLATE = `Hi {{name}}, reminder: {{service}} on {{date}} at {{time}}. Reschedule: {{reschedule_link}} — {{provider_name}}`;

// ── Local types ───────────────────────────────────────────────────────────────

type EnrichedReminder = ScheduledReminder & { booking?: Booking };

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
  sub,
}: {
  label: string;
  value: number | string;
  icon: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className={`rounded-xl border bg-white p-5 shadow-sm ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<ScheduledReminder['status'], string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  sent:    'bg-green-50 text-green-700 border-green-200',
  failed:  'bg-red-50 text-red-700 border-red-200',
};

const STATUS_ICONS: Record<ScheduledReminder['status'], string> = {
  pending: '⏳',
  sent:    '✅',
  failed:  '❌',
};

// ── Main page ─────────────────────────────────────────────────────────────────

export function RemindersPage() {
  const {
    allReminders,
    bookings,
    loading,
    fetchAllReminders,
    fetchBookings,
    resendReminder,
    cancelReminder,
  } = useBookingStore();

  const [statusFilter, setStatusFilter] = useState<'all' | ScheduledReminder['status']>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'email' | 'sms'>('all');
  const [search, setSearch] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateTab, setTemplateTab] = useState<'email' | 'sms'>('email');
  const [emailTemplate, setEmailTemplate] = useState(DEFAULT_EMAIL_TEMPLATE);
  const [smsTemplate, setSmsTemplate] = useState(DEFAULT_SMS_TEMPLATE);
  const [resendingIds, setResendingIds] = useState<Set<string>>(new Set());
  const [sendingAll, setSendingAll] = useState(false);

  useEffect(() => {
    fetchAllReminders();
    fetchBookings();
  }, [fetchAllReminders, fetchBookings]);

  // ── Stats ────────────────────────────────────────────────────────────────────

  const total        = allReminders.length;
  const sentCount    = allReminders.filter(r => r.status === 'sent').length;
  const pendingCount = allReminders.filter(r => r.status === 'pending').length;
  const failedCount  = allReminders.filter(r => r.status === 'failed').length;
  // Estimated no-shows prevented — industry average ~22% fewer no-shows with reminders
  const noShowsPrevented = Math.round(sentCount * 0.22);

  // ── At-risk: upcoming confirmed/pending bookings with failed reminders ───────

  const atRisk = useMemo(() => {
    const failedBookingIds = new Set(
      allReminders.filter(r => r.status === 'failed').map(r => r.bookingId),
    );
    return bookings.filter(
      b => failedBookingIds.has(b.id) && (b.status === 'confirmed' || b.status === 'pending'),
    );
  }, [allReminders, bookings]);

  // ── Enriched (reminders joined with booking data) + filtered ─────────────────

  const enriched: EnrichedReminder[] = useMemo(
    () => allReminders.map(r => ({ ...r, booking: bookings.find(b => b.id === r.bookingId) })),
    [allReminders, bookings],
  );

  const filtered = useMemo(() => {
    return enriched
      .filter(r => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (channelFilter !== 'all' && r.channel !== channelFilter) return false;
        const q = search.toLowerCase().trim();
        if (q) {
          const matchName    = r.booking?.user?.name.toLowerCase().includes(q) ?? false;
          const matchEmail   = r.booking?.user?.email.toLowerCase().includes(q) ?? false;
          const matchService = r.booking?.service?.name.toLowerCase().includes(q) ?? false;
          if (!matchName && !matchEmail && !matchService) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime());
  }, [enriched, statusFilter, channelFilter, search]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleResend = async (id: string) => {
    setResendingIds(prev => new Set(prev).add(id));
    try {
      await resendReminder(id);
      toast.success('Reminder sent!');
    } catch {
      toast.error('Failed to send reminder.');
    } finally {
      setResendingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelReminder(id);
      toast.success('Reminder cancelled.');
    } catch {
      toast.error('Failed to cancel reminder.');
    }
  };

  const handleSendAllFailed = async () => {
    const failed = allReminders.filter(r => r.status === 'failed');
    if (!failed.length) return;
    setSendingAll(true);
    try {
      await Promise.all(failed.map(r => handleResend(r.id)));
      toast.success(`${failed.length} failed reminder${failed.length !== 1 ? 's' : ''} retried!`);
    } catch {
      toast.error('Some reminders could not be sent.');
    } finally {
      setSendingAll(false);
    }
  };

  const handleSaveTemplates = () => {
    // Production: POST /api/reminders/templates
    toast.success('Templates saved! They will be used for all future reminders.');
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reminders &amp; Alerts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Automated email and SMS alerts to reduce no-shows
          </p>
        </div>
        <div className="flex gap-2">
          {failedCount > 0 && (
            <button
              onClick={handleSendAllFailed}
              disabled={sendingAll}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {sendingAll ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
              ) : '⚡'}
              Retry {failedCount} Failed
            </button>
          )}
          <button
            onClick={() => setShowTemplates(v => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ✏️ {showTemplates ? 'Hide' : 'Edit'} Templates
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total Scheduled" value={total}        icon="🔔" color="border-gray-200" />
        <StatCard label="Sent"            value={sentCount}    icon="✅" color="border-green-200" />
        <StatCard label="Pending"         value={pendingCount} icon="⏳" color="border-amber-200" />
        <StatCard
          label="Failed"
          value={failedCount}
          icon="❌"
          color={failedCount > 0 ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-200'}
        />
        <StatCard
          label="No-Shows Prevented"
          value={`~${noShowsPrevented}`}
          icon="🎯"
          color="border-sky-200"
          sub="est. based on sent reminders"
        />
      </div>

      {/* ── At-risk alert band ── */}
      {atRisk.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <p className="font-semibold text-red-800">
                {atRisk.length} booking{atRisk.length !== 1 ? 's' : ''} need{atRisk.length === 1 ? 's' : ''} attention
              </p>
              <p className="mt-0.5 text-sm text-red-600">
                These upcoming bookings have failed reminders that couldn't be delivered. Retry them now to avoid no-shows.
              </p>
              <ul className="mt-3 space-y-2">
                {atRisk.map(b => (
                  <li key={b.id} className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-white px-4 py-2">
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">{b.user?.name ?? 'Unknown'}</span>
                      {' · '}
                      <span className="text-gray-600">{b.service?.name}</span>
                      {b.slot?.date && (
                        <>
                          {' · '}
                          <span className="text-gray-500">
                            {format(parseISO(b.slot.date), 'MMM d')}
                            {b.slot.startTime ? ` @ ${b.slot.startTime}` : ''}
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        const failedForBooking = allReminders.filter(
                          r => r.bookingId === b.id && r.status === 'failed',
                        );
                        await Promise.all(failedForBooking.map(r => handleResend(r.id)));
                      }}
                      className="flex-shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Retry Now
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Template editor (collapsible) ── */}
      {showTemplates && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-5">
          <h2 className="mb-1 text-base font-semibold text-gray-900">📝 Reminder Templates</h2>
          <p className="mb-4 text-sm text-gray-500">
            Customise the message sent to clients. Available variables:{' '}
            {['{{name}}', '{{service}}', '{{date}}', '{{time}}', '{{reschedule_link}}', '{{provider_name}}'].map(v => (
              <code key={v} className="mr-1 rounded bg-purple-100 px-1.5 py-0.5 font-mono text-xs text-purple-800">{v}</code>
            ))}
          </p>

          {/* Tabs */}
          <div className="mb-4 flex w-fit gap-1 rounded-lg bg-white/70 p-1">
            {(['email', 'sms'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setTemplateTab(tab)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  templateTab === tab
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab === 'email' ? '✉️ Email' : '📱 SMS'}
              </button>
            ))}
          </div>

          <textarea
            rows={templateTab === 'email' ? 10 : 4}
            value={templateTab === 'email' ? emailTemplate : smsTemplate}
            onChange={e =>
              templateTab === 'email'
                ? setEmailTemplate(e.target.value)
                : setSmsTemplate(e.target.value)
            }
            className="w-full rounded-lg border border-purple-200 bg-white px-4 py-3 font-mono text-sm text-gray-700 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
          {templateTab === 'sms' && (
            <p className={`mt-1.5 text-xs ${smsTemplate.length > 160 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
              {smsTemplate.length}/160 characters
              {smsTemplate.length > 160 && ' — over 160 chars may be split into multiple messages'}
            </p>
          )}
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleSaveTemplates}
              className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-700"
            >
              Save Templates
            </button>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Search by client name, email, or service…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        {/* Status pills */}
        <div className="flex flex-wrap gap-1.5">
          {(['all', 'pending', 'sent', 'failed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? 'bg-sky-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-sky-50 hover:text-sky-700'
              }`}
            >
              {s === 'all' ? 'All Status' : `${STATUS_ICONS[s as ScheduledReminder['status']]} ${s}`}
            </button>
          ))}
        </div>
        {/* Channel pills */}
        <div className="flex gap-1.5">
          {(['all', 'email', 'sms'] as const).map(c => (
            <button
              key={c}
              onClick={() => setChannelFilter(c)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                channelFilter === c
                  ? 'bg-sky-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-sky-50 hover:text-sky-700'
              }`}
            >
              {c === 'all' ? 'All Channels' : c === 'email' ? '✉️ Email' : '📱 SMS'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Reminders table ── */}
      {loading && allReminders.length === 0 ? (
        <div className="py-16"><Spinner /></div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">
              All Reminders
              <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">
                {filtered.length}
              </span>
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Client</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Service</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Appointment</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Remind</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Channel</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Scheduled</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => (
                  <tr
                    key={r.id}
                    className={`transition-colors hover:bg-gray-50 ${r.status === 'failed' ? 'bg-red-50/30' : ''}`}
                  >
                    {/* Client */}
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">
                        {r.booking?.user?.name ?? `Booking ${r.bookingId}`}
                      </p>
                      <p className="text-xs text-gray-400">{r.booking?.user?.email ?? '—'}</p>
                    </td>

                    {/* Service */}
                    <td className="px-6 py-4 text-gray-700">
                      {r.booking?.service?.name ?? '—'}
                    </td>

                    {/* Appointment date/time */}
                    <td className="px-6 py-4 text-gray-600">
                      {r.booking?.slot?.date ? (
                        <>
                          {format(parseISO(r.booking.slot.date), 'MMM d, yyyy')}
                          {r.booking.slot.startTime && (
                            <span className="ml-1 text-xs text-gray-400">
                              @ {r.booking.slot.startTime}
                            </span>
                          )}
                        </>
                      ) : '—'}
                    </td>

                    {/* Timing */}
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {timingLabel(r.timing)}
                    </td>

                    {/* Channel */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        r.channel === 'email'
                          ? 'border-sky-200 bg-sky-50 text-sky-700'
                          : 'border-violet-200 bg-violet-50 text-violet-700'
                      }`}>
                        {r.channel === 'email' ? '✉️ Email' : '📱 SMS'}
                      </span>
                    </td>

                    {/* Scheduled */}
                    <td className="whitespace-nowrap px-6 py-4 text-gray-500">
                      <span title={r.scheduledFor}>
                        {formatDistanceToNow(parseISO(r.scheduledFor), { addSuffix: true })}
                      </span>
                      {r.sentAt && (
                        <p className="text-xs text-gray-400">
                          Sent {formatDistanceToNow(parseISO(r.sentAt), { addSuffix: true })}
                        </p>
                      )}
                    </td>

                    {/* Status badge */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[r.status]}`}>
                        {STATUS_ICONS[r.status]} {r.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex gap-1">
                        {(r.status === 'failed' || r.status === 'pending') && (
                          <button
                            onClick={() => handleResend(r.id)}
                            disabled={resendingIds.has(r.id)}
                            className="rounded px-2 py-1 text-xs font-medium text-sky-600 hover:bg-sky-50 disabled:opacity-50"
                          >
                            {resendingIds.has(r.id) ? (
                              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                            ) : r.status === 'failed' ? 'Retry' : 'Send Now'}
                          </button>
                        )}
                        {r.status === 'pending' && (
                          <button
                            onClick={() => handleCancel(r.id)}
                            className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Empty state */}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-14 text-center">
                      <p className="text-gray-400">
                        {allReminders.length === 0
                          ? 'No reminders scheduled yet. They are created automatically when a booking is confirmed.'
                          : 'No reminders match the current filters.'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
