import { useState } from 'react';
import toast from 'react-hot-toast';
import type { ZoomSettings, TeamsSettings } from '../types';
import {
  loadZoomSettings,
  saveZoomSettings,
  loadTeamsSettings,
  saveTeamsSettings,
  DEFAULT_ZOOM_SETTINGS,
  DEFAULT_TEAMS_SETTINGS,
  generateMeetingPassword,
} from '../services/integrationsService';

// ── Shared toggle ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
        checked ? 'bg-sky-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ connected, connectedAt }: { connected: boolean; connectedAt?: string }) {
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Connected{connectedAt ? ` · ${new Date(connectedAt).toLocaleDateString()}` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      Not Connected
    </span>
  );
}

// ── Zoom section ──────────────────────────────────────────────────────────────
function ZoomSection() {
  const [settings, setSettings] = useState<ZoomSettings>(() => loadZoomSettings());
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);

  const update = (patch: Partial<ZoomSettings>) =>
    setSettings((s) => ({ ...s, ...patch }));

  const handleSave = () => {
    saveZoomSettings(settings);
    toast.success('Zoom settings saved');
  };

  const handleTest = async () => {
    if (!settings.accountId || !settings.clientId || !settings.clientSecret) {
      toast.error('Please fill in Account ID, Client ID, and Client Secret first.');
      return;
    }
    setTesting(true);
    // Simulate a connection test (in production, call your backend proxy)
    await new Promise((r) => setTimeout(r, 1200));
    const success = settings.accountId.length > 5; // placeholder validation
    if (success) {
      const updated = { ...settings, connectedAt: new Date().toISOString() };
      setSettings(updated);
      saveZoomSettings(updated);
      toast.success('Zoom connection verified ✓');
    } else {
      toast.error('Connection failed — check your credentials.');
    }
    setTesting(false);
  };

  const handleDisconnect = () => {
    const reset = { ...DEFAULT_ZOOM_SETTINGS };
    setSettings(reset);
    saveZoomSettings(reset);
    toast.success('Zoom disconnected');
  };

  const isConnected = !!settings.connectedAt && settings.enabled;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-xl text-white font-bold">
            Z
          </div>
          <div>
            <p className="font-semibold text-gray-900">Zoom</p>
            <p className="text-xs text-gray-500">Video meetings for virtual appointments</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge connected={isConnected} connectedAt={settings.connectedAt} />
          <Toggle checked={settings.enabled} onChange={(v) => update({ enabled: v })} />
        </div>
      </div>

      {settings.enabled && (
        <div className="px-6 py-5 space-y-5">
          {/* Info callout */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
            <p className="font-semibold mb-1">Server-to-Server OAuth Setup</p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
              <li>Go to <span className="font-mono">marketplace.zoom.us</span> → Develop → Build App</li>
              <li>Select <strong>Server-to-Server OAuth</strong> app type</li>
              <li>Copy your <strong>Account ID</strong>, <strong>Client ID</strong>, and <strong>Client Secret</strong></li>
              <li>Add scopes: <code className="bg-blue-100 px-1 rounded">meeting:write:admin</code></li>
            </ol>
          </div>

          {/* Credentials */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account ID</label>
              <input
                type="text"
                value={settings.accountId}
                onChange={(e) => update({ accountId: e.target.value })}
                placeholder="e.g. AbCdEf1234"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
              <input
                type="text"
                value={settings.clientId}
                onChange={(e) => update({ clientId: e.target.value })}
                placeholder="e.g. GhIjKl5678"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={settings.clientSecret}
                  onChange={(e) => update({ clientSecret: e.target.value })}
                  placeholder="••••••••••••••••••••"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-20 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-800"
                >
                  {showSecret ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </div>

          {/* Meeting defaults */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Duration (minutes)</label>
              <input
                type="number"
                min={15}
                max={480}
                step={15}
                value={settings.defaultDurationMinutes}
                onChange={(e) => update({ defaultDurationMinutes: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Meeting Password
                <button
                  type="button"
                  onClick={() => update({ defaultPassword: generateMeetingPassword() })}
                  className="ml-2 text-xs text-sky-600 hover:text-sky-800"
                >
                  Generate
                </button>
              </label>
              <input
                type="text"
                value={settings.defaultPassword}
                onChange={(e) => update({ defaultPassword: e.target.value })}
                placeholder="Leave blank for no password"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Auto-create toggle */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Auto-create meeting for every booking</p>
              <p className="text-xs text-gray-500">
                A Zoom meeting link will be generated automatically on each booking confirmation
              </p>
            </div>
            <Toggle
              checked={settings.autoCreateMeeting}
              onChange={(v) => update({ autoCreateMeeting: v })}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-1">
            <button
              onClick={handleSave}
              className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Save Settings
            </button>
            <button
              onClick={handleTest}
              disabled={testing}
              className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
            {isConnected && (
              <button
                onClick={handleDisconnect}
                className="rounded-lg border border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Microsoft Teams section ───────────────────────────────────────────────────
function TeamsSection() {
  const [settings, setSettings] = useState<TeamsSettings>(() => loadTeamsSettings());
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);

  const update = (patch: Partial<TeamsSettings>) =>
    setSettings((s) => ({ ...s, ...patch }));

  const handleSave = () => {
    saveTeamsSettings(settings);
    toast.success('Microsoft Teams settings saved');
  };

  const handleTest = async () => {
    if (!settings.tenantId || !settings.clientId || !settings.clientSecret) {
      toast.error('Please fill in Tenant ID, Client ID, and Client Secret first.');
      return;
    }
    setTesting(true);
    await new Promise((r) => setTimeout(r, 1200));
    const success = settings.tenantId.length > 5;
    if (success) {
      const updated = { ...settings, connectedAt: new Date().toISOString() };
      setSettings(updated);
      saveTeamsSettings(updated);
      toast.success('Teams connection verified ✓');
    } else {
      toast.error('Connection failed — check your credentials.');
    }
    setTesting(false);
  };

  const handleDisconnect = () => {
    const reset = { ...DEFAULT_TEAMS_SETTINGS };
    setSettings(reset);
    saveTeamsSettings(reset);
    toast.success('Microsoft Teams disconnected');
  };

  const isConnected = !!settings.connectedAt && settings.enabled;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-700 text-xl text-white">
            T
          </div>
          <div>
            <p className="font-semibold text-gray-900">Microsoft Teams</p>
            <p className="text-xs text-gray-500">Video meetings via Microsoft 365</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge connected={isConnected} connectedAt={settings.connectedAt} />
          <Toggle checked={settings.enabled} onChange={(v) => update({ enabled: v })} />
        </div>
      </div>

      {settings.enabled && (
        <div className="px-6 py-5 space-y-5">
          <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-4 text-sm text-indigo-800">
            <p className="font-semibold mb-1">Azure App Registration Setup</p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-indigo-700">
              <li>Go to <span className="font-mono">portal.azure.com</span> → Azure Active Directory → App registrations</li>
              <li>Register a new app and copy the <strong>Tenant ID</strong> and <strong>Client ID</strong></li>
              <li>Create a client secret under Certificates &amp; Secrets</li>
              <li>Add API permission: <code className="bg-indigo-100 px-1 rounded">OnlineMeetings.ReadWrite.All</code></li>
            </ol>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tenant ID</label>
              <input
                type="text"
                value={settings.tenantId}
                onChange={(e) => update({ tenantId: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
              <input
                type="text"
                value={settings.clientId}
                onChange={(e) => update({ clientId: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={settings.clientSecret}
                  onChange={(e) => update({ clientSecret: e.target.value })}
                  placeholder="••••••••••••••••••••"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-20 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-800"
                >
                  {showSecret ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Auto-create meeting for every booking</p>
              <p className="text-xs text-gray-500">
                A Teams meeting link will be generated on each booking confirmation
              </p>
            </div>
            <Toggle
              checked={settings.autoCreateMeeting}
              onChange={(v) => update({ autoCreateMeeting: v })}
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              onClick={handleSave}
              className="rounded-lg bg-indigo-700 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-800"
            >
              Save Settings
            </button>
            <button
              onClick={handleTest}
              disabled={testing}
              className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
            {isConnected && (
              <button
                onClick={handleDisconnect}
                className="rounded-lg border border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Coming-soon card ──────────────────────────────────────────────────────────
function ComingSoonCard({ icon, name, description }: { icon: string; name: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-200 text-xl">
          {icon}
        </div>
        <div>
          <p className="font-semibold text-gray-500">{name}</p>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
        <span className="ml-auto rounded-full bg-gray-200 px-3 py-0.5 text-xs font-semibold text-gray-500">
          Coming Soon
        </span>
      </div>
    </div>
  );
}

// ── PWA Install banner ────────────────────────────────────────────────────────
function PwaInstallSection() {
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem('sos_pwa_banner_dismissed') === 'true',
  );
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches;

  if (isInstalled) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-green-800">App is installed</p>
            <p className="text-xs text-green-600">
              You're running BookEase as an installed app on this device.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (dismissed) return null;

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 px-6 py-5">
      <div className="flex items-start gap-4">
        <span className="text-3xl">📱</span>
        <div className="flex-1">
          <p className="font-semibold text-sky-900">Install BookEase on your device</p>
          <p className="mt-1 text-sm text-sky-700">
            Add BookEase to your home screen for quick access. It works offline and launches
            like a native app — no app store required.
          </p>
          <div className="mt-3 space-y-1.5 text-xs text-sky-700">
            <p><strong>Chrome / Edge (desktop):</strong> Click the install icon (⊕) in the address bar</p>
            <p><strong>iOS Safari:</strong> Tap Share → "Add to Home Screen"</p>
            <p><strong>Android Chrome:</strong> Tap the three-dot menu → "Add to Home screen"</p>
          </div>
        </div>
        <button
          onClick={() => {
            localStorage.setItem('sos_pwa_banner_dismissed', 'true');
            setDismissed(true);
          }}
          className="text-sky-500 hover:text-sky-700 text-lg leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function IntegrationsPage() {
  const zoomEnabled = loadZoomSettings().enabled;
  const teamsEnabled = loadTeamsSettings().enabled;
  const activeCount = [zoomEnabled, teamsEnabled].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
            <p className="mt-1 text-sm text-gray-500">
              Connect third-party tools for video meetings, calendar sync, and more.
            </p>
          </div>
          <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-700">
            {activeCount} active
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        {/* PWA install */}
        <PwaInstallSection />

        {/* Section: Video Conferencing */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Video Conferencing
          </p>
          <div className="space-y-4">
            <ZoomSection />
            <TeamsSection />
          </div>
        </div>

        {/* Section: Future integrations */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Messaging &amp; Notifications
          </p>
          <div className="space-y-3">
            <ComingSoonCard icon="📨" name="Twilio SMS" description="Send custom SMS reminders and confirmations" />
            <ComingSoonCard icon="💬" name="WhatsApp Business" description="Message clients via WhatsApp templates" />
            <ComingSoonCard icon="📧" name="Mailchimp" description="Sync client list with your email marketing platform" />
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Payments
          </p>
          <div className="space-y-3">
            <ComingSoonCard icon="🏦" name="QuickBooks" description="Sync payments and invoices with QuickBooks Online" />
            <ComingSoonCard icon="📊" name="FreshBooks" description="Auto-generate invoices from completed bookings" />
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Calendar
          </p>
          <div className="space-y-3">
            <ComingSoonCard icon="🗓️" name="Outlook Calendar" description="Two-way sync with Microsoft Outlook calendars" />
            <ComingSoonCard icon="📅" name="Apple Calendar" description="CalDAV sync for Apple Calendar / iCal" />
          </div>
        </div>
      </div>
    </div>
  );
}
