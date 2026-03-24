/**
 * calendarSyncService.ts
 *
 * Two-way calendar sync with Google Calendar, Microsoft Outlook (Graph API),
 * Apple Calendar (CalDAV / iCal), and generic iCal feeds.
 *
 * In development (VITE_USE_MOCK=true) every operation is simulated locally.
 * For production, swap the mock blocks for the real provider calls below.
 *
 * ── Google Calendar ──────────────────────────────────────────────────────────
 *   OAuth2 scopes: https://www.googleapis.com/auth/calendar.readonly
 *                  https://www.googleapis.com/auth/calendar.events
 *   Endpoint: GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events
 *   Docs: https://developers.google.com/calendar/api/v3/reference
 *
 * ── Microsoft Outlook (Graph) ────────────────────────────────────────────────
 *   OAuth2 scopes: Calendars.ReadWrite (delegated)
 *   Endpoint: GET https://graph.microsoft.com/v1.0/me/calendarView
 *   Docs: https://learn.microsoft.com/en-us/graph/api/user-list-calendarview
 *
 * ── Apple Calendar (CalDAV) ──────────────────────────────────────────────────
 *   Protocol: CalDAV (RFC4791) via iCloud / on-premise CalDAV server
 *   Base URL: https://caldav.icloud.com
 *   Docs: https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/EventKitProgGuide
 *
 * ── Generic iCal ─────────────────────────────────────────────────────────────
 *   Import: fetch .ics URL, parse with ical.js or similar
 */

import type { CalendarConnection, ExternalCalendarEvent, ExternalCalendarProvider } from '../types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.DEV;

// ── Mock data ─────────────────────────────────────────────────────────────────

/** Generate realistic external events spread across the next 30 days */
function buildMockExternalEvents(connections: CalendarConnection[]): ExternalCalendarEvent[] {
  if (connections.length === 0) return [];

  const now = new Date();
  const events: ExternalCalendarEvent[] = [];

  const seed: Array<{ dayOffset: number; startH: number; durationH: number; title: string }> = [
    { dayOffset: 0, startH: 10, durationH: 1, title: 'Team Standup' },
    { dayOffset: 0, startH: 14, durationH: 2, title: 'Busy' },
    { dayOffset: 1, startH: 9, durationH: 1, title: 'Doctor Appointment' },
    { dayOffset: 2, startH: 11, durationH: 1.5, title: 'Busy' },
    { dayOffset: 3, startH: 13, durationH: 3, title: 'Out of Office' },
    { dayOffset: 5, startH: 8, durationH: 1, title: 'Morning Run' },
    { dayOffset: 7, startH: 10, durationH: 2, title: 'Client Call' },
    { dayOffset: 7, startH: 15, durationH: 1, title: 'Busy' },
    { dayOffset: 9, startH: 9, durationH: 8, title: 'Vacation', },
    { dayOffset: 10, startH: 9, durationH: 8, title: 'Vacation' },
    { dayOffset: 14, startH: 11, durationH: 1, title: 'Lunch Meeting' },
    { dayOffset: 15, startH: 14, durationH: 1.5, title: 'Busy' },
    { dayOffset: 18, startH: 10, durationH: 2, title: 'Workshop' },
    { dayOffset: 21, startH: 13, durationH: 1, title: 'Busy' },
    { dayOffset: 25, startH: 9, durationH: 1, title: 'Team Standup' },
  ];

  const connection = connections[0]; // use first connected account for mock

  seed.forEach((s, i) => {
    const start = new Date(now);
    start.setDate(start.getDate() + s.dayOffset);
    start.setHours(s.startH, 0, 0, 0);

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + s.durationH * 60);

    events.push({
      id: `ext-${connection.provider}-${i}`,
      provider: connection.provider,
      externalId: `mock-ext-${i}`,
      title: s.title,
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: false,
      accountEmail: connection.accountEmail,
      calendarName: connection.calendarName,
    });
  });

  return events;
}

// ── Provider metadata ─────────────────────────────────────────────────────────

export interface ProviderInfo {
  id: ExternalCalendarProvider;
  name: string;
  icon: string;
  color: string;
  authHint: string;
}

export const CALENDAR_PROVIDERS: ProviderInfo[] = [
  {
    id: 'google',
    name: 'Google Calendar',
    icon: '🗓️',
    color: '#4285F4',
    authHint: 'Requires VITE_GOOGLE_CLIENT_ID + OAuth consent screen',
  },
  {
    id: 'outlook',
    name: 'Microsoft Outlook',
    icon: '📧',
    color: '#0078D4',
    authHint: 'Requires VITE_MSAL_CLIENT_ID + Azure AD app registration',
  },
  {
    id: 'apple',
    name: 'Apple Calendar',
    icon: '🍎',
    color: '#666',
    authHint: 'Requires CalDAV server URL + Apple ID app-specific password',
  },
  {
    id: 'ical',
    name: 'iCal / URL Feed',
    icon: '📆',
    color: '#16a34a',
    authHint: 'Paste a public or private .ics subscription URL',
  },
];

// ── Service ───────────────────────────────────────────────────────────────────

