/**
 * integrationsService — manages third-party integration settings and
 * virtual meeting generation for Zoom and Microsoft Teams.
 *
 * NOTE: Actual Zoom / Teams API calls require a server-side proxy to handle
 * OAuth token exchange (CORS restriction). In this client-side implementation,
 * we generate realistic meeting info locally. Wire up a backend endpoint when
 * deploying to production to call the Zoom Meetings API or MS Graph API.
 */

import type { ZoomSettings, TeamsSettings, VirtualMeetingInfo } from '../types';

// ── Storage Keys ──────────────────────────────────────────────────────────────
const ZOOM_KEY = 'sos_zoom_settings';
const TEAMS_KEY = 'sos_teams_settings';

// ── Defaults ──────────────────────────────────────────────────────────────────
export const DEFAULT_ZOOM_SETTINGS: ZoomSettings = {
  enabled: false,
  accountId: '',
  clientId: '',
  clientSecret: '',
  defaultDurationMinutes: 60,
  autoCreateMeeting: true,
  defaultPassword: '',
};

export const DEFAULT_TEAMS_SETTINGS: TeamsSettings = {
  enabled: false,
  tenantId: '',
  clientId: '',
  clientSecret: '',
  autoCreateMeeting: true,
};

// ── Zoom persistence ──────────────────────────────────────────────────────────
export function loadZoomSettings(): ZoomSettings {
  try {
    const raw = localStorage.getItem(ZOOM_KEY);
    if (!raw) return { ...DEFAULT_ZOOM_SETTINGS };
    return { ...DEFAULT_ZOOM_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_ZOOM_SETTINGS };
  }
}

export function saveZoomSettings(settings: ZoomSettings): void {
  localStorage.setItem(ZOOM_KEY, JSON.stringify(settings));
}

// ── Teams persistence ─────────────────────────────────────────────────────────
export function loadTeamsSettings(): TeamsSettings {
  try {
    const raw = localStorage.getItem(TEAMS_KEY);
    if (!raw) return { ...DEFAULT_TEAMS_SETTINGS };
    return { ...DEFAULT_TEAMS_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_TEAMS_SETTINGS };
  }
}

export function saveTeamsSettings(settings: TeamsSettings): void {
  localStorage.setItem(TEAMS_KEY, JSON.stringify(settings));
}

// ── Meeting generation ────────────────────────────────────────────────────────

/** Generate a realistic Zoom-style 9-digit meeting ID */
function generateZoomMeetingId(): string {
  const n = Math.floor(Math.random() * 900_000_000) + 100_000_000;
  const s = n.toString();
  return `${s.slice(0, 3)} ${s.slice(3, 6)} ${s.slice(6)}`;
}

/** Generate a random 6-character alphanumeric password */
export function generateMeetingPassword(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Create virtual meeting info for Zoom.
 * In production: replace this with a call to your backend which calls
 * POST https://api.zoom.us/v2/users/me/meetings using Server-to-Server OAuth.
 */
export function createZoomMeeting(
  _serviceName: string,
  _dateStr: string,
  _startTime: string,
  _bookingId: string,
): VirtualMeetingInfo {
  const settings = loadZoomSettings();
  const rawId = generateZoomMeetingId();
  const numericId = rawId.replace(/\s/g, '');
  const password = settings.defaultPassword || generateMeetingPassword();

  // If real credentials are provided (production), the URL would be returned
  // from the Zoom API. For now we construct the standard join URL format.
  const meetingUrl = `https://zoom.us/j/${numericId}?pwd=${encodeURIComponent(password)}`;
  const hostUrl = `https://zoom.us/s/${numericId}`;
  const dialIn = `+1 646 558 8656`;

  return {
    platform: 'zoom',
    meetingId: rawId,
    meetingUrl,
    meetingPassword: password,
    hostUrl,
    dialIn,
  };
}

/**
 * Create virtual meeting info for Microsoft Teams.
 * In production: call MS Graph POST /me/onlineMeetings via a backend proxy.
 */
export function createTeamsMeeting(
  _serviceName: string,
  _dateStr: string,
  _startTime: string,
  _bookingId: string,
): VirtualMeetingInfo {
  const meetingCode = Math.random().toString(36).slice(2, 12);
  return {
    platform: 'teams',
    meetingId: meetingCode,
    meetingUrl: `https://teams.microsoft.com/l/meetup-join/19%3a${meetingCode}%40thread.v2/0`,
  };
}

/**
 * Decide whether to generate a virtual meeting for a booking and which
 * platform to use (first enabled platform wins).
 */
export function shouldCreateVirtualMeeting(): 'zoom' | 'teams' | null {
  const zoom = loadZoomSettings();
  if (zoom.enabled && zoom.autoCreateMeeting) return 'zoom';
  const teams = loadTeamsSettings();
  if (teams.enabled && teams.autoCreateMeeting) return 'teams';
  return null;
}

/** Convenience: create the meeting for the active platform (or null) */
export function createVirtualMeetingForBooking(
  serviceName: string,
  dateStr: string,
  startTime: string,
  bookingId: string,
): VirtualMeetingInfo | null {
  const platform = shouldCreateVirtualMeeting();
  if (platform === 'zoom') return createZoomMeeting(serviceName, dateStr, startTime, bookingId);
  if (platform === 'teams') return createTeamsMeeting(serviceName, dateStr, startTime, bookingId);
  return null;
}
