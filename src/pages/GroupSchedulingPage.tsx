import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useBookingStore } from '../store/bookingStore';
import { generateOccurrences, recurrenceSummary } from '../services/groupBookingService';
import { clientFullName } from '../services/clientService';
import type { GroupClass, GroupClassStatus, RecurrenceFrequency } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FREQ_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'none',     label: 'One-time (no recurrence)' },
  { value: 'daily',    label: 'Daily' },
  { value: 'weekly',   label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly',  label: 'Monthly' },
];
const COLOR_OPTIONS = [
  '#0284c7', '#7c3aed', '#059669', '#db2777',
  '#ea580c', '#ca8a04', '#0891b2', '#4f46e5',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function ClassStatusBadge({ status }: { status: GroupClassStatus }) {
  const cfg: Record<GroupClassStatus, { cls: string; dot: string; label: string }> = {
    active:    { cls: 'bg-green-100 text-green-700', dot: 'bg-green-500',  label: 'Active' },
    cancelled: { cls: 'bg-red-100 text-red-700',     dot: 'bg-red-500',    label: 'Cancelled' },
    completed: { cls: 'bg-gray-100 text-gray-500',   dot: 'bg-gray-400',   label: 'Completed' },
  };
  const { cls, dot, label } = cfg[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function EnrollBadge({ status }: { status: 'enrolled' | 'waitlisted' }) {
  return status === 'enrolled' ? (
    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">Enrolled</span>
  ) : (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">Waitlisted</span>
  );
}

function TagChip({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
      {label}
    </span>
  );
}

function FillBar({ enrolled, capacity }: { enrolled: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min((enrolled / capacity) * 100, 100) : 0;
  const color = pct >= 100 ? 'bg-red-400' : pct >= 75 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
      <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Class Form ────────────────────────────────────────────────────────────────

interface ClassFormData {
  name: string;
  description: string;
  serviceId: string;
  instructorName: string;
  location: string;
  capacity: string;
  tags: string;
  status: GroupClassStatus;
  startDate: string;
  startTime: string;
  endTime: string;
  frequency: RecurrenceFrequency;
  daysOfWeek: number[];
  occurrences: string;
  endDate: string;
  useEndDate: boolean;
  color: string;
  notes: string;
}

const EMPTY_FORM: ClassFormData = {
  name: '', description: '', serviceId: '', instructorName: '', location: '',
  capacity: '8', tags: '', status: 'active',
  startDate: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '10:00',
  frequency: 'weekly', daysOfWeek: [], occurrences: '8', endDate: '', useEndDate: false,
  color: '#7c3aed', notes: '',
};

function classToForm(c: GroupClass): ClassFormData {
  return {
    name: c.name,
    description: c.description ?? '',
    serviceId: c.serviceId,
    instructorName: c.instructorName ?? '',
    location: c.location ?? '',
    capacity: String(c.capacity),
    tags: c.tags.join(', '),
    status: c.status,
    startDate: c.startDate,
    startTime: c.startTime,
    endTime: c.endTime,
    frequency: c.recurrenceRule.frequency,
    daysOfWeek: c.recurrenceRule.daysOfWeek ?? [],
    occurrences: c.recurrenceRule.occurrences ? String(c.recurrenceRule.occurrences) : '8',
    endDate: c.recurrenceRule.endDate ?? '',
    useEndDate: !!c.recurrenceRule.endDate,
    color: c.color ?? '#7c3aed',
    notes: c.notes ?? '',
  };
}

interface ClassModalProps {
  initial?: GroupClass | null;
  services: { id: string; name: string }[];
  onSave: (data: Omit<GroupClass, 'id' | 'createdAt' | 'updatedAt' | 'enrolledCount'>) => void;
  onClose: () => void;
}

function ClassModal({ initial, services, onSave, onClose }: ClassModalProps) {
  const [form, setForm] = useState<ClassFormData>(initial ? classToForm(initial) : EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof ClassFormData, string>>>({});

  function set<K extends keyof ClassFormData>(key: K, val: ClassFormData[K]) {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function toggleDow(day: number) {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day)
        ? f.daysOfWeek.filter((d) => d !== day)
        : [...f.daysOfWeek, day],
    }));
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.name.trim())      errs.name = 'Class name is required';
    if (!form.serviceId)        errs.serviceId = 'Service is required';
    if (!form.startDate)        errs.startDate = 'Start date is required';
    if (!form.startTime)        errs.startTime = 'Start time is required';
    if (!form.endTime)          errs.endTime = 'End time is required';
    if (!form.capacity || Number(form.capacity) < 1) errs.capacity = 'Capacity must be ≥ 1';
    if (form.useEndDate && !form.endDate) errs.endDate = 'End date is required';
    if (!form.useEndDate && (!form.occurrences || Number(form.occurrences) < 1))
      errs.occurrences = 'Occurrences must be ≥ 1';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    const recurrenceRule =
      form.frequency === 'none'
        ? { frequency: 'none' as const }
        : {
            frequency: form.frequency,
            ...(form.useEndDate ? { endDate: form.endDate } : { occurrences: Number(form.occurrences) }),
            ...(['weekly', 'biweekly'].includes(form.frequency) ? { daysOfWeek: form.daysOfWeek } : {}),
          };

    onSave({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      serviceId: form.serviceId,
      instructorName: form.instructorName.trim() || undefined,
      location: form.location.trim() || undefined,
      capacity: Number(form.capacity),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      status: form.status,
      startDate: form.startDate,
      startTime: form.startTime,
      endTime: form.endTime,
      recurrenceRule,
      color: form.color,
      notes: form.notes.trim() || undefined,
    });
  }

  const Field = ({ label, err, children }: { label: string; err?: string; children: React.ReactNode }) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {children}
      {err && <p className="mt-0.5 text-xs text-red-500">{err}</p>}
    </div>
  );

  const inp = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-semibold text-gray-800">{initial ? 'Edit Class' : 'New Group Class'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <Field label="Class Name *" err={errors.name}>
            <input className={inp} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Morning Mobility Circle" />
          </Field>
          <Field label="Description">
            <textarea className={`${inp} resize-none`} rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Service *" err={errors.serviceId}>
              <select className={inp} value={form.serviceId} onChange={(e) => set('serviceId', e.target.value)}>
                <option value="">Select…</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Capacity *" err={errors.capacity}>
              <input className={inp} type="number" min={1} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Instructor">
              <input className={inp} value={form.instructorName} onChange={(e) => set('instructorName', e.target.value)} placeholder="Instructor name" />
            </Field>
            <Field label="Location">
              <input className={inp} value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Studio A" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Start Date *" err={errors.startDate}>
              <input className={inp} type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </Field>
            <Field label="Start Time *" err={errors.startTime}>
              <input className={inp} type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} />
            </Field>
            <Field label="End Time *" err={errors.endTime}>
              <input className={inp} type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} />
            </Field>
          </div>

          {/* Recurrence */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Recurrence</p>
            <Field label="Frequency" err={errors.frequency}>
              <select className={inp} value={form.frequency} onChange={(e) => set('frequency', e.target.value as RecurrenceFrequency)}>
                {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>

            {(form.frequency === 'weekly' || form.frequency === 'biweekly') && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-600">Days of week</p>
                <div className="flex gap-1.5 flex-wrap">
                  {DOW_LABELS.map((d, i) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDow(i)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        form.daysOfWeek.includes(i)
                          ? 'bg-violet-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:border-violet-300'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.frequency !== 'none' && (
              <div className="space-y-2">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="radio" checked={!form.useEndDate} onChange={() => set('useEndDate', false)} />
                    Number of sessions
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="radio" checked={form.useEndDate} onChange={() => set('useEndDate', true)} />
                    End date
                  </label>
                </div>
                {form.useEndDate ? (
                  <Field label="End Date" err={errors.endDate}>
                    <input className={inp} type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
                  </Field>
                ) : (
                  <Field label="Number of Sessions" err={errors.occurrences}>
                    <input className={inp} type="number" min={1} max={52} value={form.occurrences} onChange={(e) => set('occurrences', e.target.value)} />
                  </Field>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tags (comma-separated)">
              <input className={inp} value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="mobility, low-impact" />
            </Field>
            <Field label="Status">
              <select className={inp} value={form.status} onChange={(e) => set('status', e.target.value as GroupClassStatus)}>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
          </div>

          <Field label="Color">
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('color', c)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${form.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </Field>

          <Field label="Notes">
            <textarea className={`${inp} resize-none`} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Internal notes, special instructions…" />
          </Field>
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700">
            {initial ? 'Save Changes' : 'Create Class'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Enroll Modal ──────────────────────────────────────────────────────────────

interface EnrollModalProps {
  classId: string;
  enrolledClientIds: string[];
  onEnroll: (clientId: string, clientName: string, clientEmail: string) => void;
  onClose: () => void;
}

function EnrollModal({ classId: _classId, enrolledClientIds, onEnroll, onClose }: EnrollModalProps) {
  const clients = useBookingStore((s) => s.clients);
  const [search, setSearch] = useState('');

  const available = useMemo(
    () =>
      clients.filter(
        (c) =>
          !enrolledClientIds.includes(c.id) &&
          (search === '' ||
            clientFullName(c).toLowerCase().includes(search.toLowerCase()) ||
            c.email.toLowerCase().includes(search.toLowerCase())),
      ),
    [clients, enrolledClientIds, search],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-sm flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold text-gray-800">Enroll a Client</h2>
          <button onClick={onClose} className="text-xl text-gray-400 hover:text-gray-600 leading-none">×</button>
        </div>
        <div className="px-5 pt-3 pb-2">
          <input
            autoFocus
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-1">
          {available.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">No eligible clients found</p>
          )}
          {available.map((c) => (
            <button
              key={c.id}
              onClick={() => { onEnroll(c.id, clientFullName(c), c.email); onClose(); }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-violet-50 transition-colors"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700">
                {c.firstName[0]}{c.lastName[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{clientFullName(c)}</p>
                <p className="text-xs text-gray-500">{c.email}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Class Detail Panel ────────────────────────────────────────────────────────

type DetailTab = 'overview' | 'roster' | 'schedule';

interface DetailPanelProps {
  gc: GroupClass;
  onEdit: () => void;
  onDelete: () => void;
}

function DetailPanel({ gc, onEdit, onDelete }: DetailPanelProps) {
  const [tab, setTab] = useState<DetailTab>('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  const { enrollments, enrollClient, unenrollClient, services } = useBookingStore((s) => ({
    enrollments: s.enrollments,
    enrollClient: s.enrollClient,
    unenrollClient: s.unenrollClient,
    services: s.services,
  }));

  const classEnrollments = useMemo(
    () => enrollments.filter((e) => e.classId === gc.id && e.status !== 'cancelled'),
    [enrollments, gc.id],
  );
  const enrolledClientIds = classEnrollments.map((e) => e.clientId);

  const occurrences = useMemo(() => generateOccurrences(gc, 20), [gc]);
  const service = services.find((s) => s.id === gc.serviceId);

  const tabCls = (t: DetailTab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t ? 'border-violet-500 text-violet-600' : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b px-6 pt-5 pb-0">
        <div className="flex items-start justify-between gap-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-4 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: gc.color ?? '#7c3aed' }} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{gc.name}</h2>
              {gc.description && <p className="mt-0.5 text-sm text-gray-500">{gc.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ClassStatusBadge status={gc.status} />
            <button onClick={onEdit} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Edit</button>
            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50">Delete</button>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="text-xs text-red-600">Sure?</span>
                <button onClick={() => { onDelete(); setShowDeleteConfirm(false); }} className="rounded-lg bg-red-500 px-2.5 py-1 text-xs text-white hover:bg-red-600">Yes</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="rounded-lg border px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-50">No</button>
              </span>
            )}
          </div>
        </div>
        {/* Capacity bar */}
        <div className="flex items-center gap-3 pb-3">
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{gc.enrolledCount}</span> / {gc.capacity} enrolled
          </span>
          {gc.enrolledCount >= gc.capacity && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600 font-medium">Full</span>
          )}
          <div className="flex-1">
            <FillBar enrolled={gc.enrolledCount} capacity={gc.capacity} />
          </div>
        </div>
        {/* Tabs */}
        <div className="flex">
          {(['overview', 'roster', 'schedule'] as DetailTab[]).map((t) => (
            <button key={t} className={tabCls(t)} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'roster' && <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{classEnrollments.length}</span>}
              {t === 'schedule' && <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{occurrences.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Tab body */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Service',    service?.name ?? gc.serviceId],
                ['Instructor', gc.instructorName ?? '—'],
                ['Location',   gc.location ?? '—'],
                ['First Session', format(parseISO(gc.startDate), 'MMM d, yyyy')],
                ['Time',       `${gc.startTime} – ${gc.endTime}`],
                ['Recurrence', recurrenceSummary(gc.recurrenceRule)],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{k}</p>
                  <p className="mt-0.5 text-sm text-gray-800">{v}</p>
                </div>
              ))}
            </div>
            {gc.tags.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {gc.tags.map((t) => <TagChip key={t} label={t} />)}
                </div>
              </div>
            )}
            {gc.notes && (
              <div>
                <p className="mb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">Notes</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{gc.notes}</p>
              </div>
            )}
          </div>
        )}

        {tab === 'roster' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-600">
                {classEnrollments.filter((e) => e.status === 'enrolled').length} enrolled ·{' '}
                {classEnrollments.filter((e) => e.status === 'waitlisted').length} waitlisted ·{' '}
                {Math.max(0, gc.capacity - gc.enrolledCount)} spots open
              </p>
              <button
                onClick={() => setShowEnrollModal(true)}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
              >
                + Enroll Client
              </button>
            </div>
            {classEnrollments.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">No clients enrolled yet</p>
            )}
            <div className="space-y-1.5">
              {classEnrollments
                .sort((a, b) => (a.status === 'enrolled' ? -1 : b.status === 'enrolled' ? 1 : 0))
                .map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700">
                        {(e.clientName ?? '??').split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{e.clientName ?? e.clientId}</p>
                        <p className="text-xs text-gray-500">{e.clientEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <EnrollBadge status={e.status as 'enrolled' | 'waitlisted'} />
                      <button
                        onClick={() => unenrollClient(e.id)}
                        className="text-xs text-red-400 hover:text-red-600"
                        title="Remove"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {tab === 'schedule' && (
          <div>
            <p className="mb-3 text-sm text-gray-500">
              {recurrenceSummary(gc.recurrenceRule)} — showing up to {occurrences.length} sessions
            </p>
            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left">#</th>
                    <th className="px-4 py-2.5 text-left">Date</th>
                    <th className="px-4 py-2.5 text-left">Day</th>
                    <th className="px-4 py-2.5 text-left">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {occurrences.map((dateStr, i) => {
                    const d = parseISO(dateStr);
                    const isFirst = i === 0;
                    return (
                      <tr key={dateStr} className={isFirst ? 'bg-violet-50' : ''}>
                        <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-2 font-medium text-gray-800">
                          {format(d, 'MMM d, yyyy')}
                          {isFirst && <span className="ml-2 text-xs text-violet-600 font-normal">First</span>}
                        </td>
                        <td className="px-4 py-2 text-gray-600">{format(d, 'EEEE')}</td>
                        <td className="px-4 py-2 text-gray-600">{gc.startTime} – {gc.endTime}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showEnrollModal && (
        <EnrollModal
          classId={gc.id}
          enrolledClientIds={enrolledClientIds}
          onEnroll={(clientId, clientName, clientEmail) =>
            enrollClient(gc.id, clientId, clientName, clientEmail)
          }
          onClose={() => setShowEnrollModal(false)}
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function GroupSchedulingPage() {
  const {
    groupClasses, enrollments, services,
    fetchGroupClasses, fetchServices, fetchClients,
    addGroupClass, updateGroupClass, deleteGroupClass,
  } = useBookingStore((s) => ({
    groupClasses:      s.groupClasses,
    enrollments:       s.enrollments,
    services:          s.services,
    fetchGroupClasses: s.fetchGroupClasses,
    fetchServices:     s.fetchServices,
    fetchClients:      s.fetchClients,
    addGroupClass:     s.addGroupClass,
    updateGroupClass:  s.updateGroupClass,
    deleteGroupClass:  s.deleteGroupClass,
  }));

  const [search,     setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState<GroupClassStatus | 'all'>('all');
  const [selected,   setSelected]   = useState<GroupClass | null>(null);
  const [modalMode,  setModalMode]  = useState<'add' | 'edit' | null>(null);

  useEffect(() => {
    fetchGroupClasses();
    fetchServices();
    fetchClients();
  }, [fetchGroupClasses, fetchServices, fetchClients]);

  // Keep selected in sync after mutations
  useEffect(() => {
    if (selected) {
      const updated = groupClasses.find((gc) => gc.id === selected.id);
      if (updated) setSelected(updated);
      else setSelected(null);
    }
  }, [groupClasses]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return groupClasses.filter((gc) => {
      const matchStatus = statusFilter === 'all' || gc.status === statusFilter;
      const matchSearch =
        !q ||
        gc.name.toLowerCase().includes(q) ||
        (gc.instructorName?.toLowerCase().includes(q) ?? false) ||
        gc.tags.some((t) => t.toLowerCase().includes(q)) ||
        (gc.location?.toLowerCase().includes(q) ?? false);
      return matchStatus && matchSearch;
    });
  }, [groupClasses, search, statusFilter]);

  // Stats
  const totalEnrolled = enrollments.filter((e) => e.status === 'enrolled').length;
  const activeClasses = groupClasses.filter((gc) => gc.status === 'active').length;
  const totalSpots    = groupClasses.filter((gc) => gc.status === 'active').reduce((acc, gc) => acc + gc.capacity, 0);

  function handleSave(data: Omit<GroupClass, 'id' | 'createdAt' | 'updatedAt' | 'enrolledCount'>) {
    if (modalMode === 'add') {
      addGroupClass(data);
    } else if (modalMode === 'edit' && selected) {
      updateGroupClass(selected.id, data);
    }
    setModalMode(null);
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Group Scheduling</h1>
            <p className="text-sm text-gray-500">Manage group classes and recurring session series</p>
          </div>
          <button
            onClick={() => setModalMode('add')}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
          >
            + New Class
          </button>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-4 gap-4">
          {[
            { label: 'Total Classes',   value: groupClasses.length },
            { label: 'Active',          value: activeClasses },
            { label: 'Total Enrolled',  value: totalEnrolled },
            { label: 'Total Capacity',  value: totalSpots },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium text-gray-400">{label}</p>
              <p className="mt-0.5 text-2xl font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: class list */}
        <div className="flex w-80 flex-shrink-0 flex-col border-r bg-white">
          <div className="space-y-2 border-b px-4 py-3">
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              placeholder="Search classes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as GroupClassStatus | 'all')}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="py-12 text-center text-sm text-gray-400">No classes found</p>
            )}
            {filtered.map((gc) => {
              const isSelected = selected?.id === gc.id;
              const classEnrolled = enrollments.filter(
                (e) => e.classId === gc.id && e.status === 'enrolled',
              ).length;
              return (
                <button
                  key={gc.id}
                  onClick={() => setSelected(gc)}
                  className={`w-full border-b px-4 py-3.5 text-left transition-colors ${
                    isSelected ? 'bg-violet-50 border-l-4 border-l-violet-500' : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: gc.color ?? '#7c3aed' }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-gray-800">{gc.name}</p>
                      </div>
                      {gc.instructorName && (
                        <p className="text-xs text-gray-500 truncate">{gc.instructorName}</p>
                      )}
                      <p className="mt-0.5 text-xs text-gray-400">
                        {format(parseISO(gc.startDate), 'MMM d')} · {gc.startTime}–{gc.endTime}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-xs text-gray-500">{classEnrolled}/{gc.capacity} enrolled</span>
                        <ClassStatusBadge status={gc.status} />
                      </div>
                      <FillBar enrolled={classEnrolled} capacity={gc.capacity} />
                      {gc.tags.slice(0, 2).map((t) => (
                        <span key={t} className="mr-1 mt-1.5 inline-block rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-600">{t}</span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: detail */}
        <div className="flex-1 overflow-hidden p-6">
          {selected ? (
            <DetailPanel
              gc={selected}
              onEdit={() => setModalMode('edit')}
              onDelete={() => {
                deleteGroupClass(selected.id);
                setSelected(null);
              }}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-400">
              <div className="text-5xl">📅</div>
              <p className="text-base font-medium">Select a class to view details</p>
              <p className="text-sm">or create a new group class to get started</p>
              <button
                onClick={() => setModalMode('add')}
                className="mt-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
              >
                + New Class
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalMode && (
        <ClassModal
          initial={modalMode === 'edit' ? selected : null}
          services={services}
          onSave={handleSave}
          onClose={() => setModalMode(null)}
        />
      )}
    </div>
  );
}
