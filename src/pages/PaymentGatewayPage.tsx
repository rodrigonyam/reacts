/**
 * PaymentGatewayPage — admin settings for payment gateways and deposit policy.
 *
 * Lets the operator enable/configure Stripe, PayPal, and Square individually,
 * set test vs. live mode, store API keys, and configure deposit rules.
 * All settings persist to localStorage via paymentGatewayService.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  loadGatewaySettings,
  saveGatewaySettings,
  DEFAULT_GATEWAY_SETTINGS,
} from '../services/paymentGatewayService';
import type { PaymentGatewaySettings, PaymentGateway, GatewayConfig } from '../types';

// ── Gateway metadata ──────────────────────────────────────────────────────────
const GATEWAY_META: Record<
  PaymentGateway,
  { label: string; icon: string; color: string; keyFields: { key: keyof GatewayConfig; label: string; placeholder: string }[] }
> = {
  stripe: {
    label: 'Stripe',
    icon: '💳',
    color: '#635bff',
    keyFields: [
      { key: 'publishableKey', label: 'Publishable Key', placeholder: 'pk_test_...' },
    ],
  },
  paypal: {
    label: 'PayPal',
    icon: '🅿️',
    color: '#003087',
    keyFields: [
      { key: 'clientId', label: 'Client ID', placeholder: 'AXxx...' },
    ],
  },
  square: {
    label: 'Square',
    icon: '🔲',
    color: '#3e4348',
    keyFields: [
      { key: 'applicationId', label: 'Application ID', placeholder: 'sq0iid-...' },
      { key: 'locationId',    label: 'Location ID',     placeholder: 'LXXXXXXXX' },
    ],
  },
};

const GATEWAYS: PaymentGateway[] = ['stripe', 'paypal', 'square'];

// ── Input helper ──────────────────────────────────────────────────────────────
const INPUT_CLS =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ' +
  'focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-gray-50 disabled:text-gray-400';

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-1
          ${checked ? 'bg-sky-500' : 'bg-gray-300'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </label>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════════════════
export function PaymentGatewayPage() {
  const [settings, setSettings] = useState<PaymentGatewaySettings>(loadGatewaySettings);
  const [dirty, setDirty] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const update = (patch: Partial<PaymentGatewaySettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const updateGateway = (gw: PaymentGateway, patch: Partial<GatewayConfig>) => {
    setSettings((prev) => ({
      ...prev,
      gateways: {
        ...prev.gateways,
        [gw]: { ...prev.gateways[gw], ...patch },
      },
    }));
    setDirty(true);
  };

  const handleSave = () => {
    saveGatewaySettings(settings);
    setDirty(false);
    toast.success('Payment settings saved.');
  };

  const handleReset = () => {
    setSettings(DEFAULT_GATEWAY_SETTINGS);
    saveGatewaySettings(DEFAULT_GATEWAY_SETTINGS);
    setDirty(false);
    toast.success('Settings reset to defaults.');
  };

  // ── Deposit preview ───────────────────────────────────────────────────────
  const previewTotal = 100_00; // $100 example
  const depositPreview =
    settings.depositEnabled
      ? settings.depositType === 'fixed'
        ? `$${(Math.min(settings.depositValue, previewTotal) / 100).toFixed(2)}`
        : `$${((previewTotal * settings.depositValue) / 100 / 100).toFixed(2)}`
      : '$100.00';

  const enabledCount = GATEWAYS.filter((g) => settings.gateways[g].enabled).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure payment gateways and deposit policies for the booking page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {dirty ? 'Save Changes' : 'Saved ✓'}
          </button>
        </div>
      </div>

      {/* Status summary */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{enabledCount}</p>
          <p className="mt-0.5 text-xs text-gray-500">Active Gateway{enabledCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900">
            {settings.gateways[settings.defaultGateway]?.enabled
              ? GATEWAY_META[settings.defaultGateway].icon
              : '—'}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">Default Gateway</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900">
            {settings.depositEnabled
              ? settings.depositType === 'fixed'
                ? `$${(settings.depositValue / 100).toFixed(0)}`
                : `${settings.depositValue}%`
              : 'Off'}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">Deposit</p>
        </div>
      </div>

      {/* Gateways */}
      <section className="mb-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Payment Gateways</h2>
        {GATEWAYS.map((gw) => {
          const meta = GATEWAY_META[gw];
          const cfg = settings.gateways[gw];
          const isDefault = settings.defaultGateway === gw;

          return (
            <div
              key={gw}
              className={`rounded-xl border bg-white shadow-sm transition-all ${
                cfg.enabled ? 'border-sky-200' : 'border-gray-200'
              }`}
            >
              {/* Gateway header */}
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-lg"
                    style={{ backgroundColor: `${meta.color}15` }}
                  >
                    {meta.icon}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{meta.label}</span>
                      {isDefault && cfg.enabled && (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {cfg.enabled ? (cfg.testMode ? 'Test mode' : 'Live mode') : 'Disabled'}
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={cfg.enabled}
                  onChange={(v) => updateGateway(gw, { enabled: v })}
                  label={cfg.enabled ? 'Enabled' : 'Disabled'}
                />
              </div>

              {/* Expanded config when enabled */}
              {cfg.enabled && (
                <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
                  {/* Test / Live mode */}
                  <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-amber-800">Test Mode</p>
                      <p className="text-xs text-amber-600">
                        No real charges are processed in test mode.
                      </p>
                    </div>
                    <Toggle
                      checked={cfg.testMode}
                      onChange={(v) => updateGateway(gw, { testMode: v })}
                      label={cfg.testMode ? 'On' : 'Off'}
                    />
                  </div>

                  {/* API key fields */}
                  <div className="space-y-3">
                    {meta.keyFields.map((field) => (
                      <div key={field.key}>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          {field.label}
                        </label>
                        <input
                          type="text"
                          value={(cfg[field.key] as string) ?? ''}
                          onChange={(e) => updateGateway(gw, { [field.key]: e.target.value })}
                          placeholder={field.placeholder}
                          className={INPUT_CLS}
                          autoComplete="off"
                        />
                      </div>
                    ))}
                    <p className="text-xs text-gray-400">
                      API keys are stored locally and never transmitted by this demo app.
                    </p>
                  </div>

                  {/* Set as default */}
                  {!isDefault && (
                    <button
                      type="button"
                      onClick={() => update({ defaultGateway: gw })}
                      className="text-xs font-medium text-sky-600 hover:underline"
                    >
                      Set as default gateway →
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Deposit / Partial Payment Policy */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Deposit Policy</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Require clients to pay a deposit at booking with the balance due at the appointment.
            </p>
          </div>
          <Toggle
            checked={settings.depositEnabled}
            onChange={(v) => update({ depositEnabled: v })}
            label={settings.depositEnabled ? 'Enabled' : 'Disabled'}
          />
        </div>

        {settings.depositEnabled && (
          <div className="px-5 pb-5 pt-4 space-y-5">
            {/* Type */}
            <div>
              <p className="mb-2 text-xs font-medium text-gray-600">Deposit Type</p>
              <div className="flex gap-3">
                {(['percent', 'fixed'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update({ depositType: t })}
                    className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                      settings.depositType === t
                        ? 'border-sky-500 bg-sky-50 text-sky-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-sky-200'
                    }`}
                  >
                    {t === 'percent' ? '% Percentage' : '$ Fixed Amount'}
                  </button>
                ))}
              </div>
            </div>

            {/* Value */}
            <div className="grid grid-cols-2 gap-4 items-end">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {settings.depositType === 'percent' ? 'Percentage (%)' : 'Amount ($)'}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    {settings.depositType === 'percent' ? '%' : '$'}
                  </span>
                  <input
                    type="number"
                    min={settings.depositType === 'percent' ? 1 : 1}
                    max={settings.depositType === 'percent' ? 100 : undefined}
                    value={
                      settings.depositType === 'percent'
                        ? settings.depositValue
                        : (settings.depositValue / 100).toFixed(2)
                    }
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      update({
                        depositValue:
                          settings.depositType === 'percent'
                            ? Math.min(100, Math.max(1, Math.round(v)))
                            : Math.round(v * 100),
                      });
                    }}
                    className={`${INPUT_CLS} pl-7`}
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Preview on $100 booking
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  Deposit due now:{' '}
                  <span className="text-sky-700">{depositPreview}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Remaining at appointment:{' '}
                  {settings.depositType === 'fixed'
                    ? `$${((previewTotal - Math.min(settings.depositValue, previewTotal)) / 100).toFixed(2)}`
                    : `$${(previewTotal * (1 - settings.depositValue / 100) / 100).toFixed(2)}`}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-400">
              Clients will be shown both options at checkout: "Pay deposit now" or "Pay in full".
            </p>
          </div>
        )}
      </section>

      {/* Test card reference */}
      <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Test Card Numbers
        </p>
        <div className="space-y-1 text-xs text-gray-600 font-mono">
          <div className="flex justify-between">
            <span>4242 4242 4242 4242</span>
            <span className="text-green-600 font-sans">✓ Approved</span>
          </div>
          <div className="flex justify-between">
            <span>4000 0000 0000 0002</span>
            <span className="text-red-600 font-sans">✗ Declined</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">Use any future expiry date and any 3-digit CVC.</p>
      </div>
    </div>
  );
}
