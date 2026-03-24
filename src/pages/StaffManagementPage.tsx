import { useState, useMemo, useEffect } from 'react';
import { useBookingStore } from '../store/bookingStore';
import type { StaffMember, StaffRole, StaffStatus, StaffAvailabilitySlot, Service } from '../types';
import toast from 'react-hot-toast';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: 'provider',     label: 'Provider' },
  { value: 'instructor',   label: 'Instructor' },
  { value: 'admin',        label: 'Admin' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'support',      label: 'Support' },
];

const ROLE_BADGE: Record<StaffRole, string> = {
  provider:     'bg-purple-100 text-purple-700',
  instructor:   'bg-emerald-100 text-emerald-700',
  admin:        'bg-sky-100 text-sky-700',
  receptionist: 'bg-orange-100 text-orange-700',
  support:      'bg-gray-100 text-gray-600',
};

const STATUS_BADGE: Record<StaffStatus, string> = {
  active:    'bg-green-100 text-green-700',
  inactive:  'bg-gray-100 text-gray-500',
  'on-leave':'bg-yellow-100 text-yellow-700',
};

const STATUS_DOT: Record<StaffStatus, string> = {
  active:    'bg-green-400',
  inactive:  'bg-gray-300',
  'on-leave':'bg-yellow-400',
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const COLOR_OPTIONS = [
  '#7c3aed', '#0284c7', '#059669', '#db2777',
  '#d97706', '#dc2626', '#0891b2', '#65a30d',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

type AvailRow = { enabled: boolean; startTime: string; endTime: string };
type AvailState = Record<number, AvailRow>;

function toAvailState(slots: StaffAvailabilitySlot[]): AvailState {
  const state: AvailState = {};
  for (let i = 0; i < 7; i++) {
    const slot = slots.find((s) => s.dayOfWeek === i);
    state[i] = slot
      ? { enabled: true, startTime: slot.startTime, endTime: slot.endTime }
      : { enabled: false, startTime: '09:00', endTime: '17:00' };
  }
  return state;
}

function fromAvailState(state: AvailState): StaffAvailabilitySlot[] {
  return Object.entries(state)
    .filter(([, row]) => row.enabled)
    .map(([day, row]) => ({
      dayOfWeek: Number(day),
      startTime: row.startTime,
      endTime: row.endTime,
    }));
}

function slotHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return (eh + em / 60) - (sh + sm / 60);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ member, size = 'md' }: { member: StaffMember; size?: 'sm' | 'md' | 'lg' }) {
  const initials = `${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`.toUpperCase();
  const cls =
    size === 'sm' ? 'h-8 w-8 text-xs'
    : size === 'lg' ? 'h-16 w-16 text-xl'
    : 'h-10 w-10 text-sm';
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${cls}`}
      style={{ backgroundColor: member.color }}
    >
      {initials}
    </div>
  );
}

function RoleBadge({ role }: { role: StaffRole }) {
  const label = role.charAt(0).toUpperCase() + role.slice(1);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[role]}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: StaffStatus }) {
  const label = status === 'on-leave' ? 'On Leave' : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {label}
    </span>
  );
}

// ── Availability Builder ──────────────────────────────────────────────────────

function AvailabilityBuilder({ value, onChange }: { value: AvailState; onChange: (v: AvailState) => void }) {
  return (
    <div className="space-y-2">
      {DOW.map((label, i) => {
        const row = value[i];
        return (
          <div key={i} className="flex items-center gap-3">
            <label className="flex w-28 shrink-0 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(e) => onChange({ ...value, [i]: { ...row, enabled: e.target.checked } })}
                className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              />
              <span className={`text-sm font-medium ${row.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                {label}
              </span>
            </label>
            {row.enabled ? (
              <>
                <input
                  type="time"
                  value={row.startTime}
                  onChange={(e) => onChange({ ...value, [i]: { ...row, startTime: e.target.value } })}
                  className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <span className="text-sm text-gray-500">to</span>
                <input
                  type="time"
                  value={row.endTime}
                  onChange={(e) => onChange({ ...value, [i]: { ...row, endTime: e.target.value } })}
                  className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </>
            ) : (
              <span className="text-sm italic text-gray-400">Unavailable</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Staff Modal ───────────────────────────────────────────────────────────────

type ModalMode = 'add' | 'edit';
type StaffFormData = Omit<StaffMember, 'id' | 'createdAt' | 'updatedAt'>;

const BLANK_FORM: StaffFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: 'provider',
  bio: '',
  serviceIds: [],
  availability: [],
  status: 'active',
  hireDate: '',
  color: '#7c3aed',
  notes: '',
};

interface StaffModalProps {
  mode: ModalMode;
  initial?: StaffMember;
  services: Service[];
  onSave: (data: StaffFormData) => void;
  onClose: () => void;
}

function StaffModal({ mode, initial, services, onSave, onClose }: StaffModalProps) {
  const [form, setForm] = useState<StaffFormData>(
    initial
      ? {
          firstName: initial.firstName,
          lastName: initial.lastName,
          email: initial.email,
          phone: initial.phone ?? '',
          role: initial.role,
          bio: initial.bio ?? '',
          serviceIds: initial.serviceIds,
          availability: initial.availability,
          status: initial.status,
          hireDate: initial.hireDate ?? '',
          color: initial.color,
          notes: initial.notes ?? '',
        }
      : { ...BLANK_FORM },
  );
  const [availState, setAvailState] = useState<AvailState>(toAvailState(form.availability));
  const [errors, setErrors] = useState<Partial<Record<'firstName' | 'lastName' | 'email', string>>>({});

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim()) e.lastName = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    onSave({ ...form, availability: fromAvailState(availState) });
  }

  function toggleService(serviceId: string) {
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(serviceId)
        ? f.serviceIds.filter((id) => id !== serviceId)
        : [...f.serviceIds, serviceId],
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === 'add' ? '➕ Add Staff Member' : '✏️ Edit Staff Member'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.firstName ? 'border-red-400' : 'border-gray-300'}`}
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                placeholder="First name"
              />
              {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.lastName ? 'border-red-400' : 'border-gray-300'}`}
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                placeholder="Last name"
              />
              {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>}
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.email ? 'border-red-400' : 'border-gray-300'}`}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="name@example.com"
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="555-0100"
              />
            </div>
          </div>

          {/* Role / Status / Hire Date */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as StaffRole }))}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as StaffStatus }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on-leave">On Leave</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Hire Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={form.hireDate}
                onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))}
              />
            </div>
          </div>

          {/* Calendar color */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Calendar Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className={`h-7 w-7 rounded-full transition-transform ${
                    form.color === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Bio</label>
            <textarea
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              placeholder="Professional background and specializations..."
            />
          </div>

          {/* Services */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Assigned Services</label>
            {services.length === 0 ? (
              <p className="text-sm italic text-gray-400">No services available</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {services.map((svc) => {
                  const selected = form.serviceIds.includes(svc.id);
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => toggleService(svc.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-sky-500 bg-sky-50 text-sky-700'
                          : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {selected && '✓ '}{svc.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Weekly Availability */}
          <div>
            <label className="mb-3 block text-sm font-medium text-gray-700">Weekly Availability</label>
            <AvailabilityBuilder value={availState} onChange={setAvailState} />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Internal Notes</label>
            <textarea
              rows={2}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Private admin notes..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 transition-colors"
          >
            {mode === 'add' ? 'Add Staff Member' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab components ────────────────────────────────────────────────────────────

function ProfileTab({ member }: { member: StaffMember }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Contact & Details</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5">
          <dt className="text-xs text-gray-500">Email</dt>
          <dd className="text-sm text-gray-900">{member.email}</dd>
          {member.phone && (
            <>
              <dt className="text-xs text-gray-500">Phone</dt>
              <dd className="text-sm text-gray-900">{member.phone}</dd>
            </>
          )}
          {member.hireDate && (
            <>
              <dt className="text-xs text-gray-500">Hired</dt>
              <dd className="text-sm text-gray-900">
                {new Date(member.hireDate + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })}
              </dd>
            </>
          )}
          <dt className="text-xs text-gray-500">Added</dt>
          <dd className="text-sm text-gray-900">
            {new Date(member.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </dd>
          <dt className="text-xs text-gray-500">Updated</dt>
          <dd className="text-sm text-gray-900">
            {new Date(member.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </dd>
        </dl>
      </div>

      {member.bio && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Bio</h3>
          <p className="text-sm leading-relaxed text-gray-700">{member.bio}</p>
        </div>
      )}

      {member.notes && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">Internal Notes</h3>
          <p className="text-sm leading-relaxed text-amber-800">{member.notes}</p>
        </div>
      )}
    </div>
  );
}

function ServicesTab({ services, allCount }: { services: Service[]; allCount: number }) {
  if (services.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="mb-3 text-4xl">🎯</span>
        <p className="font-medium text-gray-700">No services assigned</p>
        <p className="mt-1 text-sm text-gray-400">Edit this staff member to assign services</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        {services.length} of {allCount} service{allCount !== 1 ? 's' : ''} assigned
      </p>
      {services.map((svc) => (
        <div key={svc.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: svc.color }}
          >
            {svc.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">{svc.name}</p>
            <p className="mt-0.5 text-xs text-gray-500">{svc.description}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-gray-900">${svc.price}</p>
            <p className="text-xs text-gray-500">{svc.durationMinutes} min</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AvailabilityTab({ member }: { member: StaffMember }) {
  const byDay = Object.fromEntries(member.availability.map((s) => [s.dayOfWeek, s]));
  const totalHours = member.availability.reduce(
    (sum, s) => sum + slotHours(s.startTime, s.endTime),
    0,
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        {member.availability.length} day{member.availability.length !== 1 ? 's' : ''} per week
        {totalHours > 0 && ` · ~${Math.round(totalHours)} hrs/week`}
      </p>
      {DOW.map((label, i) => {
        const slot = byDay[i];
        return (
          <div
            key={i}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
              slot ? 'border-sky-100 bg-sky-50' : 'border-gray-100 bg-white'
            }`}
          >
            <span className={`w-10 shrink-0 text-sm font-semibold ${slot ? 'text-sky-700' : 'text-gray-300'}`}>
              {label}
            </span>
            {slot ? (
              <>
                <span className="text-sm font-medium text-sky-800">{slot.startTime}</span>
                <span className="text-xs text-sky-400">→</span>
                <span className="text-sm font-medium text-sky-800">{slot.endTime}</span>
                <span className="ml-auto text-xs text-sky-500">
                  {(() => {
                    const h = slotHours(slot.startTime, slot.endTime);
                    return `${h % 1 === 0 ? h : h.toFixed(1)} hrs`;
                  })()}
                </span>
              </>
            ) : (
              <span className="text-sm italic text-gray-400">Not available</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

type DetailTab = 'profile' | 'services' | 'availability';

interface DetailPanelProps {
  member: StaffMember;
  services: Service[];
  onEdit: () => void;
  onDelete: () => void;
}

function DetailPanel({ member, services, onEdit, onDelete }: DetailPanelProps) {
  const [tab, setTab] = useState<DetailTab>('profile');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const assignedServices = services.filter((s) => member.serviceIds.includes(s.id));
  const yearsActive = member.hireDate
    ? Math.floor((Date.now() - new Date(member.hireDate).getTime()) / (1000 * 60 * 60 * 24 * 365))
    : null;

  return (
    <div className="flex h-full flex-col">
      {/* Profile header */}
      <div className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="mb-4 flex items-start gap-4">
          <Avatar member={member} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-bold text-gray-900">
              {member.firstName} {member.lastName}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <RoleBadge role={member.role} />
              <StatusBadge status={member.status} />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {member.email}{member.phone ? ` · ${member.phone}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={onEdit}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              ✏️ Edit
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              🗑️ Delete
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
            <p className="text-lg font-bold text-gray-900">{assignedServices.length}</p>
            <p className="text-xs text-gray-500">Services</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
            <p className="text-lg font-bold text-gray-900">{member.availability.length}</p>
            <p className="text-xs text-gray-500">Days/Week</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
            <p className="text-lg font-bold text-gray-900">{yearsActive !== null ? yearsActive : '—'}</p>
            <p className="text-xs text-gray-500">Yrs Tenure</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="-mb-5 flex gap-0 border-b border-gray-200">
          {(['profile', 'services', 'availability'] as DetailTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-b-2 px-5 py-2.5 text-sm font-medium transition-colors ${
                tab === t
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {t === 'profile' ? 'Profile' : t === 'services' ? 'Services' : 'Availability'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-5">
        {tab === 'profile' && <ProfileTab member={member} />}
        {tab === 'services' && <ServicesTab services={assignedServices} allCount={services.length} />}
        {tab === 'availability' && <AvailabilityTab member={member} />}
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Remove Staff Member</h3>
            <p className="mb-5 text-sm text-gray-600">
              Are you sure you want to remove{' '}
              <span className="font-semibold">{member.firstName} {member.lastName}</span>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => { onDelete(); setConfirmDelete(false); }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function StaffManagementPage() {
  const {
    staff,
    services,
    fetchStaff,
    fetchServices,
    addStaffMember,
    updateStaffMember,
    deleteStaffMember,
  } = useBookingStore();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<StaffRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StaffStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; mode: ModalMode; member?: StaffMember }>({
    open: false,
    mode: 'add',
  });

  useEffect(() => {
    fetchStaff();
    if (services.length === 0) fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let list = staff;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q),
      );
    }
    if (roleFilter !== 'all') list = list.filter((m) => m.role === roleFilter);
    if (statusFilter !== 'all') list = list.filter((m) => m.status === statusFilter);
    return list;
  }, [staff, search, roleFilter, statusFilter]);

  const selectedMember = staff.find((m) => m.id === selectedId) ?? null;

  const stats = {
    total:       staff.length,
    active:      staff.filter((m) => m.status === 'active').length,
    onLeave:     staff.filter((m) => m.status === 'on-leave').length,
    instructors: staff.filter((m) => m.role === 'instructor').length,
  };

  function handleSave(data: StaffFormData) {
    if (modal.mode === 'add') {
      addStaffMember(data);
      toast.success('Staff member added');
    } else if (modal.member) {
      updateStaffMember(modal.member.id, data);
      toast.success('Staff member updated');
    }
    setModal({ open: false, mode: 'add' });
  }

  function handleDelete(id: string) {
    deleteStaffMember(id);
    setSelectedId(null);
    toast.success('Staff member removed');
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header + Stats */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Manage team members, roles, service assignments, and availability
            </p>
          </div>
          <button
            onClick={() => setModal({ open: true, mode: 'add' })}
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 transition-colors"
          >
            + Add Staff Member
          </button>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Staff',  value: stats.total,       sub: 'team members',        color: 'text-gray-900' },
            { label: 'Active',       value: stats.active,      sub: 'currently working',   color: 'text-green-600' },
            { label: 'On Leave',     value: stats.onLeave,     sub: 'temporary absence',   color: 'text-yellow-600' },
            { label: 'Instructors',  value: stats.instructors, sub: 'group class leaders', color: 'text-purple-600' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
              <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
              <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main content split pane */}
      <div className="flex min-h-0 flex-1">
        {/* Left: staff list */}
        <div className="flex w-80 shrink-0 flex-col border-r border-gray-200 bg-white">
          {/* Filters */}
          <div className="space-y-2 border-b border-gray-100 px-4 py-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <div className="flex gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as StaffRole | 'all')}
                className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="all">All Roles</option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StaffStatus | 'all')}
                className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on-leave">On Leave</option>
              </select>
            </div>
          </div>

          {/* Staff list */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <span className="mb-2 text-3xl">👤</span>
                <p className="text-sm font-medium text-gray-500">
                  {staff.length === 0 ? 'No staff yet' : 'No matches found'}
                </p>
              </div>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={`flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                    selectedId === m.id ? 'border-l-2 border-l-sky-500 bg-sky-50' : ''
                  }`}
                >
                  <Avatar member={m} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {m.firstName} {m.lastName}
                      </p>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[m.status]}`} />
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ROLE_BADGE[m.role]}`}>
                        {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                      </span>
                      {m.serviceIds.length > 0 && (
                        <span className="text-[10px] text-gray-400">
                          {m.serviceIds.length} svc{m.serviceIds.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: detail pane */}
        <div className="min-w-0 flex-1 overflow-hidden">
          {selectedMember ? (
            <DetailPanel
              member={selectedMember}
              services={services}
              onEdit={() => setModal({ open: true, mode: 'edit', member: selectedMember })}
              onDelete={() => handleDelete(selectedMember.id)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <span className="mb-4 text-5xl">👤</span>
              <h3 className="text-lg font-semibold text-gray-700">Select a Staff Member</h3>
              <p className="mt-2 max-w-sm text-sm text-gray-400">
                Choose a team member from the list to view their profile, assigned services,
                and weekly availability schedule.
              </p>
              <button
                onClick={() => setModal({ open: true, mode: 'add' })}
                className="mt-6 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition-colors"
              >
                + Add First Staff Member
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit modal */}
      {modal.open && (
        <StaffModal
          mode={modal.mode}
          initial={modal.member}
          services={services}
          onSave={handleSave}
          onClose={() => setModal({ open: false, mode: 'add' })}
        />
      )}
    </div>
  );
}
