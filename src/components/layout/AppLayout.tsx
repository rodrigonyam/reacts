import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { loadBranding, applyBrandingToDOM } from '../../services/brandingService';

export function AppLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyBrandingToDOM(loadBranding());
    const refresh = () => applyBrandingToDOM(loadBranding());
    window.addEventListener('brandingUpdated', refresh);
    return () => window.removeEventListener('brandingUpdated', refresh);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans" style={{ fontFamily: 'var(--brand-font)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
