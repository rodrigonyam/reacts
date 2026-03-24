/**
 * clientService.ts
 * Manages the client database — localStorage-backed CRUD.
 * Sensitive fields (notes, DOB, emergencyContact) never leave the browser.
 */
import type { Client, ClientNote } from '../types';

export const CLIENT_STORAGE_KEY = 'sos_clients';

// ── Persistence ───────────────────────────────────────────────────────────────

export function loadClients(): Client[] {
  try {
    const raw = localStorage.getItem(CLIENT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Client[];
  } catch {
    return [];
  }
}

export function saveClients(clients: Client[]): void {
  localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(clients));
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function addClient(clients: Client[], data: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'notes'>): Client[] {
  const now = new Date().toISOString();
  const newClient: Client = {
    ...data,
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    notes: [],
    createdAt: now,
    updatedAt: now,
  };
  const updated = [newClient, ...clients];
  saveClients(updated);
  return updated;
}

export function updateClient(clients: Client[], id: string, changes: Partial<Omit<Client, 'id' | 'createdAt'>>): Client[] {
  const updated = clients.map((c) =>
    c.id === id ? { ...c, ...changes, updatedAt: new Date().toISOString() } : c,
  );
  saveClients(updated);
  return updated;
}

export function deleteClient(clients: Client[], id: string): Client[] {
  const updated = clients.filter((c) => c.id !== id);
  saveClients(updated);
  return updated;
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export function addNote(clients: Client[], clientId: string, content: string): Client[] {
  const now = new Date().toISOString();
  const note: ClientNote = {
    id: `n-${Date.now()}`,
    content: content.trim(),
    createdAt: now,
  };
  return updateClient(clients, clientId, {
    notes: [
      note,
      ...(clients.find((c) => c.id === clientId)?.notes ?? []),
    ],
  });
}

export function deleteNote(clients: Client[], clientId: string, noteId: string): Client[] {
  const client = clients.find((c) => c.id === clientId);
  if (!client) return clients;
  return updateClient(clients, clientId, {
    notes: client.notes.filter((n) => n.id !== noteId),
  });
}

export function editNote(clients: Client[], clientId: string, noteId: string, content: string): Client[] {
  const client = clients.find((c) => c.id === clientId);
  if (!client) return clients;
  return updateClient(clients, clientId, {
    notes: client.notes.map((n) =>
      n.id === noteId
        ? { ...n, content: content.trim(), updatedAt: new Date().toISOString() }
        : n,
    ),
  });
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function searchClients(clients: Client[], query: string): Client[] {
  const q = query.toLowerCase().trim();
  if (!q) return clients;
  return clients.filter(
    (c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

/** Full name helper */
export function clientFullName(c: Client): string {
  return `${c.firstName} ${c.lastName}`.trim();
}
