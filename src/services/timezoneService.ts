/**
 * Timezone Service
 * Provides timezone detection, conversion, and formatting utilities.
 * Uses the native Intl API — no external dependencies required.
 */

export const PROVIDER_TZ_KEY = 'sos_provider_timezone';
export const DEFAULT_PROVIDER_TZ = 'America/New_York';

// ── Common timezones ─────────────────────────────────────────────────────────

export interface TimezoneOption {
  iana: string;
  label: string;
}

export const COMMON_TIMEZONES: TimezoneOption[] = [
  { iana: 'America/New_York',    label: 'Eastern Time (ET)' },
  { iana: 'America/Chicago',     label: 'Central Time (CT)' },
  { iana: 'America/Denver',      label: 'Mountain Time (MT)' },
  { iana: 'America/Phoenix',     label: 'Mountain Time – Arizona (no DST)' },
  { iana: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { iana: 'America/Anchorage',   label: 'Alaska Time (AKT)' },
  { iana: 'Pacific/Honolulu',    label: 'Hawaii Time (HST)' },
  { iana: 'America/Puerto_Rico', label: 'Atlantic Time (AT)' },
  { iana: 'America/Toronto',     label: 'Eastern Time – Canada (ET)' },
  { iana: 'America/Vancouver',   label: 'Pacific Time – Canada (PT)' },
  { iana: 'Europe/London',       label: 'Greenwich Mean Time (GMT)' },
  { iana: 'Europe/Paris',        label: 'Central European Time (CET)' },
  { iana: 'Europe/Berlin',       label: 'Central European Time (CET)' },
  { iana: 'Europe/Moscow',       label: 'Moscow Time (MSK)' },
  { iana: 'Asia/Dubai',          label: 'Gulf Standard Time (GST)' },
  { iana: 'Asia/Kolkata',        label: 'India Standard Time (IST)' },
  { iana: 'Asia/Bangkok',        label: 'Indochina Time (ICT)' },
  { iana: 'Asia/Shanghai',       label: 'China Standard Time (CST)' },
  { iana: 'Asia/Tokyo',          label: 'Japan Standard Time (JST)' },
  { iana: 'Australia/Sydney',    label: 'Australian Eastern Time (AET)' },
  { iana: 'Pacific/Auckland',    label: 'New Zealand Time (NZST)' },
];

// ── Detection ────────────────────────────────────────────────────────────────

/** Returns the IANA timezone name from the browser (e.g. "America/Chicago"). */
export function detectClientTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return DEFAULT_PROVIDER_TZ;
  }
}

// ── Labels & offsets ─────────────────────────────────────────────────────────

/**
 * Returns the short abbreviation for a timezone at the current moment,
 * e.g. "EST", "CDT", "PST".
 */
export function getTimezoneAbbr(tz: string): string {
  try {
    return (
      new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')?.value ?? tz
    );
  } catch {
    return tz;
  }
}

/**
 * Returns the UTC offset string for a timezone at the current moment,
 * e.g. "GMT-5", "GMT+5:30".
 */
export function getUTCOffset(tz: string): string {
  try {
    return (
      new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')?.value ?? ''
    );
  } catch {
    return '';
  }
}

/**
 * Returns a human-readable label for a timezone, preferring the entry in
 * COMMON_TIMEZONES; falls back to "Region/City (ABBR) – GMT±X".
 */
export function getTimezoneLabel(tz: string): string {
  const known = COMMON_TIMEZONES.find((t) => t.iana === tz);
  if (known) return known.label;
  const abbr = getTimezoneAbbr(tz);
  const offset = getUTCOffset(tz);
  const display = tz.replace(/_/g, ' ');
  return abbr && offset ? `${display} (${abbr}) – ${offset}` : display;
}

/** Returns a short display like "EST (GMT-5)". */
export function getTimezoneBadge(tz: string): string {
  const abbr = getTimezoneAbbr(tz);
  const offset = getUTCOffset(tz);
  return abbr && offset ? `${abbr} (${offset})` : tz;
}

// ── Conversion ───────────────────────────────────────────────────────────────

/**
 * Parses a naive date+time string (assumed to be in `providerTz`) and returns
 * the corresponding UTC Date object.
 *
 * Uses an iterative Intl-based approach that correctly handles DST boundaries.
 */
function parseSlotAsUTC(dateStr: string, timeStr: string, providerTz: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  // Start with a naive UTC guess
  let guessMs = Date.UTC(year, month - 1, day, hours, minutes, 0);

  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: providerTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Two iterations converge for all practical cases (handles DST offsets)
  for (let i = 0; i < 2; i++) {
    const guessDate = new Date(guessMs);
    const parts = Object.fromEntries(
      fmt.formatToParts(guessDate).map((p) => [p.type, p.value]),
    );

    const showHour = parseInt(parts.hour) === 24 ? 0 : parseInt(parts.hour);
    const showsMs = Date.UTC(
      parseInt(parts.year),
      parseInt(parts.month) - 1,
      parseInt(parts.day),
      showHour,
      parseInt(parts.minute),
    );
    const wantMs = Date.UTC(year, month - 1, day, hours, minutes);
    guessMs += wantMs - showsMs;
  }

  return new Date(guessMs);
}

/**
 * Converts a slot time from the provider's timezone to the client's timezone.
 *
 * @param date       - "yyyy-MM-dd" (slot date)
 * @param time       - "HH:mm" in providerTz
 * @param providerTz - IANA name of the provider's timezone
 * @param clientTz   - IANA name of the client's timezone
 * @returns          - Formatted time string in clientTz, e.g. "9:00 AM"
 */
export function convertSlotTime(
  date: string,
  time: string,
  providerTz: string,
  clientTz: string,
): string {
  const utc = parseSlotAsUTC(date, time, providerTz);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: clientTz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(utc);
}

/**
 * Returns a formatted time range in the client's timezone.
 * e.g. "9:00 AM – 10:00 AM"
 */
export function convertSlotRange(
  date: string,
  startTime: string,
  endTime: string,
  providerTz: string,
  clientTz: string,
): string {
  const start = convertSlotTime(date, startTime, providerTz, clientTz);
  const end = convertSlotTime(date, endTime, providerTz, clientTz);
  return `${start} – ${end}`;
}

/**
 * Returns true if two IANA timezone names resolve to the same current UTC offset.
 * Note: two TZs can share the same offset without being the "same" TZ (DST rules differ),
 * but for display purposes this is sufficient to suppress the conversion notice.
 */
export function isSameTimezone(tz1: string, tz2: string): boolean {
  if (tz1 === tz2) return true;
  return getTimezoneAbbr(tz1) === getTimezoneAbbr(tz2);
}

/**
 * Formats the current local time in a given timezone.
 * e.g. "2:30 PM" in America/Chicago
 */
export function formatCurrentTime(tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(new Date());
}

/**
 * Formats a date string in a given timezone.
 * e.g. "Monday, January 15, 2025"
 */
export function formatDateInTimezone(dateStr: string, tz: string): string {
  const date = new Date(`${dateStr}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}