let _connections: CalendarConnection[] = [];
let _externalEvents: ExternalCalendarEvent[] = [];

export const calendarSyncService = {
  /**
   * Connect a new calendar provider.
   * In production: kick off provider-specific OAuth2 flow (popup/redirect),
   * exchange code for tokens, store refresh token in backend key vault.
   */
  async connect(provider: ExternalCalendarProvider, accountEmail: string): Promise<CalendarConnection> {
    if (USE_MOCK) {
      await delay(1200);

      const providerInfo = CALENDAR_PROVIDERS.find((p) => p.id === provider)!;
      const connection: CalendarConnection = {
        id: `conn-${provider}-${Date.now()}`,
        provider,
        accountEmail,
        calendarName: provider === 'google' ? 'My Calendar' :
          provider === 'outlook' ? 'Calendar' :
          provider === 'apple' ? 'iCloud Calendar' : 'Subscribed Calendar',
        connectedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'success',
        color: providerInfo.color,
      };

      _connections = [..._connections.filter((c) => c.provider !== provider), connection];
      _externalEvents = buildMockExternalEvents(_connections);
      return connection;
    }

    // ── Production: Google ────────────────────────────────────────────────────
    // const { google } = await import('../lib/googleAuth');
    // const tokens = await google.signIn(['https://www.googleapis.com/auth/calendar.readonly']);
    // await api.post('/calendar/connect', { provider: 'google', tokens, accountEmail });
    // return api.get<CalendarConnection>(`/calendar/connections/${provider}`);

    // ── Production: Outlook ───────────────────────────────────────────────────
    // const { msalClient } = await import('../lib/msalAuth');
    // const result = await msalClient.acquireTokenPopup({ scopes: ['Calendars.ReadWrite'] });
    // await api.post('/calendar/connect', { provider: 'outlook', tokens: result, accountEmail });
    // return api.get<CalendarConnection>(`/calendar/connections/${provider}`);

    throw new Error('Production OAuth not configured. Set VITE_USE_MOCK=false and configure provider credentials.');
  },

  /** Disconnect and revoke access for a provider */
  async disconnect(connectionId: string): Promise<void> {
    if (USE_MOCK) {
      await delay(600);
      _connections = _connections.filter((c) => c.id !== connectionId);
      _externalEvents = buildMockExternalEvents(_connections);
      return;
    }
    // await api.delete(`/calendar/connections/${connectionId}`);
  },

  /** Trigger a manual sync — pulls latest events from all connected providers */
  async syncAll(): Promise<ExternalCalendarEvent[]> {
    if (USE_MOCK) {
      await delay(1500);
      _connections = _connections.map((c) => ({
        ...c,
        syncStatus: 'success' as const,
        lastSyncedAt: new Date().toISOString(),
      }));
      _externalEvents = buildMockExternalEvents(_connections);
      return _externalEvents;
    }
    // const results = await api.post<ExternalCalendarEvent[]>('/calendar/sync');
    // return results.data;
    return [];
  },

  /** Get all current connections */
  async getConnections(): Promise<CalendarConnection[]> {
    if (USE_MOCK) {
      await delay(200);
      return [..._connections];
    }
    // return api.get<CalendarConnection[]>('/calendar/connections').then(r => r.data);
    return [];
  },

  /** Get all external events (used to block time on the calendar) */
  async getExternalEvents(): Promise<ExternalCalendarEvent[]> {
    if (USE_MOCK) {
      await delay(200);
      return [..._externalEvents];
    }
    // return api.get<ExternalCalendarEvent[]>('/calendar/events').then(r => r.data);
    return [];
  },

  /**
   * Push a confirmed booking to all connected external calendars.
   * This is the "write" side of two-way sync — creates an event in each
   * connected provider so the user's external calendar shows the appointment.
   */
  async pushBookingToExternalCalendars(
    bookingId: string,
    summary: string,
    start: string,
    end: string,
  ): Promise<void> {
    if (USE_MOCK) {
      // Mock: just log it — no actual external call
      console.info('[CalendarSync] Mock push to external calendars:', { bookingId, summary, start, end });
      return;
    }

    // ── Production: push to each connected provider ───────────────────────────
    // for (const conn of await this.getConnections()) {
    //   if (conn.provider === 'google') {
    //     await api.post('/calendar/events/push', { provider: 'google', summary, start, end });
    //   } else if (conn.provider === 'outlook') {
    //     await api.post('/calendar/events/push', { provider: 'outlook', subject: summary, start, end });
    //   }
    // }
  },

  /**
   * Check if a given time window overlaps with any external calendar event.
   * Used server-side (or client-side in mock) to prevent double-booking.
   */
  isTimeBlocked(start: Date, end: Date, events: ExternalCalendarEvent[]): boolean {
    return events.some((e) => {
      const eStart = new Date(e.start);
      const eEnd = new Date(e.end);
      // Overlap: not (end <= eStart || start >= eEnd)
      return !(end <= eStart || start >= eEnd);
    });
  },

  getConnectedProviders(): ExternalCalendarProvider[] {
    return _connections.map((c) => c.provider);
  },
};

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
