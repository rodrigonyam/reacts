import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import type { CalendarConnection, ExternalCalendarEvent, ExternalCalendarProvider } from '../types';
import {
  calendarSyncService,
  CALENDAR_PROVIDERS,
  type ProviderInfo,
} from '../services/calendarSyncService';

// ── Small helper components ───────────────────────────────────────────────────

function SyncStatusDot({ status }: { status: CalendarConnection['syncStatus'] }) {
  const map = {
    idle: 'bg-gray-300',
    syncing: 'bg-blue-400 animate-pulse',
    success: 'bg-green-500',
    error: 'bg-red-500',
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${map[status]}`} />;
}

function ProviderBadge({ provider, color }: { provider: ExternalCalendarProvider; color: string }) {
  const info = CALENDAR_PROVIDERS.find((p) => p.id === provider);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {info?.icon} {info?.name}
    </span>
  );
}

// ── Connect card ──────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  connection,
  onConnect,
  onDisconnect,
  onSync,
  connecting,
}: {
  provider: ProviderInfo;
  connection?: CalendarConnection;
  onConnect: (p: ExternalCalendarProvider) => void;
  onDisconnect: (id: string) => void;
  onSync: () => void;
  connecting: ExternalCalendarProvider | null;
}) {
  const isConnecting = connecting === provider.id;
  const isConnected = !!connection;

  return (
    <div
      className={`rounded-xl border p-5 transition-all ${
        isConnected ? 'border-gray-200 bg-white shadow-sm' : 'border-dashed border-gray-300 bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{provider.icon}</span>
          <div>
            <p className="font-semibold text-gray-900">{provider.name}</p>
            {isConnected ? (
              <p className="mt-0.5 text-xs text-gray-500">{connection.accountEmail}</p>
            ) : (
              <p className="mt-0.5 text-xs text-gray-400 italic">{provider.authHint}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected && (
            <>
              <div className="flex items-center gap-1.5">
                <SyncStatusDot status={connection.syncStatus} />
                <span className="text-xs text-gray-500 capitalize">{connection.syncStatus}</span>
              </div>
              <button
                onClick={onSync}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                title="Sync now"
              >
                ↻ Sync
              </button>
              <button
                onClick={() => onDisconnect(connection.id)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                Disconnect
              </button>
            </>
          )}
          {!isConnected && (
            <button
              onClick={() => onConnect(provider.id)}
              disabled={isConnecting}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60"
              style={{ backgroundColor: isConnecting ? '#9ca3af' : provider.color }}
            >
              {isConnecting ? 'Connecting…' : 'Connect'}
            </button>
          )}
        </div>
      </div>

      {isConnected && (
        <div className="mt-3 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
          <span>📁 {connection.calendarName}</span>
          {connection.lastSyncedAt && (
            <span>
              🕐 Last synced: {format(parseISO(connection.lastSyncedAt), 'MMM d, h:mm a')}
            </span>
          )}
          <span
            className="ml-auto inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: connection.color }}
            title="Calendar color"
          />
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CalendarSyncPage() {
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [externalEvents, setExternalEvents] = useState<ExternalCalendarEvent[]>([]);
  const [connecting, setConnecting] = useState<ExternalCalendarProvider | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const [conns, events] = await Promise.all([
      calendarSyncService.getConnections(),
      calendarSyncService.getExternalEvents(),
    ]);
    setConnections(conns);
    setExternalEvents(events);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleConnect = async (provider: ExternalCalendarProvider) => {
    // In mock mode we use a simple email prompt.
    // In production, this would open the provider's OAuth2 popup.
    const email = window.prompt(
      `Enter your ${CALENDAR_PROVIDERS.find((p) => p.id === provider)?.name} email address:`,
      provider === 'google' ? 'me@gmail.com' :
        provider === 'outlook' ? 'me@outlook.com' :
        provider === 'apple' ? 'me@icloud.com' : 'https://calendar.example.com/feed.ics',
    );
    if (!email) return;

    setConnecting(provider);
    try {
      const conn = await calendarSyncService.connect(provider, email);
      setConnections((prev) => [...prev.filter((c) => c.provider !== provider), conn]);
      const events = await calendarSyncService.getExternalEvents();
      setExternalEvents(events);
      toast.success(`${CALENDAR_PROVIDERS.find((p) => p.id === provider)?.name} connected!`);
    } catch {
      toast.error('Failed to connect. Check provider credentials.');
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!window.confirm('Disconnect this calendar? External events will no longer block your slots.')) return;
    await calendarSyncService.disconnect(connectionId);
    setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    setExternalEvents((prev) => {
      const remaining = calendarSyncService.getConnectedProviders();
      return prev.filter((e) => remaining.includes(e.provider));
    });
    toast.success('Calendar disconnected.');
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    setConnections((prev) => prev.map((c) => ({ ...c, syncStatus: 'syncing' as const })));
    try {
      const events = await calendarSyncService.syncAll();
      const conns = await calendarSyncService.getConnections();
      setConnections(conns);
      setExternalEvents(events);
      toast.success(`Synced — ${events.length} external event${events.length !== 1 ? 's' : ''} found.`);
    } catch {
      toast.error('Sync failed.');
      setConnections((prev) => prev.map((c) => ({ ...c, syncStatus: 'error' as const })));
    } finally {
      setSyncing(false);
    }
  };

  const now = new Date();
  const upcomingEvents = externalEvents
    .filter((e) => new Date(e.end) >= now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 20);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar Sync</h1>
          <p className="mt-1 text-sm text-gray-500">
            Connect your external calendars to prevent double-booking. Events are pulled in real-time
            and shown on your booking calendar.
          </p>
        </div>
        {connections.length > 0 && (
          <button
            onClick={handleSyncAll}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60 transition-colors"
          >
            <span className={syncing ? 'animate-spin' : ''}>↻</span>
            {syncing ? 'Syncing…' : 'Sync All Now'}
          </button>
        )}
      </div>

      {/* How it works banner */}
      <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-800">
        <p className="font-semibold">How two-way sync works</p>
        <ul className="mt-2 space-y-1 text-xs text-sky-700 list-disc list-inside">
          <li>
            <strong>Pull</strong>: External calendar events (meetings, personal appointments, out-of-office) are
            fetched every 5 minutes and shown as <em>blocked</em> times on your booking calendar.
          </li>
          <li>
            <strong>Push</strong>: When a client books an appointment, it is automatically added to all your
            connected external calendars so you never lose track.
          </li>
          <li>
            <strong>Double-booking prevention</strong>: Slots that overlap with an external event are
            automatically marked unavailable and cannot be selected by clients.
          </li>
        </ul>
      </div>

      {/* Provider cards */}
      <div>
        <h2 className="mb-4 text-base font-semibold text-gray-900">Connected Calendars</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {CALENDAR_PROVIDERS.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              connection={connections.find((c) => c.provider === provider.id)}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onSync={handleSyncAll}
              connecting={connecting}
            />
          ))}
        </div>
      </div>

      {/* External events list */}
      {connections.length > 0 && (
        <div>
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Upcoming External Events
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {upcomingEvents.length}
            </span>
          </h2>

          {upcomingEvents.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
              No upcoming external events — your schedule is clear!
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-6 py-3 text-left">Title</th>
                    <th className="px-6 py-3 text-left">Calendar</th>
                    <th className="px-6 py-3 text-left">Date</th>
                    <th className="px-6 py-3 text-left">Time</th>
                    <th className="px-6 py-3 text-left">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {upcomingEvents.map((event) => {
                    const start = parseISO(event.start);
                    const end = parseISO(event.end);
                    const mins = Math.round((end.getTime() - start.getTime()) / 60000);
                    const hours = Math.floor(mins / 60);
                    const remMins = mins % 60;
                    const durationLabel =
                      hours > 0 && remMins > 0 ? `${hours}h ${remMins}m` :
                      hours > 0 ? `${hours}h` : `${remMins}m`;

                    const conn = connections.find((c) => c.provider === event.provider);

                    return (
                      <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 font-medium text-gray-900">{event.title}</td>
                        <td className="px-6 py-3">
                          <ProviderBadge
                            provider={event.provider}
                            color={conn?.color ?? '#6b7280'}
                          />
                        </td>
                        <td className="px-6 py-3 text-gray-600">{format(start, 'EEE, MMM d')}</td>
                        <td className="px-6 py-3 text-gray-600">
                          {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                        </td>
                        <td className="px-6 py-3 text-gray-500">{durationLabel}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {connections.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 py-14 text-center">
          <p className="text-4xl">📅</p>
          <p className="mt-3 text-base font-semibold text-gray-700">No calendars connected yet</p>
          <p className="mt-1 text-sm text-gray-400">
            Connect Google Calendar or Outlook above to start preventing double-bookings.
          </p>
        </div>
      )}
    </div>
  );
}
