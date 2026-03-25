import { useState, useEffect, useCallback } from 'react';
import { format, parseISO, isAfter } from 'date-fns';
import toast from 'react-hot-toast';
import type { WaitlistEntry, WaitlistSettings, WaitlistStatus } from '../types';
import {
  loadWaitlistEntries,
  loadWaitlistSettings,
  saveWaitlistSettings,
  removeFromWaitlist,
  claimSpot,
  notifyNextInQueue,
  onSlotOpened,
  expireStaleNotifications,
  getWaitlistStats,
  updateEntryStatus,
} from '../services/waitlistService';

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: WaitlistStatus) {
  const map: Record<WaitlistStatus, string> = {
    waiting: 'bg-sky-100 text-sky-700',
    notified: 'bg-amber-100 text-amber-700',
    claimed: 'bg-emerald-100 text-emerald-700',
    expired: 'bg-gray-100 text-gray-500',
  };
  const labels: Record<WaitlistStatus, string> = {
    waiting: 'Waiting',
    notified: 'Notified',
    claimed: 'Claimed',
    expired: 'Expired',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

function fmt(iso?: string) {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'MMM d, yyyy h:mm a');
  } catch {
    return iso;
  }
}

function isExpired(entry: WaitlistEntry) {
  return entry.expiresAt ? isAfter(new Date(), parseISO(entry.expiresAt)) : false;
}

// ── Settings panel ────────────────────────────────────────────────────────────

