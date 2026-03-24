/**
 * TimeZonePage — Admin timezone management & configuration.
 *
 * Allows the provider to:
 *  - Set their own (provider) timezone — persisted to localStorage
 *  - View a live clock in both provider and any selected timezone
 *  - See upcoming slot times converted across timezones
 *  - Review client timezone distribution from recent bookings
 */
import { useEffect, useState } from 'react';
import { useBookingStore } from '../store/bookingStore';
import {
  COMMON_TIMEZONES,
  convertSlotRange,
  formatCurrentTime,
  getTimezoneBadge,
  getTimezoneLabel,
  isSameTimezone,
} from '../services/timezoneService';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClientTZStat {
  tz: string;
  label: string;
  count: number;
  pct: number;
}

// ── Mock client TZ distribution (in a real app this comes from bookings data) ─

function buildMockClientStats(): ClientTZStat[] {
  const raw: Array<{ tz: string; count: number }> = [
    { tz: 'America/New_York',    count: 18 },
    { tz: 'America/Chicago',     count: 11 },
    { tz: 'America/Los_Angeles', count: 9  },
    { tz: 'America/Denver',      count: 4  },
    { tz: 'Europe/London',       count: 3  },
    { tz: 'America/Phoenix',     count: 2  },
  ];
  const total = raw.reduce((s, r) => s + r.count, 0);
  return raw.map((r) => ({
    tz: r.tz,
    label: getTimezoneLabel(r.tz),
    count: r.count,
    pct: Math.round((r.count / total) * 100),
  }));
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LiveClock({ tz, label }: { tz: string; label: string }) {
  const [time, setTime] = useState(() => formatCurrentTime(tz));

  useEffect(() => {
    setTime(formatCurrentTime(tz));
    const id = setInterval(() => setTime(formatCurrentTime(tz)), 1000);
    return () => clearInterval(id);
  }, [tz]);

  return (
    <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-gray-50 px-6 py-5 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold text-gray-900">{time}</p>
      <p className="mt-1 text-xs text-gray-500">{getTimezoneBadge(tz)}</p>
      <p className="mt-0.5 text-xs text-gray-400">{tz}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function TimeZonePage() {
  const {
    slots,
    providerTimezone,
    setProviderTimezone,
  } = useBookingStore();

  const [editTz, setEditTz] = useState(providerTimezone);
  const [saved, setSaved] = useState(false);
  const [previewTz, setPreviewTz] = useState('America/Los_Angeles');

  const clientStats = buildMockClientStats();

  // Pick the next 6 available slots for the conversion table
  const upcoming = slots.filter((s) => s.available).slice(0, 6);

  const handleSave = () => {
    setProviderTimezone(editTz);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🌍 Time Zone Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure your provider timezone and see how availability looks to clients worldwide.
        </p>
      </div>

      {/* ── Provider Timezone Settings ───────────────────────────────────── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Provider Timezone</h2>
        <p className="mb-4 text-sm text-gray-500">
          All slot times are stored and managed in this timezone.
          Clients will see times converted to their local timezone automatically.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[260px]">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Your Timezone
            </label>
            <select
              value={editTz}
              onChange={(e) => { setEditTz(e.target.value); setSaved(false); }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.iana} value={tz.iana}>
                  {tz.label} — {tz.iana}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={editTz === providerTimezone}
            className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          >
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>

        {editTz !== providerTimezone && (
          <p className="mt-2 text-xs text-amber-600">
            ⚠ Unsaved changes — click Save to apply.
          </p>
        )}
        {saved && (
          <p className="mt-2 text-xs text-green-600">
            ✓ Provider timezone updated to <strong>{getTimezoneBadge(editTz)}</strong>.
          </p>
        )}
      </section>

      {/* ── Live Clocks ──────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Live Time Comparison</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <LiveClock tz={providerTimezone} label="Your Timezone (Provider)" />
          <LiveClock tz={previewTz} label="Preview Client Timezone" />
          <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-200 bg-transparent px-6 py-5 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Compare with
            </p>
            <select
              value={previewTz}
              onChange={(e) => setPreviewTz(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.iana} value={tz.iana}>
                  {tz.iana}
                </option>
              ))}
            </select>
            {isSameTimezone(providerTimezone, previewTz) && (
              <p className="mt-2 text-xs text-gray-400">Same offset as provider</p>
            )}
          </div>
        </div>
      </section>

      {/* ── Slot Conversion Table ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Upcoming Slot Conversion</h2>
        <p className="mb-4 text-sm text-gray-500">
          How your next available slots appear to clients in different timezones.
        </p>

        {upcoming.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            No available slots found. Add slots in the Slots manager to see them here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">
                    Provider ({getTimezoneBadge(providerTimezone)})
                  </th>
                  <th className="pb-2 pr-4">
                    {getTimezoneBadge(previewTz)}
                  </th>
                  <th className="pb-2">Spots</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {upcoming.map((slot) => (
                  <tr key={slot.id} className="hover:bg-gray-50">
                    <td className="py-2.5 pr-4 font-medium text-gray-800">{slot.date}</td>
                    <td className="py-2.5 pr-4 text-gray-700">
                      {slot.startTime} – {slot.endTime}
                    </td>
                    <td className="py-2.5 pr-4 text-sky-700 font-medium">
                      {isSameTimezone(providerTimezone, previewTz)
                        ? <span className="text-gray-400 text-xs">same time</span>
                        : convertSlotRange(slot.date, slot.startTime, slot.endTime, providerTimezone, previewTz)
                      }
                    </td>
                    <td className="py-2.5 text-gray-500">
                      {slot.capacity - slot.booked} / {slot.capacity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Client Timezone Distribution ─────────────────────────────────── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Client Timezone Distribution</h2>
        <p className="mb-4 text-sm text-gray-500">
          Where your recent clients are booking from (auto-detected from their browsers).
        </p>

        <div className="space-y-3">
          {clientStats.map((stat) => (
            <div key={stat.tz}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-800">{stat.label}</span>
                <span className="text-gray-500">{stat.count} bookings ({stat.pct}%)</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-sky-500"
                  style={{ width: `${stat.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-gray-400">
          * Distribution shown is based on mock data. Connect a real backend to see live statistics.
        </p>
      </section>

      {/* ── Info box ─────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-sky-100 bg-sky-50 px-5 py-4 text-sm text-sky-800">
        <p className="font-semibold">How timezone detection works</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sky-700">
          <li>
            Client timezone is auto-detected using the browser's{' '}
            <code className="rounded bg-sky-100 px-1 font-mono text-xs">Intl.DateTimeFormat</code>{' '}
            API when they open the booking page.
          </li>
          <li>
            Clients can manually override their detected timezone on the date &amp; time selection step.
          </li>
          <li>
            Slot times are stored in the <strong>provider timezone</strong> above and converted on
            the fly — no database changes required.
          </li>
          <li>
            Both provider and client times are shown on the booking confirmation so there's no confusion.
          </li>
          <li>
            Provider timezone is persisted to <code className="rounded bg-sky-100 px-1 font-mono text-xs">localStorage</code> and
            survives page refreshes.
          </li>
        </ul>
      </section>
    </div>
  );
}
