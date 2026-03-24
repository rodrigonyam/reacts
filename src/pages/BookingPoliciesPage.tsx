/**
 * BookingPoliciesPage — admin page to configure rescheduling & cancellation rules.
 *
 * Sections:
 *  - Reschedule rules (enabled, max reschedules, notice window)
 *  - Cancellation rules (enabled, notice window)
 *  - Refund tiers (add / edit / remove)
 *  - Admin controls (override privilege)
 *  - Preview panel showing what clients will see
 */
import { useState } from 'react';
import { useBookingStore } from '../store/bookingStore';
import { DEFAULT_POLICY, getPolicySummaryLines } from '../services/policyService';
import type { BookingPolicy, RefundTier } from '../types';

// ── Small helpers ─────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function newTier(): RefundTier {
  return { hoursBeforeAppointment: 24, refundPct: 50, label: '50% refund' };
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors
          ${checked ? 'bg-sky-600' : 'bg-gray-300'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
            ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </button>
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
      </div>
    </label>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  unit,
  note,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  note?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(clamp(Number(e.target.value), min, max))}
          className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <span className="text-sm text-gray-500">{unit}</span>
      </div>
      {note && <p className="text-xs text-gray-400">{note}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BookingPoliciesPage() {
  const { policy, setPolicy } = useBookingStore();
  const [draft, setDraft] = useState<BookingPolicy>({ ...policy, refundTiers: [...policy.refundTiers] });
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof BookingPolicy>(key: K, value: BookingPolicy[K]) => {
    setSaved(false);
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    setPolicy(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    const reset = { ...DEFAULT_POLICY, refundTiers: [...DEFAULT_POLICY.refundTiers] };
    setDraft(reset);
    setSaved(false);
  };

  // Refund tier helpers
  const updateTier = (index: number, field: keyof RefundTier, value: string | number) => {
    setSaved(false);
    setDraft((prev) => ({
      ...prev,
      refundTiers: prev.refundTiers.map((t, i) =>
        i === index ? { ...t, [field]: value } : t,
      ),
    }));
  };

  const addTier = () => {
    setSaved(false);
    setDraft((prev) => ({ ...prev, refundTiers: [...prev.refundTiers, newTier()] }));
  };

  const removeTier = (index: number) => {
    setSaved(false);
    setDraft((prev) => ({
      ...prev,
      refundTiers: prev.refundTiers.filter((_, i) => i !== index),
    }));
  };

  const previewLines = getPolicySummaryLines(draft);

  return (
    <div className="space-y-8 p-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">📋 Booking Policies</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure the rules clients must follow when rescheduling or cancelling.
          Changes take effect immediately for all future reschedule requests.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">

          {/* ── Reschedule Rules ────────────────────────────────────────────── */}
          <SectionCard title="🔄 Reschedule Rules">
            <div className="space-y-5">
              <Toggle
                checked={draft.rescheduleEnabled}
                onChange={(v) => update('rescheduleEnabled', v)}
                label="Allow rescheduling"
                description="If disabled, clients cannot reschedule via their booking link."
              />

              {draft.rescheduleEnabled && (
                <div className="ml-12 space-y-4 border-l-2 border-sky-100 pl-5">
                  <NumberInput
                    label="Maximum reschedules per booking"
                    value={draft.maxReschedules}
                    min={0}
                    max={20}
                    unit="reschedules"
                    note="Set to 0 for unlimited rescheduling."
                    onChange={(v) => update('maxReschedules', v)}
                  />
                  <NumberInput
                    label="Minimum notice required"
                    value={draft.rescheduleNoticeHours}
                    min={0}
                    max={168}
                    unit="hours before appointment"
                    note="Set to 0 to allow last-minute rescheduling."
                    onChange={(v) => update('rescheduleNoticeHours', v)}
                  />
                </div>
              )}
            </div>
          </SectionCard>

          {/* ── Cancellation Rules ──────────────────────────────────────────── */}
          <SectionCard title="❌ Cancellation Rules">
            <div className="space-y-5">
              <Toggle
                checked={draft.cancellationEnabled}
                onChange={(v) => update('cancellationEnabled', v)}
                label="Allow cancellations"
                description="If disabled, clients cannot cancel via their booking link."
              />

              {draft.cancellationEnabled && (
                <div className="ml-12 space-y-4 border-l-2 border-sky-100 pl-5">
                  <NumberInput
                    label="Minimum notice required"
                    value={draft.cancellationNoticeHours}
                    min={0}
                    max={168}
                    unit="hours before appointment"
                    note="Set to 0 to allow cancellation up to the last minute."
                    onChange={(v) => update('cancellationNoticeHours', v)}
                  />
                </div>
              )}
            </div>
          </SectionCard>

          {/* ── Refund Tiers ────────────────────────────────────────────────── */}
          <SectionCard title="💰 Refund Tiers">
            <p className="mb-4 text-sm text-gray-500">
              Define what percentage of the payment is refunded based on how early the client cancels.
              Tiers are evaluated from highest to lowest notice.
            </p>

            {draft.refundTiers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 py-6 text-center text-sm text-gray-400">
                No refund tiers configured — no refunds will be issued.
              </p>
            ) : (
              <div className="space-y-3 mb-4">
                {draft.refundTiers.map((tier, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex flex-col gap-1 min-w-[120px]">
                      <label className="text-xs font-medium text-gray-600">Hours notice ≥</label>
                      <input
                        type="number"
                        value={tier.hoursBeforeAppointment}
                        min={0}
                        max={720}
                        onChange={(e) => updateTier(i, 'hoursBeforeAppointment', clamp(Number(e.target.value), 0, 720))}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1 min-w-[80px]">
                      <label className="text-xs font-medium text-gray-600">Refund %</label>
                      <input
                        type="number"
                        value={tier.refundPct}
                        min={0}
                        max={100}
                        onChange={(e) => updateTier(i, 'refundPct', clamp(Number(e.target.value), 0, 100))}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1 min-w-[160px]">
                      <label className="text-xs font-medium text-gray-600">Label shown to client</label>
                      <input
                        type="text"
                        value={tier.label}
                        maxLength={40}
                        onChange={(e) => updateTier(i, 'label', e.target.value)}
                        placeholder='e.g. "Full refund"'
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTier(i)}
                      className="mb-0.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={addTier}
              className="flex items-center gap-2 rounded-lg border border-dashed border-sky-300 px-4 py-2 text-sm font-medium text-sky-600 hover:border-sky-500 hover:bg-sky-50 transition-colors"
            >
              + Add refund tier
            </button>
          </SectionCard>

          {/* ── Admin Controls ──────────────────────────────────────────────── */}
          <SectionCard title="🔐 Admin Controls">
            <Toggle
              checked={draft.adminCanOverride}
              onChange={(v) => update('adminCanOverride', v)}
              label="Allow admin policy override"
              description="When enabled, admins can reschedule any booking from the dashboard even if it violates the policy rules above."
            />
          </SectionCard>

          {/* ── Save / Reset ────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-700 transition-colors"
            >
              {saved ? '✓ Saved!' : 'Save Policy'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Reset to defaults
            </button>
          </div>
        </div>

        {/* ── Live Preview Panel ────────────────────────────────────────────── */}
        <aside className="space-y-4">
          <div className="sticky top-6">
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-sky-800">👤 What clients will see</h3>
              <div className="space-y-1.5">
                {previewLines.map((line, i) => (
                  <p key={i} className="text-xs text-sky-700 leading-relaxed">{line}</p>
                ))}
              </div>
            </div>

            {/* Visual summary badges */}
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quick summary</h4>

              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${draft.rescheduleEnabled ? 'bg-green-500' : 'bg-red-400'}`} />
                <span className="text-xs text-gray-700">
                  Rescheduling: <strong>{draft.rescheduleEnabled ? 'On' : 'Off'}</strong>
                </span>
              </div>

              {draft.rescheduleEnabled && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 ml-4">
                      Max: <strong>{draft.maxReschedules === 0 ? 'Unlimited' : draft.maxReschedules}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 ml-4">
                      Notice: <strong>{draft.rescheduleNoticeHours}h</strong>
                    </span>
                  </div>
                </>
              )}

              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${draft.cancellationEnabled ? 'bg-green-500' : 'bg-red-400'}`} />
                <span className="text-xs text-gray-700">
                  Cancellations: <strong>{draft.cancellationEnabled ? 'On' : 'Off'}</strong>
                </span>
              </div>

              {draft.cancellationEnabled && draft.refundTiers.length > 0 && (
                <div className="ml-4 space-y-1">
                  {[...draft.refundTiers]
                    .sort((a, b) => b.hoursBeforeAppointment - a.hoursBeforeAppointment)
                    .map((t, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">≥{t.hoursBeforeAppointment}h before</span>
                        <span className={`text-xs font-semibold ${t.refundPct === 100 ? 'text-green-600' : t.refundPct === 0 ? 'text-red-500' : 'text-amber-600'}`}>
                          {t.refundPct}% refund
                        </span>
                      </div>
                    ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${draft.adminCanOverride ? 'bg-sky-500' : 'bg-gray-300'}`} />
                <span className="text-xs text-gray-700">
                  Admin override: <strong>{draft.adminCanOverride ? 'Enabled' : 'Disabled'}</strong>
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