function SettingsPanel({ settings, onChange }: { settings: WaitlistSettings; onChange: (s: WaitlistSettings) => void }) {
  const [local, setLocal] = useState<WaitlistSettings>(settings);
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof WaitlistSettings>(key: K, value: WaitlistSettings[K]) =>
    setLocal((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    saveWaitlistSettings(local);
    onChange(local);
    setSaved(true);
    toast.success('Waitlist settings saved.');
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">Settings</h2>
      <div className="space-y-4">
        {/* Enable toggle */}
        <label className="flex cursor-pointer items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Enable waitlist</span>
          <button
            type="button"
            onClick={() => update('enabled', !local.enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${local.enabled ? 'bg-sky-600' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-4 w-4 translate-x-1 transform rounded-full bg-white shadow transition-transform ${local.enabled ? 'translate-x-6' : ''}`} />
          </button>
        </label>

        {/* Auto-notify toggle */}
        <label className="flex cursor-pointer items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Auto-notify next in queue</span>
          <button
            type="button"
            onClick={() => update('autoNotify', !local.autoNotify)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${local.autoNotify ? 'bg-sky-600' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-4 w-4 translate-x-1 transform rounded-full bg-white shadow transition-transform ${local.autoNotify ? 'translate-x-6' : ''}`} />
          </button>
        </label>

        {/* Notification window */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Claim window (hours)</label>
          <input
            type="number"
            min={1}
            max={72}
            value={local.notificationWindowHours}
            onChange={(e) => update('notificationWindowHours', Number(e.target.value))}
            className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-400">How long a notified client has to book before the next person is notified.</p>
        </div>

        {/* Max per slot */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Max waitlist per slot</label>
          <input
            type="number"
            min={1}
            max={100}
            value={local.maxPerSlot}
            onChange={(e) => update('maxPerSlot', Number(e.target.value))}
            className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          />
        </div>

        {/* Notification message */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Notification message</label>
          <textarea
            rows={3}
            value={local.notificationMessage}
            onChange={(e) => update('notificationMessage', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-400">Use {'{date}'}, {'{time}'}, {'{hours}'} as placeholders.</p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700"
        >
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

// ── Entry row ─────────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  onNotify,
  onClaim,
  onRemove,
}: {
  entry: WaitlistEntry;
  onNotify: (id: string) => void;
  onClaim: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const expired = isExpired(entry);
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-3 py-3 text-center text-xs font-bold text-gray-500">{entry.position}</td>
      <td className="px-3 py-3">
        <div className="text-sm font-medium text-gray-800">{entry.clientName}</div>
        <div className="text-xs text-gray-400">{entry.clientEmail}</div>
        {entry.clientPhone && <div className="text-xs text-gray-400">{entry.clientPhone}</div>}
      </td>
      <td className="px-3 py-3">{statusBadge(expired && entry.status === 'notified' ? 'expired' : entry.status)}</td>
      <td className="px-3 py-3 text-xs text-gray-500">{fmt(entry.joinedAt)}</td>
      <td className="px-3 py-3 text-xs text-gray-500">{fmt(entry.notifiedAt)}</td>
      <td className="px-3 py-3 text-xs text-gray-500">
        {entry.expiresAt ? (
          <span className={expired ? 'text-red-400' : 'text-gray-500'}>{fmt(entry.expiresAt)}</span>
        ) : '—'}
      </td>
      <td className="px-3 py-3">
        <div className="flex gap-2">
          {entry.status === 'waiting' && (
            <button
              type="button"
              onClick={() => onNotify(entry.id)}
              className="rounded bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100"
            >
              Notify
            </button>
          )}
          {entry.status === 'notified' && (
            <button
              type="button"
              onClick={() => onClaim(entry.id)}
              className="rounded bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
            >
              Mark Claimed
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(entry.id)}
            className="rounded bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100"
          >
            Remove
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Slot group ────────────────────────────────────────────────────────────────

function SlotGroup({
  slotId,
  entries,
  onRefresh,
}: {
  slotId: string;
  entries: WaitlistEntry[];
  onRefresh: () => void;
}) {
  const first = entries[0];
  const waiting = entries.filter((e) => e.status === 'waiting').length;
  const notified = entries.filter((e) => e.status === 'notified').length;
  const claimed = entries.filter((e) => e.status === 'claimed').length;

  const handleNotifyNext = () => {
    const notified = notifyNextInQueue(slotId);
    if (notified) {
      toast.success(`Notified ${notified.clientName} — they have until ${fmt(notified.expiresAt)} to claim.`);
    } else {
      toast('No one waiting for this slot.');
    }
    onRefresh();
  };

  const handleSimulateOpen = () => {
    const result = onSlotOpened(slotId);
    if (result) {
      toast.success(`Slot opened → notified ${result.clientName}`);
    } else {
      toast('No waiting entries or auto-notify is disabled.');
    }
    onRefresh();
  };

  const handleNotifyEntry = (entryId: string) => {
    updateEntryStatus(entryId, 'notified');
    toast.success('Entry marked as notified.');
    onRefresh();
  };

  const handleClaimEntry = (entryId: string) => {
    claimSpot(entryId);
    toast.success('Entry marked as claimed.');
    onRefresh();
  };

  const handleRemoveEntry = (entryId: string) => {
    removeFromWaitlist(entryId);
    toast.success('Entry removed from waitlist.');
    onRefresh();
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Group header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-gray-800">
            {first.slotDate} · {first.slotTime} — {first.serviceName}
          </div>
          <div className="mt-0.5 text-xs text-gray-400">
            Slot ID: {slotId} &nbsp;·&nbsp;
            <span className="text-sky-600">{waiting} waiting</span>
            {notified > 0 && <span className="ml-1 text-amber-600">{notified} notified</span>}
            {claimed > 0 && <span className="ml-1 text-emerald-600">{claimed} claimed</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {waiting > 0 && (
            <button
              type="button"
              onClick={handleNotifyNext}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
            >
              Notify Next
            </button>
          )}
          <button
            type="button"
            onClick={handleSimulateOpen}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            title="Simulate a cancellation / slot opening for demo purposes"
          >
            Simulate Open
          </button>
        </div>
      </div>

      {/* Entries table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-gray-400">
              <th className="px-3 py-2 text-center">#</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2">Notified</th>
              <th className="px-3 py-2">Expires</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <EntryRow
                key={e.id}
                entry={e}
                onNotify={handleNotifyEntry}
                onClaim={handleClaimEntry}
                onRemove={handleRemoveEntry}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type FilterStatus = 'all' | WaitlistStatus;

export function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [settings, setSettings] = useState<WaitlistSettings>(loadWaitlistSettings());
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterService, setFilterService] = useState('');
  const [activeTab, setActiveTab] = useState<'slots' | 'settings'>('slots');

  const reload = useCallback(() => {
    expireStaleNotifications();
    setEntries(loadWaitlistEntries());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const stats = getWaitlistStats();

  // Group entries by slotId
  const filtered = entries.filter((e) => {
    if (filterStatus !== 'all' && e.status !== filterStatus) return false;
    if (filterService && !e.serviceName.toLowerCase().includes(filterService.toLowerCase())) return false;
    return true;
  });

  const slotIds = [...new Set(filtered.map((e) => e.slotId))];

  const allServices = [...new Set(entries.map((e) => e.serviceName))];

  const TABS: { id: 'slots' | 'settings'; label: string }[] = [
    { id: 'slots', label: 'Waitlist Entries' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Waiting Lists</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage clients waiting for an opening. Notifications are simulated via toast.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Waiting', value: stats.totalWaiting, color: 'text-sky-600' },
          { label: 'Notified', value: stats.totalNotified, color: 'text-amber-600' },
          { label: 'Claimed', value: stats.totalClaimed, color: 'text-emerald-600' },
          { label: 'Expired', value: stats.totalExpired, color: 'text-gray-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="mt-0.5 text-xs font-medium text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'settings' ? (
        <SettingsPanel settings={settings} onChange={(s) => { setSettings(s); reload(); }} />
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
            >
              <option value="all">All statuses</option>
              <option value="waiting">Waiting</option>
              <option value="notified">Notified</option>
              <option value="claimed">Claimed</option>
              <option value="expired">Expired</option>
            </select>
            {allServices.length > 1 && (
              <select
                value={filterService}
                onChange={(e) => setFilterService(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              >
                <option value="">All services</option>
                {allServices.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={reload}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              ↺ Refresh
            </button>
          </div>

          {/* Entry groups */}
          {slotIds.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
              <div className="mb-2 text-4xl">⏳</div>
              <p className="text-sm font-medium text-gray-500">No waitlist entries yet.</p>
              <p className="mt-1 text-xs text-gray-400">
                When a slot is full, clients on the booking page can join the waitlist.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {slotIds.map((slotId) => (
                <SlotGroup
                  key={slotId}
                  slotId={slotId}
                  entries={filtered.filter((e) => e.slotId === slotId)}
                  onRefresh={reload}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
