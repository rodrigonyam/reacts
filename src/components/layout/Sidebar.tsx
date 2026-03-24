import { NavLink, Link } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '📅', end: true },
  { to: '/bookings', label: 'Bookings', icon: '📋', end: false },
  { to: '/slots', label: 'Slots', icon: '🕐', end: false },
  { to: '/calendar-sync', label: 'Calendar Sync', icon: '🔄', end: false },
  { to: '/reminders',     label: 'Reminders',     icon: '🔔', end: false },
  { to: '/timezone',      label: 'Time Zones',     icon: '🌍', end: false },
  { to: '/policies',      label: 'Policies',       icon: '📋', end: false },
];

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
