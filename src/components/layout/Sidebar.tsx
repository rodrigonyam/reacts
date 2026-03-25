import { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { loadBranding } from '../../services/brandingService';
import type { BrandingSettings } from '../../types';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '📅', end: true },
  { to: '/bookings', label: 'Bookings', icon: '📋', end: false },
  { to: '/slots', label: 'Slots', icon: '🕐', end: false },
  { to: '/calendar-sync', label: 'Calendar Sync', icon: '🔄', end: false },
  { to: '/reminders',     label: 'Reminders',     icon: '🔔', end: false },
  { to: '/timezone',      label: 'Time Zones',     icon: '🌍', end: false },
  { to: '/policies',      label: 'Policies',       icon: '📋', end: false },
  { to: '/clients',  label: 'Clients',       icon: '👤', end: false },
  { to: '/groups',   label: 'Group Classes',  icon: '👥', end: false },
  { to: '/staff',    label: 'Staff',          icon: '🧑‍⚕️', end: false },
  { to: '/payment-settings', label: 'Payment Settings', icon: '💳', end: false },
  { to: '/waivers', label: 'Waivers & Intake', icon: '📝', end: false },
  { to: '/branding', label: 'Branding', icon: '🎨', end: false },
];

export function Sidebar() {
  const [branding, setBranding] = useState<BrandingSettings>(() => loadBranding());

  useEffect(() => {
    const refresh = () => setBranding(loadBranding());
    window.addEventListener('brandingUpdated', refresh);
    return () => window.removeEventListener('brandingUpdated', refresh);
  }, []);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      {/* Logo / Business Name */}
      <div className="flex h-16 items-center gap-3 border-b border-gray-100 px-6">
        {branding.logoUrl ? (
          <img src={branding.logoUrl} alt="logo" className="h-8 w-8 rounded object-contain" />
        ) : (
          <span className="text-2xl">📆</span>
        )}
        <span className="truncate text-lg font-bold text-gray-900">
          {branding.businessName || 'BookEase'}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? '' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
            style={({ isActive }) =>
              isActive
                ? { backgroundColor: 'var(--brand-primary-light)', color: 'var(--brand-primary)' }
                : undefined
            }
          >
            <span className="text-base">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Book Now CTA */}
      <div className="border-t border-gray-100 px-4 py-4">
        <Link
          to="/book"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          📅 Client Booking Page
        </Link>
        <p className="mt-2 text-center text-[10px] text-gray-400">Share this link with your clients</p>
      </div>
    </aside>
  );
}

export function Sidebar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-gray-100 px-6">
        <span className="text-2xl">📆</span>
        <span className="text-lg font-bold text-gray-900">BookEase</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-sky-50 text-sky-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <span className="text-base">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Book Now CTA */}
      <div className="border-t border-gray-100 px-4 py-4">
        <Link
          to="/book"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 transition-colors"
        >
          📅 Client Booking Page
        </Link>
        <p className="mt-2 text-center text-[10px] text-gray-400">Share this link with your clients</p>
      </div>
    </aside>
  );
}
