import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { BrandingSettings } from '../types';
import {
  applyBrandingToDOM,
  deriveColorVariants,
  loadBranding,
  saveBranding,
} from '../services/brandingService';

// ── Constants ─────────────────────────────────────────────────────────────────

const FONT_OPTIONS = [
  { label: 'Inter (Default)',    value: "'Inter', system-ui, -apple-system, sans-serif" },
  { label: 'Roboto',             value: "'Roboto', sans-serif" },
  { label: 'Open Sans',          value: "'Open Sans', sans-serif" },
  { label: 'Lato',               value: "'Lato', sans-serif" },
  { label: 'Poppins',            value: "'Poppins', sans-serif" },
  { label: 'Montserrat',         value: "'Montserrat', sans-serif" },
  { label: 'Playfair Display',   value: "'Playfair Display', Georgia, serif" },
  { label: 'Georgia (Serif)',    value: 'Georgia, serif' },
  { label: 'System Default',     value: 'system-ui, -apple-system, sans-serif' },
];

const COLOR_SWATCHES = [
  { label: 'Sky',     value: '#0284c7' },
  { label: 'Blue',    value: '#1d4ed8' },
  { label: 'Violet',  value: '#7c3aed' },
  { label: 'Pink',    value: '#db2777' },
  { label: 'Rose',    value: '#e11d48' },
  { label: 'Orange',  value: '#ea580c' },
  { label: 'Amber',   value: '#d97706' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Teal',    value: '#0d9488' },
  { label: 'Slate',   value: '#475569' },
];

// ── Live Preview ──────────────────────────────────────────────────────────────

function LivePreview({ settings }: { settings: BrandingSettings }) {
  const { light } = deriveColorVariants(settings.primaryColor);
  const font = settings.fontFamily || 'system-ui, sans-serif';

  return (
    <div className="sticky top-6 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Live Preview</p>

      {/* Mini sidebar */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex h-13 items-center gap-2.5 border-b border-gray-100 px-4 py-3">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="logo" className="h-7 w-7 rounded object-contain" />
          ) : (
            <span className="text-xl">📆</span>
          )}
          <span className="font-bold text-gray-900 truncate" style={{ fontFamily: font }}>
            {settings.businessName || 'Your Business'}
          </span>
        </div>
        <div className="space-y-0.5 px-2.5 py-2.5">
          {['Dashboard', 'Bookings', 'Clients', 'Staff'].map((item, i) => (
            <div
              key={item}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
              style={{
                backgroundColor: i === 0 ? light : 'transparent',
                color: i === 0 ? settings.primaryColor : '#6b7280',
                fontFamily: font,
              }}
            >
              <span>{['📅', '📋', '👤', '🧑‍⚕️'][i]}</span>
              {item}
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 px-3 py-3">
          <div
            className="w-full rounded-lg py-2 text-center text-xs font-semibold text-white"
            style={{ backgroundColor: settings.primaryColor, fontFamily: font }}
          >
            📅 Client Booking Page
          </div>
        </div>
      </div>

      {/* Booking page header preview */}
      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 text-white" style={{ backgroundColor: settings.primaryColor }}>
          <p className="font-bold text-sm" style={{ fontFamily: font }}>
            {settings.bookingPageTitle || 'Book an Appointment'}
          </p>
          <p className="mt-1 text-xs opacity-80" style={{ fontFamily: font }}>
            {settings.bookingPageWelcomeText || 'Choose a service and pick a time.'}
          </p>
        </div>
        <div className="flex items-center justify-between bg-gray-50 px-5 py-3">
          <span className="text-xs text-gray-400" style={{ fontFamily: font }}>Step 1 of 6</span>
          <div
            className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: settings.primaryColor, fontFamily: font }}
          >
            Next →
          </div>
        </div>
      </div>

      {/* Color palette */}
      {(() => {
        const { light: l, dark: d } = deriveColorVariants(settings.primaryColor);
        return (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-2 text-xs text-gray-400">Color palette</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-8 rounded-l-lg" style={{ backgroundColor: l }} title="Light" />
              <div className="flex-1 h-8" style={{ backgroundColor: settings.primaryColor }} title="Primary" />
              <div className="flex-1 h-8 rounded-r-lg" style={{ backgroundColor: d }} title="Dark" />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-gray-400 px-1">
              <span>light</span><span>primary</span><span>dark</span>
            </div>
            <div className="mt-3 h-8 rounded-lg" style={{ backgroundColor: settings.accentColor }} title="Accent" />
            <p className="mt-1 text-center text-[10px] text-gray-400">accent</p>
          </div>
        );
      })()}

      {/* Typography */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="mb-1 text-xs text-gray-400">Typography</p>
        <p className="text-base font-semibold text-gray-900" style={{ fontFamily: font }}>
          The quick brown fox
        </p>
        <p className="text-sm text-gray-500" style={{ fontFamily: font }}>
          jumps over the lazy dog — 0123456
        </p>
      </div>
    </div>
  );
}

// ── Color picker row ──────────────────────────────────────────────────────────

function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-0.5 block text-sm font-medium text-gray-700">{label}</label>
      <p className="mb-2 text-xs text-gray-400">{hint}</p>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded-lg border border-gray-300 p-1"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          maxLength={7}
          placeholder="#000000"
          className="w-28 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>
      <p className="mb-1.5 mt-3 text-xs text-gray-400">Quick picks:</p>
      <div className="flex flex-wrap gap-2">
        {COLOR_SWATCHES.map((s) => (
          <button
            key={s.value}
            type="button"
            title={s.label}
            onClick={() => onChange(s.value)}
            className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
            style={{
              backgroundColor: s.value,
              borderColor: value === s.value ? '#1f2937' : 'transparent',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function BrandingPage() {
  const [settings, setSettings] = useState<BrandingSettings>(() => loadBranding());
  const [saving, setSaving] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof BrandingSettings>(key: K, value: BrandingSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  function handleImageUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'logoUrl' | 'faviconUrl',
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file.'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => update(field, reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = ''; // reset so the same file can be re-selected
  }

  function handleSave() {
    if (!settings.businessName.trim()) { toast.error('Business name is required.'); return; }
    setSaving(true);
    try {
      saveBranding(settings);
      applyBrandingToDOM(settings);
      window.dispatchEvent(new Event('brandingUpdated'));
      toast.success('Branding saved!');
    } catch {
      toast.error('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customization & Branding</h1>
          <p className="mt-1 text-sm text-gray-500">
            Personalize your business identity, colors, and client-facing booking experience.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity disabled:opacity-60"
          style={{ backgroundColor: settings.primaryColor }}
        >
          {saving ? 'Saving…' : '💾 Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
        {/* ── Left: settings ─────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Brand Identity */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-900">🏷 Brand Identity</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Business Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={settings.businessName}
                  onChange={(e) => update('businessName', e.target.value)}
                  placeholder="Your Business Name"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Tagline</label>
                <input
                  type="text"
                  value={settings.tagline}
                  onChange={(e) => update('tagline', e.target.value)}
                  placeholder="A short description of your business"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Logo */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Business Logo</label>
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="logo" className="h-full w-full object-contain p-1" />
                    ) : (
                      <span className="text-2xl opacity-30">🖼</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => logoRef.current?.click()}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      {settings.logoUrl ? 'Change' : 'Upload Logo'}
                    </button>
                    {settings.logoUrl && (
                      <button
                        type="button"
                        onClick={() => update('logoUrl', '')}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    )}
                    <input
                      ref={logoRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'logoUrl')}
                    />
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-gray-400">PNG, SVG, or JPG · Max 2 MB · 200×200 px recommended</p>
              </div>

              {/* Favicon */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Favicon</label>
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50">
                    {settings.faviconUrl ? (
                      <img src={settings.faviconUrl} alt="favicon" className="h-8 w-8 object-contain" />
                    ) : (
                      <span className="text-2xl opacity-30">🔖</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => faviconRef.current?.click()}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      {settings.faviconUrl ? 'Change' : 'Upload Favicon'}
                    </button>
                    {settings.faviconUrl && (
                      <button
                        type="button"
                        onClick={() => update('faviconUrl', '')}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    )}
                    <input
                      ref={faviconRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'faviconUrl')}
                    />
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-gray-400">PNG or ICO · Max 2 MB · 32×32 or 64×64 px</p>
              </div>
            </div>
          </section>

          {/* Colors */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-900">🎨 Brand Colors</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <ColorField
                label="Primary Color"
                hint="Used for buttons, active links, and key UI elements."
                value={settings.primaryColor}
                onChange={(v) => update('primaryColor', v)}
              />
              <ColorField
                label="Accent Color"
                hint="Secondary highlights, badges, and decorative elements."
                value={settings.accentColor}
                onChange={(v) => update('accentColor', v)}
              />
            </div>
          </section>

          {/* Typography */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-900">✏️ Typography</h2>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Font Family</label>
              <select
                value={settings.fontFamily}
                onChange={(e) => update('fontFamily', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <p className="mt-3 text-sm text-gray-700" style={{ fontFamily: settings.fontFamily }}>
                Preview: The quick brown fox jumps over the lazy dog — ABCDEFG 0123456789
              </p>
            </div>
          </section>

          {/* Booking Page Text */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-900">📄 Booking Page Text</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Page Title</label>
                <input
                  type="text"
                  value={settings.bookingPageTitle}
                  onChange={(e) => update('bookingPageTitle', e.target.value)}
                  placeholder="Book an Appointment"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Welcome Message</label>
                <textarea
                  rows={3}
                  value={settings.bookingPageWelcomeText}
                  onChange={(e) => update('bookingPageWelcomeText', e.target.value)}
                  placeholder="Choose a service and pick a time that works for you."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>
          </section>

          {/* Custom Domain */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-900">🌐 Custom Domain</h2>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Domain</label>
              <div className="flex items-center overflow-hidden rounded-lg border border-gray-300 focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500">
                <span className="border-r border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-400">
                  https://
                </span>
                <input
                  type="text"
                  value={settings.customDomain}
                  onChange={(e) => update('customDomain', e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
                  placeholder="booking.yourbusiness.com"
                  className="flex-1 px-3 py-2.5 text-sm outline-none bg-white"
                />
              </div>
            </div>

            {settings.customDomain && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold text-amber-800">DNS Configuration Required</p>
                <p className="mt-1 text-xs text-amber-700">
                  Add the following CNAME record at your domain registrar to point{' '}
                  <code className="rounded bg-amber-100 px-1 font-mono">{settings.customDomain}</code> to this app.
                </p>
                <div className="mt-3 overflow-x-auto rounded-lg border border-amber-200 bg-white">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-amber-100 bg-amber-50">
                        <th className="px-3 py-2 text-left font-semibold text-amber-900">Type</th>
                        <th className="px-3 py-2 text-left font-semibold text-amber-900">Name</th>
                        <th className="px-3 py-2 text-left font-semibold text-amber-900">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-2 font-mono text-gray-700">CNAME</td>
                        <td className="px-3 py-2 font-mono text-gray-700">
                          {settings.customDomain.split('.')[0]}
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-700">app.bookease.io</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-medium text-gray-600">Your public booking URL</p>
              <p className="mt-1 break-all font-mono text-xs text-sky-600">
                {settings.customDomain
                  ? `https://${settings.customDomain}/book`
                  : `${window.location.origin}/book`}
              </p>
              <button
                type="button"
                className="mt-2 text-xs text-sky-600 hover:underline"
                onClick={() => {
                  const link = settings.customDomain
                    ? `https://${settings.customDomain}/book`
                    : `${window.location.origin}/book`;
                  navigator.clipboard.writeText(link).then(() => toast.success('Link copied!'));
                }}
              >
                📋 Copy link
              </button>
            </div>
          </section>

          {/* Last saved */}
          {settings.updatedAt && (
            <p className="text-right text-xs text-gray-400">
              Last saved: {new Date(settings.updatedAt).toLocaleString()}
            </p>
          )}
        </div>

        {/* ── Right: Live Preview ─────────────────────────────────────────── */}
        <div className="hidden lg:block">
          <LivePreview settings={settings} />
        </div>
      </div>
    </div>
  );
}
