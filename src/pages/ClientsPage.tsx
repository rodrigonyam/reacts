import { useEffect, useMemo, useState } from 'react';
import { format, parseISO, differenceInYears } from 'date-fns';
import { useBookingStore } from '../store/bookingStore';
import { searchClients, clientFullName } from '../services/clientService';
import type { Client, ClientStatus } from '../types';

// ── Sub-components ────────────────────────────────────────────────────────────

type TabKey = 'info' | 'notes' | 'history';

function StatusBadge({ status }: { status: ClientStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        status === 'active'
          ? 'bg-green-100 text-green-700'
          : 'bg-gray-100 text-gray-500'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
      {status === 'active' ? 'Active' : 'Inactive'}
    </span>
  );
}

function TagChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">
      {label}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 text-sky-400 hover:text-sky-700">×</button>
      )}
    </span>
  );
}

// ── Client Form Modal ─────────────────────────────────────────────────────────

interface ClientFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  tags: string;           // comma-separated
  status: ClientStatus;
}

const EMPTY_FORM: ClientFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  address: '',
  emergencyContact: '',
  emergencyPhone: '',
  tags: '',
  status: 'active',
};

function clientToForm(c: Client): ClientFormData {
  return {
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone ?? '',
    dateOfBirth: c.dateOfBirth ?? '',
    address: c.address ?? '',
    emergencyContact: c.emergencyContact ?? '',
    emergencyPhone: c.emergencyPhone ?? '',
    tags: c.tags.join(', '),
    status: c.status,
  };
}

interface ClientModalProps {
  existing?: Client;
  onSave: (data: ClientFormData) => void;
  onClose: () => void;
}

