/**
 * WaiverFormsPage — admin page to manage waiver templates and view signed records.
 * Route: /waivers
 */
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import type { WaiverTemplate, SignedWaiver, WaiverFormField, FormFieldType } from '../types';
import {
  loadWaiverTemplates,
  saveWaiverTemplates,
  loadSignedWaivers,
} from '../services/waiverService';
import { MOCK_SERVICES } from '../services/mockData';

// ── Helpers ───────────────────────────────────────────────────────────────────
const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: 'Short Text',
  textarea: 'Long Text',
  checkbox: 'Checkbox',
  radio: 'Multiple Choice',
  select: 'Dropdown',
  date: 'Date',
  number: 'Number',
};

function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const cls: Record<string, string> = {
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    gray: 'bg-gray-100 text-gray-600',
    sky: 'bg-sky-100 text-sky-700',
    red: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls[color] ?? cls.gray}`}>
      {children}
    </span>
  );
}

// ── Empty template factory ─────────────────────────────────────────────────────
function makeEmptyTemplate(): WaiverTemplate {
  return {
    id: '',
    name: '',
    description: '',
    waiverText: '',
    requireSignature: true,
    requireInitials: false,
    serviceIds: [],
    customFields: [],
    active: true,
    createdAt: '',
    updatedAt: '',
  };
}

// ── Field editor row ──────────────────────────────────────────────────────────
function FieldRow({
  field,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  field: WaiverFormField;
  index: number;
  total: number;
  onChange: (f: WaiverFormField) => void;
  onRemove: () => void;
  onMove: (dir: 'up' | 'down') => void;
}) {
  const needsOptions = field.type === 'radio' || field.type === 'select';
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-0.5 pt-1">
          <button type="button" disabled={index === 0} onClick={() => onMove('up')} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs leading-none">▲</button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove('down')} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs leading-none">▼</button>
        </div>
        <div className="flex-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Field Label *</label>
            <input
              type="text"
              value={field.label}
              onChange={(e) => onChange({ ...field, label: e.target.value })}
              placeholder="e.g. Do you have any injuries?"
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Type</label>
            <select
              value={field.type}
              onChange={(e) => onChange({ ...field, type: e.target.value as FormFieldType })}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              {(Object.keys(FIELD_TYPE_LABELS) as FormFieldType[]).map((t) => (
                <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          {field.type !== 'checkbox' && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Placeholder</label>
              <input
                type="text"
                value={field.placeholder ?? ''}
                onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
                placeholder="Optional placeholder text…"
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`req-${field.id}`}
              checked={field.required}
              onChange={(e) => onChange({ ...field, required: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
            />
            <label htmlFor={`req-${field.id}`} className="text-xs text-gray-600">Required</label>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="mt-1 text-red-400 hover:text-red-600 text-lg leading-none"
          title="Remove field"
        >
          ×
        </button>
      </div>
      {needsOptions && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Options (one per line)</label>
          <textarea
            rows={3}
            value={(field.options ?? []).join('\n')}
            onChange={(e) =>
              onChange({ ...field, options: e.target.value.split('\n').filter(Boolean) })
            }
            placeholder="Option 1&#10;Option 2&#10;Option 3"
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Help Text (optional)</label>
        <input
          type="text"
          value={field.helpText ?? ''}
          onChange={(e) => onChange({ ...field, helpText: e.target.value })}
          placeholder="Additional guidance shown below the field…"
          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>
    </div>
  );
}

// ── Template editor modal ─────────────────────────────────────────────────────
function TemplateModal({
  initial,
  onSave,
  onClose,
}: {
  initial: WaiverTemplate | null;
  onSave: (t: WaiverTemplate) => void;
  onClose: () => void;
}) {
  const isNew = !initial?.id;
  const [draft, setDraft] = useState<WaiverTemplate>(
    initial ?? makeEmptyTemplate(),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const services = MOCK_SERVICES;

  const set = <K extends keyof WaiverTemplate>(k: K, v: WaiverTemplate[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!draft.name.trim()) e.name = 'Name is required.';
    if (!draft.waiverText.trim()) e.waiverText = 'Waiver text is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const now = new Date().toISOString();
    onSave({
      ...draft,
      id: draft.id || `waiver-${Date.now().toString(36)}`,
      createdAt: draft.createdAt || now,
      updatedAt: now,
    });
  };

  const addField = () => {
    const newField: WaiverFormField = {
      id: `field-${Date.now().toString(36)}`,
      label: '',
      type: 'text',
      required: false,
    };
    set('customFields', [...draft.customFields, newField]);
  };

  const updateField = (idx: number, f: WaiverFormField) => {
    const next = [...draft.customFields];
    next[idx] = f;
    set('customFields', next);
  };

  const removeField = (idx: number) =>
    set('customFields', draft.customFields.filter((_, i) => i !== idx));

  const moveField = (idx: number, dir: 'up' | 'down') => {
    const next = [...draft.customFields];
    const target = dir === 'up' ? idx - 1 : idx + 1;
    [next[idx], next[target]] = [next[target], next[idx]];
    set('customFields', next);
  };

  const toggleService = (sid: string) => {
    const cur = draft.serviceIds;
    set('serviceIds', cur.includes(sid) ? cur.filter((x) => x !== sid) : [...cur, sid]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isNew ? 'New Waiver Template' : 'Edit Waiver Template'}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">
          {/* Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Template Name *</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. General Liability Waiver"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Short Description</label>
            <input
              type="text"
              value={draft.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Brief description for admin reference…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Applies to */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Applies to</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => set('serviceIds', [])}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${draft.serviceIds.length === 0 ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-gray-300 text-gray-600 hover:border-sky-300'}`}
              >
                All Services
              </button>
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleService(s.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${draft.serviceIds.includes(s.id) ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-gray-300 text-gray-600 hover:border-sky-300'}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Waiver text */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Waiver / Consent Text *</label>
            <textarea
              rows={10}
              value={draft.waiverText}
              onChange={(e) => set('waiverText', e.target.value)}
              placeholder="Enter the full legal text of the waiver or consent form…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs leading-relaxed focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            {errors.waiverText && <p className="mt-1 text-xs text-red-600">{errors.waiverText}</p>}
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.requireSignature}
                onChange={(e) => set('requireSignature', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-sm text-gray-700">Require full-name signature</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.requireInitials}
                onChange={(e) => set('requireInitials', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-sm text-gray-700">Require initials</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => set('active', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-sm text-gray-700">Active (shown to clients)</span>
            </label>
          </div>

          {/* Custom fields */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Additional Intake Fields</p>
                <p className="text-xs text-gray-500">Collect extra information alongside the waiver.</p>
              </div>
              <button
                type="button"
                onClick={addField}
                className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
              >
                + Add Field
              </button>
            </div>
            {draft.customFields.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400">
                No additional fields. Click "Add Field" to collect extra intake data.
              </p>
            ) : (
              <div className="space-y-3">
                {draft.customFields.map((field, idx) => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    index={idx}
                    total={draft.customFields.length}
                    onChange={(f) => updateField(idx, f)}
                    onRemove={() => removeField(idx)}
                    onMove={(dir) => moveField(idx, dir)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700">
            {isNew ? 'Create Template' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Signed waiver detail modal ────────────────────────────────────────────────
function SignedWaiverModal({
  entry,
  onClose,
}: {
  entry: SignedWaiver;
  onClose: () => void;
}) {
  const templates = loadWaiverTemplates();
  const template = templates.find((t) => t.id === entry.waiverId);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{entry.waiverName}</h2>
            <p className="text-sm text-gray-500">Signed record — ID: {entry.id}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Client info */}
          <div className="grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4 text-sm">
            <div><p className="text-xs text-gray-500">Client</p><p className="font-medium text-gray-900">{entry.clientName}</p></div>
            <div><p className="text-xs text-gray-500">Email</p><p className="font-medium text-gray-900">{entry.clientEmail}</p></div>
            {entry.serviceName && <div><p className="text-xs text-gray-500">Service</p><p className="font-medium text-gray-900">{entry.serviceName}</p></div>}
            {entry.bookingId && <div><p className="text-xs text-gray-500">Booking ID</p><p className="font-mono font-semibold text-sky-700">{entry.bookingId}</p></div>}
            <div className="col-span-2"><p className="text-xs text-gray-500">Signed At</p><p className="font-medium text-gray-900">{format(parseISO(entry.signedAt), 'MMMM d, yyyy \'at\' h:mm a')}</p></div>
          </div>

          {/* Waiver text */}
          {template && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Waiver Text (at time of signing)</p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-xs leading-relaxed text-gray-600 whitespace-pre-wrap">
                {template.waiverText}
              </div>
            </div>
          )}

          {/* Custom field responses */}
          {Object.keys(entry.customFieldResponses).length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Intake Field Responses</p>
              <div className="space-y-2 rounded-xl border border-gray-200 p-4">
                {template?.customFields.map((f) => {
                  const val = entry.customFieldResponses[f.id];
                  if (val === undefined || val === '' || val === false) return null;
                  return (
                    <div key={f.id} className="flex justify-between gap-4 text-sm">
                      <span className="text-gray-500">{f.label}</span>
                      <span className="font-medium text-gray-900 text-right">
                        {typeof val === 'boolean' ? (val ? '✓ Yes' : '✗ No') : String(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Signature */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Digital Signature</p>
            <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-5 text-center">
              <p
                className="text-2xl text-gray-700"
                style={{ fontFamily: 'cursive', letterSpacing: '0.05em' }}
              >
                {entry.signatureName}
              </p>
              <p className="mt-2 text-xs text-gray-400">
                Signed: {format(parseISO(entry.signedAt), 'MM/dd/yyyy HH:mm:ss')} UTC
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-gray-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════════════════════
export function WaiverFormsPage() {
  const [tab, setTab] = useState<'templates' | 'records'>('templates');
  const [templates, setTemplates] = useState<WaiverTemplate[]>([]);
  const [signedWaivers, setSignedWaivers] = useState<SignedWaiver[]>([]);

  const [editingTemplate, setEditingTemplate] = useState<WaiverTemplate | null | 'new'>(null);
  const [viewingRecord, setViewingRecord] = useState<SignedWaiver | null>(null);
  const [filterName, setFilterName] = useState('');

  useEffect(() => {
    setTemplates(loadWaiverTemplates());
    setSignedWaivers(loadSignedWaivers());
  }, []);

  const handleSaveTemplate = (t: WaiverTemplate) => {
    const updated = templates.some((x) => x.id === t.id)
      ? templates.map((x) => (x.id === t.id ? t : x))
      : [...templates, t];
    setTemplates(updated);
    saveWaiverTemplates(updated);
    setEditingTemplate(null);
    toast.success(t.id ? 'Template saved.' : 'Template created.');
  };

  const handleToggleActive = (id: string) => {
    const updated = templates.map((t) =>
      t.id === id ? { ...t, active: !t.active, updatedAt: new Date().toISOString() } : t,
    );
    setTemplates(updated);
    saveWaiverTemplates(updated);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this waiver template? This cannot be undone.')) return;
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    saveWaiverTemplates(updated);
    toast.success('Template deleted.');
  };

  const filteredRecords = signedWaivers.filter(
    (r) =>
      !filterName ||
      r.clientName.toLowerCase().includes(filterName.toLowerCase()) ||
      r.clientEmail.toLowerCase().includes(filterName.toLowerCase()) ||
      r.waiverName.toLowerCase().includes(filterName.toLowerCase()),
  );

  const activeCount = templates.filter((t) => t.active).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Waivers & Intake Forms</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create consent templates, build custom intake fields, and view signed records.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Templates', value: templates.length, icon: '📄', color: 'sky' },
          { label: 'Active Templates', value: activeCount, icon: '✅', color: 'green' },
          { label: 'Signed Today', value: signedWaivers.filter((r) => r.signedAt.startsWith(new Date().toISOString().slice(0, 10))).length, icon: '✍️', color: 'amber' },
          { label: 'Total Signatures', value: signedWaivers.length, icon: '📝', color: 'gray' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <span>{icon}</span> {label}
            </div>
            <p className={`text-2xl font-bold ${color === 'sky' ? 'text-sky-600' : color === 'green' ? 'text-green-600' : color === 'amber' ? 'text-amber-600' : 'text-gray-700'}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {(['templates', 'records'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'templates' ? '📄 Templates' : '✍️ Signed Records'}
          </button>
        ))}
      </div>

      {/* ──────────────── TEMPLATES TAB ──────────────────── */}
      {tab === 'templates' && (
        <div>
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => setEditingTemplate('new')}
              className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
            >
              + New Template
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
              <span className="text-4xl">📄</span>
              <p className="mt-3 text-gray-500">No waiver templates yet. Create your first one!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {templates.map((tmpl) => {
                const serviceLabels = tmpl.serviceIds.length === 0
                  ? 'All Services'
                  : MOCK_SERVICES.filter((s) => tmpl.serviceIds.includes(s.id)).map((s) => s.name).join(', ');
                return (
                  <div key={tmpl.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">{tmpl.name}</h3>
                          <Badge color={tmpl.active ? 'green' : 'gray'}>{tmpl.active ? 'Active' : 'Inactive'}</Badge>
                          {tmpl.requireSignature && <Badge color="sky">✍️ Signature</Badge>}
                          {tmpl.requireInitials && <Badge color="sky">Initials</Badge>}
                        </div>
                        {tmpl.description && (
                          <p className="text-sm text-gray-500 mb-2">{tmpl.description}</p>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                          <span>🎯 {serviceLabels}</span>
                          <span>📋 {tmpl.customFields.length} custom field{tmpl.customFields.length !== 1 ? 's' : ''}</span>
                          <span>📝 {tmpl.waiverText.length} chars of waiver text</span>
                          <span>🕐 Updated {format(parseISO(tmpl.updatedAt), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(tmpl.id)}
                          title={tmpl.active ? 'Deactivate' : 'Activate'}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${tmpl.active ? 'bg-sky-500' : 'bg-gray-300'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${tmpl.active ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTemplate(tmpl)}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(tmpl.id)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Waiver text preview */}
                    <div className="mt-4 max-h-24 overflow-hidden rounded-lg bg-gray-50 p-3">
                      <p className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-gray-500 line-clamp-4">
                        {tmpl.waiverText}
                      </p>
                    </div>

                    {/* Custom fields */}
                    {tmpl.customFields.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tmpl.customFields.map((f) => (
                          <span key={f.id} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                            {FIELD_TYPE_LABELS[f.type]}: {f.label.slice(0, 30)}{f.label.length > 30 ? '…' : ''}
                            {f.required && <span className="ml-1 text-red-400">*</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ──────────────── SIGNED RECORDS TAB ─────────────── */}
      {tab === 'records' && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Search by client name, email, or waiver…"
              className="flex-1 max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <span className="text-sm text-gray-500">{filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}</span>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
              <span className="text-4xl">✍️</span>
              <p className="mt-3 text-gray-500">
                {signedWaivers.length === 0 ? 'No signed waivers yet. They will appear here after clients complete booking.' : 'No records match your search.'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Date Signed</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Waiver</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">Service</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">Booking</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r, i) => (
                    <tr key={r.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                        {format(parseISO(r.signedAt), 'MMM d, yyyy')}<br />
                        <span className="text-gray-400">{format(parseISO(r.signedAt), 'h:mm a')}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{r.clientName}</p>
                        <p className="text-xs text-gray-400">{r.clientEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{r.waiverName}</p>
                        <p
                          className="mt-0.5 font-mono text-xs italic text-gray-400"
                          style={{ fontFamily: 'cursive' }}
                        >
                          {r.signatureName}
                        </p>
                      </td>
                      <td className="hidden px-4 py-3 text-gray-600 sm:table-cell">{r.serviceName ?? '—'}</td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        {r.bookingId ? (
                          <span className="font-mono text-xs text-sky-700">{r.bookingId}</span>
                        ) : (
                          <Badge color="amber">Pending</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setViewingRecord(r)}
                          className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {editingTemplate !== null && (
        <TemplateModal
          initial={editingTemplate === 'new' ? null : editingTemplate}
          onSave={handleSaveTemplate}
          onClose={() => setEditingTemplate(null)}
        />
      )}
      {viewingRecord && (
        <SignedWaiverModal entry={viewingRecord} onClose={() => setViewingRecord(null)} />
      )}
    </div>
  );
}
