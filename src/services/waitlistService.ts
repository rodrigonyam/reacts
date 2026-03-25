import type { WaitlistEntry, WaitlistSettings, WaitlistStatus } from '../types';

const ENTRIES_KEY = 'sos_waitlist_entries';
const SETTINGS_KEY = 'sos_waitlist_settings';

const DEFAULT_SETTINGS: WaitlistSettings = {
  enabled: true,
  notificationWindowHours: 2,
  maxPerSlot: 10,
  autoNotify: true,
  notificationMessage:
    'Great news! A spot has opened up for your appointment on {date} at {time}. ' +
    'You have {hours} hours to book before the next person is notified.',
};

// ── Persistence ───────────────────────────────────────────────────────────────

export function loadWaitlistSettings(): WaitlistSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveWaitlistSettings(settings: WaitlistSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadWaitlistEntries(): WaitlistEntry[] {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveWaitlistEntries(entries: WaitlistEntry[]): void {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function getWaitlistForSlot(slotId: string): WaitlistEntry[] {
  return loadWaitlistEntries()
    .filter((e) => e.slotId === slotId)
    .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
}

export function getWaitlistPosition(slotId: string, email: string): number | null {
  const queue = getWaitlistForSlot(slotId).filter((e) => e.status === 'waiting');
  const idx = queue.findIndex((e) => e.clientEmail.toLowerCase() === email.toLowerCase());
  return idx === -1 ? null : idx + 1;
}

export function isAlreadyOnWaitlist(slotId: string, email: string): boolean {
  return loadWaitlistEntries().some(
    (e) =>
      e.slotId === slotId &&
      e.clientEmail.toLowerCase() === email.toLowerCase() &&
      (e.status === 'waiting' || e.status === 'notified'),
  );
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function addToWaitlist(
  entry: Omit<WaitlistEntry, 'id' | 'position' | 'joinedAt' | 'status'>,
): WaitlistEntry {
  const settings = loadWaitlistSettings();
  const entries = loadWaitlistEntries();
  const slotQueue = entries.filter((e) => e.slotId === entry.slotId && e.status === 'waiting');

  if (slotQueue.length >= settings.maxPerSlot) {
    throw new Error(`Waitlist for this slot is full (max ${settings.maxPerSlot})`);
  }

  const position = slotQueue.length + 1;
  const newEntry: WaitlistEntry = {
    ...entry,
    id: `wl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: 'waiting',
    position,
    joinedAt: new Date().toISOString(),
  };

  saveWaitlistEntries([...entries, newEntry]);
  return newEntry;
}

export function removeFromWaitlist(entryId: string): void {
  const entries = loadWaitlistEntries();
  const removed = entries.find((e) => e.id === entryId);
  if (!removed) return;

  const remaining = entries.filter((e) => e.id !== entryId);

  // Re-number positions within the same slot for 'waiting' entries
  const renumbered = remaining.map((e) => {
    if (e.slotId !== removed.slotId || e.status !== 'waiting') return e;
    const queuePos =
      remaining
        .filter((x) => x.slotId === removed.slotId && x.status === 'waiting')
        .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())
        .findIndex((x) => x.id === e.id) + 1;
    return { ...e, position: queuePos };
  });

  saveWaitlistEntries(renumbered);
}

export function claimSpot(entryId: string): void {
  const entries = loadWaitlistEntries();
  saveWaitlistEntries(
    entries.map((e) =>
      e.id === entryId
        ? { ...e, status: 'claimed' as WaitlistStatus, claimedAt: new Date().toISOString() }
        : e,
    ),
  );
}

export function updateEntryStatus(entryId: string, status: WaitlistStatus): void {
  const entries = loadWaitlistEntries();
  saveWaitlistEntries(entries.map((e) => (e.id === entryId ? { ...e, status } : e)));
}

// ── Notification logic ────────────────────────────────────────────────────────

/**
 * Marks the next 'waiting' entry for a slot as 'notified' and sets the claim window.
 * Returns the notified entry, or null if no one is waiting.
 */
export function notifyNextInQueue(slotId: string): WaitlistEntry | null {
  const settings = loadWaitlistSettings();
  const entries = loadWaitlistEntries();

  const next = entries
    .filter((e) => e.slotId === slotId && e.status === 'waiting')
    .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())[0];

  if (!next) return null;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + settings.notificationWindowHours * 60 * 60 * 1000).toISOString();

  const updated: WaitlistEntry = {
    ...next,
    status: 'notified',
    notifiedAt: now.toISOString(),
    expiresAt,
  };

  saveWaitlistEntries(entries.map((e) => (e.id === next.id ? updated : e)));
  return updated;
}

/**
 * Called when a booking on a slot is cancelled or rescheduled away.
 * If autoNotify is enabled, notifies the next person in the waitlist.
 */
export function onSlotOpened(slotId: string): WaitlistEntry | null {
  const settings = loadWaitlistSettings();
  if (!settings.enabled || !settings.autoNotify) return null;
  return notifyNextInQueue(slotId);
}

/**
 * Checks for 'notified' entries whose claim window has expired,
 * marks them 'expired', and triggers notification for the next person.
 */
export function expireStaleNotifications(): void {
  const entries = loadWaitlistEntries();
  const now = new Date();
  const expiredIds: string[] = [];

  const updated = entries.map((e) => {
    if (e.status === 'notified' && e.expiresAt && new Date(e.expiresAt) < now) {
      expiredIds.push(e.id);
      return { ...e, status: 'expired' as WaitlistStatus };
    }
    return e;
  });

  saveWaitlistEntries(updated);

  // For each expired notification, try to notify the next person
  const expiredSlots = [...new Set(expiredIds.map((id) => entries.find((e) => e.id === id)?.slotId).filter(Boolean))] as string[];
  expiredSlots.forEach((slotId) => notifyNextInQueue(slotId));
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface WaitlistStats {
  totalWaiting: number;
  totalNotified: number;
  totalClaimed: number;
  totalExpired: number;
  bySlot: Record<string, { waiting: number; notified: number; claimed: number; expired: number }>;
}

export function getWaitlistStats(): WaitlistStats {
  const entries = loadWaitlistEntries();
  const bySlot: WaitlistStats['bySlot'] = {};

  for (const e of entries) {
    if (!bySlot[e.slotId]) bySlot[e.slotId] = { waiting: 0, notified: 0, claimed: 0, expired: 0 };
    bySlot[e.slotId][e.status]++;
  }

  return {
    totalWaiting: entries.filter((e) => e.status === 'waiting').length,
    totalNotified: entries.filter((e) => e.status === 'notified').length,
    totalClaimed: entries.filter((e) => e.status === 'claimed').length,
    totalExpired: entries.filter((e) => e.status === 'expired').length,
    bySlot,
  };
}