function ClientModal({ existing, onSave, onClose }: ClientModalProps) {
  const [form, setForm] = useState<ClientFormData>(existing ? clientToForm(existing) : EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<ClientFormData>>({});

  function field(key: keyof ClientFormData, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  }

  function validate(): boolean {
    const e: Partial<ClientFormData> = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim()) e.lastName = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (validate()) onSave(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            {existing ? 'Edit Client' : 'Add New Client'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto px-6 py-4 space-y-4">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First name *</label>
              <input
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.firstName ? 'border-red-400' : 'border-gray-200'}`}
                value={form.firstName}
                onChange={(e) => field('firstName', e.target.value)}
              />
              {errors.firstName && <p className="mt-0.5 text-xs text-red-500">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last name *</label>
              <input
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.lastName ? 'border-red-400' : 'border-gray-200'}`}
                value={form.lastName}
                onChange={(e) => field('lastName', e.target.value)}
              />
              {errors.lastName && <p className="mt-0.5 text-xs text-red-500">{errors.lastName}</p>}
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
              <input
                type="email"
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.email ? 'border-red-400' : 'border-gray-200'}`}
                value={form.email}
                onChange={(e) => field('email', e.target.value)}
              />
              {errors.email && <p className="mt-0.5 text-xs text-red-500">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={form.phone}
                onChange={(e) => field('phone', e.target.value)}
              />
            </div>
          </div>

          {/* DOB + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date of birth</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={form.dateOfBirth}
                onChange={(e) => field('dateOfBirth', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={form.status}
                onChange={(e) => field('status', e.target.value as ClientStatus)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={form.address}
              onChange={(e) => field('address', e.target.value)}
            />
          </div>

          {/* Emergency contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Emergency contact</label>
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Name (Relationship)"
                value={form.emergencyContact}
                onChange={(e) => field('emergencyContact', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Emergency phone</label>
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={form.emergencyPhone}
                onChange={(e) => field('emergencyPhone', e.target.value)}
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tags <span className="text-gray-400">(comma-separated)</span></label>
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="e.g. VIP, mobility-issues, morning-pref"
              value={form.tags}
              onChange={(e) => field('tags', e.target.value)}
            />
          </div>
        </form>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            {existing ? 'Save changes' : 'Add client'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail Panel ───────────────────────────────────────────────────────────────

function DetailPanel({
  client,
  onEdit,
  onDelete,
}: {
  client: Client;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { bookings, addClientNote, deleteClientNote, editClientNote, updateClient } = useBookingStore();
  const [tab, setTab] = useState<TabKey>('info');
  const [noteText, setNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newTag, setNewTag] = useState('');

  const clientBookings = useMemo(
    () => bookings.filter((b) => b.userId === client.userId || b.user?.email === client.email),
    [bookings, client],
  );

  const age = client.dateOfBirth
    ? differenceInYears(new Date(), parseISO(client.dateOfBirth))
    : null;

  function handleAddNote() {
    if (!noteText.trim()) return;
    addClientNote(client.id, noteText);
    setNoteText('');
  }

  function handleSaveEditNote() {
    if (!editingNoteId || !editNoteText.trim()) return;
    editClientNote(client.id, editingNoteId, editNoteText);
    setEditingNoteId(null);
    setEditNoteText('');
  }

  function handleAddTag() {
    const tag = newTag.trim().toLowerCase().replace(/\s+/g, '-');
    if (!tag || client.tags.includes(tag)) { setNewTag(''); return; }
    updateClient(client.id, { tags: [...client.tags, tag] });
    setNewTag('');
  }

  function handleRemoveTag(tag: string) {
    updateClient(client.id, { tags: client.tags.filter((t) => t !== tag) });
  }

  const statusColor: Record<string, string> = {
    confirmed: 'text-green-700 bg-green-50',
    pending: 'text-amber-700 bg-amber-50',
    cancelled: 'text-red-700 bg-red-50',
    completed: 'text-sky-700 bg-sky-50',
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-base font-bold text-sky-700">
              {client.firstName[0]}{client.lastName[0]}
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">{clientFullName(client)}</h2>
              <p className="text-xs text-gray-500">{client.email}</p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 items-center">
            <StatusBadge status={client.status} />
            {age !== null && (
              <span className="text-xs text-gray-500">Age {age}</span>
            )}
            <span className="text-xs text-gray-400">
              Client since {format(parseISO(client.createdAt), 'MMM yyyy')}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            ✏️ Edit
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 px-6 pt-2">
        {(['info', 'notes', 'history'] as TabKey[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
            {t === 'notes' && client.notes.length > 0 && (
              <span className="ml-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600">
                {client.notes.length}
              </span>
            )}
            {t === 'history' && clientBookings.length > 0 && (
              <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                {clientBookings.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* INFO TAB */}
        {tab === 'info' && (
          <div className="space-y-5">
            <Section title="Contact Information">
              <InfoRow label="Email" value={client.email} />
              <InfoRow label="Phone" value={client.phone ?? '—'} />
              <InfoRow label="Date of birth" value={client.dateOfBirth ? `${format(parseISO(client.dateOfBirth), 'MMMM d, yyyy')} (age ${age})` : '—'} />
              <InfoRow label="Address" value={client.address ?? '—'} />
            </Section>

            <Section title="Emergency Contact">
              <InfoRow label="Name / Relation" value={client.emergencyContact ?? '—'} />
              <InfoRow label="Phone" value={client.emergencyPhone ?? '—'} />
            </Section>

            <Section title="Tags">
              <div className="flex flex-wrap gap-2 items-center">
                {client.tags.map((tag) => (
                  <TagChip key={tag} label={tag} onRemove={() => handleRemoveTag(tag)} />
                ))}
                <div className="flex items-center gap-1">
                  <input
                    className="rounded-md border border-gray-200 px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-sky-400"
                    placeholder="add-tag"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                  />
                  <button
                    onClick={handleAddTag}
                    className="rounded-md bg-sky-50 px-2 py-1 text-xs text-sky-700 hover:bg-sky-100"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </Section>

            <div className="text-xs text-gray-400">
              Last updated {format(parseISO(client.updatedAt), 'MMM d, yyyy')}
            </div>
          </div>
        )}

        {/* NOTES TAB */}
        {tab === 'notes' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">Private notes — visible only to you.</p>

            {/* Add note */}
            <div className="rounded-lg border border-gray-200 p-3">
              <textarea
                rows={3}
                className="w-full resize-none text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
                placeholder="Add a note about this client…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleAddNote}
                  disabled={!noteText.trim()}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-40"
                >
                  Save note
                </button>
              </div>
            </div>

            {/* Notes list */}
            {client.notes.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No notes yet.</p>
            )}
            {client.notes.map((note) => (
              <div key={note.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                {editingNoteId === note.id ? (
                  <>
                    <textarea
                      rows={3}
                      className="w-full resize-none rounded border border-sky-300 bg-white p-2 text-sm focus:outline-none"
                      value={editNoteText}
                      onChange={(e) => setEditNoteText(e.target.value)}
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleSaveEditNote}
                        className="rounded bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingNoteId(null)}
                        className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">
                        {format(parseISO(note.updatedAt ?? note.createdAt), 'MMM d, yyyy · h:mm a')}
                        {note.updatedAt ? ' (edited)' : ''}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setEditingNoteId(note.id); setEditNoteText(note.content); }}
                          className="text-xs text-sky-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteClientNote(client.id, note.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div className="space-y-3">
            {clientBookings.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No booking history found for this client.</p>
            )}
            {clientBookings.map((b) => (
              <div key={b.id} className="flex items-start justify-between rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{b.service?.name ?? 'Unknown service'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {b.slot
                      ? `${format(parseISO(b.slot.date), 'MMM d, yyyy')} · ${b.slot.startTime} – ${b.slot.endTime}`
                      : 'Date unknown'
                    }
                  </p>
                  {b.payment?.amount && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      ${(b.payment.amount / 100).toFixed(2)} · {b.payment.status}
                    </p>
                  )}
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[b.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {b.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="border-t border-red-100 bg-red-50 px-6 py-4">
          <p className="text-sm font-medium text-red-800">Delete {clientFullName(client)}?</p>
          <p className="text-xs text-red-600 mt-1">This will permanently remove the client record and all notes.</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={onDelete}
              className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Yes, delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg border border-gray-200 px-4 py-1.5 text-xs text-gray-600 hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-32 shrink-0 text-gray-500">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ClientsPage() {
  const {
    clients,
    fetchClients,
    fetchBookings,
    addClient,
    updateClient,
  } = useBookingStore();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | ClientStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>(undefined);

  useEffect(() => {
    fetchClients();
    fetchBookings();
  }, [fetchClients, fetchBookings]);

  const filtered = useMemo(() => {
    let list = searchClients(clients, search);
    if (filterStatus !== 'all') list = list.filter((c) => c.status === filterStatus);
    return list.sort((a, b) => a.lastName.localeCompare(b.lastName));
  }, [clients, search, filterStatus]);

  const selected = useMemo(
    () => clients.find((c) => c.id === selectedId) ?? null,
    [clients, selectedId],
  );

  function handleSave(data: ReturnType<typeof clientToForm>) {
    const tags = data.tags
      .split(',')
      .map((t) => t.trim().toLowerCase().replace(/\s+/g, '-'))
      .filter(Boolean);

    const payload = {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.trim(),
      phone: data.phone.trim() || undefined,
      dateOfBirth: data.dateOfBirth || undefined,
      address: data.address.trim() || undefined,
      emergencyContact: data.emergencyContact.trim() || undefined,
      emergencyPhone: data.emergencyPhone.trim() || undefined,
      tags,
      status: data.status,
    };

    if (editingClient) {
      updateClient(editingClient.id, payload);
    } else {
      addClient(payload);
    }
    setShowModal(false);
    setEditingClient(undefined);
  }

  function handleDelete() {
    const { deleteClient } = useBookingStore.getState();
    if (selectedId) {
      deleteClient(selectedId);
      setSelectedId(null);
    }
  }

  function openAdd() {
    setEditingClient(undefined);
    setShowModal(true);
  }

  function openEdit(client: Client) {
    setEditingClient(client);
    setShowModal(true);
  }

  const activeCount = clients.filter((c) => c.status === 'active').length;
  const inactiveCount = clients.filter((c) => c.status === 'inactive').length;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50">
      {/* Page header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Client Database</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {activeCount} active · {inactiveCount} inactive · {clients.length} total
            </p>
          </div>
          <button
            onClick={openAdd}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            + Add Client
          </button>
        </div>

        {/* Search + filter */}
        <div className="mt-3 flex gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Search by name, email, phone, or tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | ClientStatus)}
          >
            <option value="all">All clients</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </div>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Client list */}
        <div className="w-72 shrink-0 overflow-y-auto border-r border-gray-200 bg-white">
          {filtered.length === 0 && (
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-gray-400">
                {search ? 'No clients match your search.' : 'No clients yet.'}
              </p>
              {!search && (
                <button onClick={openAdd} className="mt-3 text-sm text-sky-600 hover:underline">
                  Add your first client
                </button>
              )}
            </div>
          )}
          {filtered.map((client) => (
            <button
              key={client.id}
              onClick={() => setSelectedId(client.id)}
              className={`w-full border-b border-gray-50 px-4 py-3 text-left transition-colors ${
                selectedId === client.id ? 'bg-sky-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  client.status === 'active' ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {client.firstName[0]}{client.lastName[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{clientFullName(client)}</p>
                  <p className="truncate text-xs text-gray-500">{client.email}</p>
                </div>
                <StatusBadge status={client.status} />
              </div>
              {client.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1 pl-12">
                  {client.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                      {tag}
                    </span>
                  ))}
                  {client.tags.length > 3 && (
                    <span className="text-[10px] text-gray-400">+{client.tags.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-hidden">
          {selected ? (
            <DetailPanel
              client={selected}
              onEdit={() => openEdit(selected)}
              onDelete={handleDelete}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-4xl mb-3">👤</p>
                <p className="text-sm font-medium text-gray-500">Select a client to view their record</p>
                <p className="text-xs text-gray-400 mt-1">or add a new client with the button above</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit modal */}
      {showModal && (
        <ClientModal
          existing={editingClient}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingClient(undefined); }}
        />
      )}
    </div>
  );
}
