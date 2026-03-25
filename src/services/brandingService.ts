import type { BrandingSettings } from '../types';

const STORAGE_KEY = 'sos_branding';

export const DEFAULT_BRANDING: BrandingSettings = {
  businessName: 'BookEase',
  tagline: 'Simple online booking for your business',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#0284c7',
  accentColor: '#7c3aed',
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  bookingPageTitle: 'Book an Appointment',
  bookingPageWelcomeText: 'Choose a service and pick a time that works for you.',
  customDomain: '',
  updatedAt: new Date().toISOString(),
};

export function loadBranding(): BrandingSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BRANDING };
    return { ...DEFAULT_BRANDING, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_BRANDING };
  }
}

export function saveBranding(settings: BrandingSettings): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...settings, updatedAt: new Date().toISOString() }),
  );
}

/** Convert a 6-digit hex color to { r, g, b }. Returns null if invalid. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

/** Auto-derive a light background shade and a dark hover shade from a base hex color. */
export function deriveColorVariants(hex: string): { light: string; dark: string } {
  const rgb = hexToRgb(hex);
  if (!rgb) return { light: '#e0f2fe', dark: '#0369a1' };
  const { r, g, b } = rgb;
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  // Light: blend 15% primary with 85% white
  const light = `#${toHex(Math.round(r * 0.15 + 255 * 0.85))}${toHex(Math.round(g * 0.15 + 255 * 0.85))}${toHex(Math.round(b * 0.15 + 255 * 0.85))}`;
  // Dark: 80% of the original value
  const dark = `#${toHex(Math.round(r * 0.8))}${toHex(Math.round(g * 0.8))}${toHex(Math.round(b * 0.8))}`;
  return { light, dark };
}

/** Inject branding as CSS custom properties on the document root. */
export function applyBrandingToDOM(settings: BrandingSettings): void {
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', settings.primaryColor);
  root.style.setProperty('--brand-accent', settings.accentColor);
  root.style.setProperty('--brand-font', settings.fontFamily);
  const { light, dark } = deriveColorVariants(settings.primaryColor);
  root.style.setProperty('--brand-primary-light', light);
  root.style.setProperty('--brand-primary-dark', dark);
  if (settings.businessName) {
    document.title = settings.businessName;
  }
  // Apply favicon if provided
  if (settings.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = settings.faviconUrl;
  }
}
