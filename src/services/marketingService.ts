/**
 * marketingService — localStorage-backed marketing tools.
 * Manages coupons, daily deals, and promotions.
 */
import { format } from 'date-fns';
import type {
  Coupon,
  DailyDeal,
  Promotion,
  AppliedDiscount,
  MarketingStats,
  PromoStatus,
} from '../types';

// ── Storage keys ──────────────────────────────────────────────────────────────

const KEY_COUPONS     = 'sos_marketing_coupons';
const KEY_DEALS       = 'sos_marketing_deals';
const KEY_PROMOTIONS  = 'sos_marketing_promotions';

// ── Seed data (demo) ──────────────────────────────────────────────────────────

const today = format(new Date(), 'yyyy-MM-dd');

const SEED_COUPONS: Coupon[] = [
  {
    id: 'cpn_welcome10',
    code: 'WELCOME10',
    description: '10% off your first booking',
    discountType: 'percentage',
    discountValue: 10,
    applicableServiceIds: [],
    usageLimit: 100,
    usageCount: 12,
    active: true,
    onePerClient: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cpn_save5',
    code: 'SAVE5',
    description: '$5 off any booking over $30',
    discountType: 'fixed',
    discountValue: 5,
    minAmount: 30,
    applicableServiceIds: [],
    usageLimit: 50,
    usageCount: 8,
    active: true,
    onePerClient: false,
    createdAt: new Date().toISOString(),
  },
];

const SEED_DEALS: DailyDeal[] = [
  {
    id: 'deal_today1',
    serviceId: 'svc_1',
    serviceName: 'Massage Therapy',
    title: 'Flash Deal — Today Only!',
    description: 'Book a Massage Therapy session today and save 20%.',
    discountType: 'percentage',
    discountValue: 20,
    dealPrice: 64,
    date: today,
    active: true,
    maxClaims: 5,
    claimsCount: 2,
    createdAt: new Date().toISOString(),
  },
];

const SEED_PROMOTIONS: Promotion[] = [
  {
    id: 'promo_summer',
    name: 'Spring Special',
    description: '15% off all services this week.',
    type: 'percentage',
    value: 15,
    applicableServiceIds: [],
    status: 'active',
    startDate: today,
    endDate: today,
    usageLimit: 200,
    usageCount: 34,
    createdAt: new Date().toISOString(),
  },
];

// ── Generic helpers ───────────────────────────────────────────────────────────

function loadJson<T>(key: string, seed: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T[];
  } catch { /* ignore */ }
  localStorage.setItem(key, JSON.stringify(seed));
  return seed;
}

function saveJson<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Coupons ───────────────────────────────────────────────────────────────────

export function loadCoupons(): Coupon[] {
  return loadJson<Coupon>(KEY_COUPONS, SEED_COUPONS);
}

export function saveCoupons(coupons: Coupon[]): void {
  saveJson(KEY_COUPONS, coupons);
}

export function addCoupon(data: Omit<Coupon, 'id' | 'usageCount' | 'createdAt'>): Coupon {
  const coupons = loadCoupons();
  const coupon: Coupon = { ...data, id: uid('cpn'), usageCount: 0, createdAt: new Date().toISOString() };
  coupons.push(coupon);
  saveCoupons(coupons);
  return coupon;
}

export function updateCoupon(id: string, patch: Partial<Coupon>): void {
  const coupons = loadCoupons().map((c) => (c.id === id ? { ...c, ...patch } : c));
  saveCoupons(coupons);
}

export function deleteCoupon(id: string): void {
  saveCoupons(loadCoupons().filter((c) => c.id !== id));
}

/**
 * Validate a coupon code against a booking.
 * Returns AppliedDiscount on success, or throws an error describing the problem.
 */
export function validateCoupon(
  code: string,
  originalPrice: number,   // dollars
  serviceId?: string,
): AppliedDiscount {
  const coupons = loadCoupons();
  const coupon = coupons.find((c) => c.code.toUpperCase() === code.toUpperCase());

  if (!coupon) throw new Error('Coupon code not found.');
  if (!coupon.active) throw new Error('This coupon is no longer active.');
  if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) throw new Error('This coupon has expired.');
  if (coupon.usageLimit !== undefined && coupon.usageCount >= coupon.usageLimit) throw new Error('This coupon has reached its usage limit.');
  if (coupon.minAmount && originalPrice < coupon.minAmount) throw new Error(`This coupon requires a minimum booking of $${coupon.minAmount}.`);
  if (coupon.applicableServiceIds.length > 0 && serviceId && !coupon.applicableServiceIds.includes(serviceId)) {
    throw new Error('This coupon is not valid for the selected service.');
  }

  const discountAmount =
    coupon.discountType === 'percentage'
      ? parseFloat(((originalPrice * coupon.discountValue) / 100).toFixed(2))
      : Math.min(coupon.discountValue, originalPrice);

  return {
    source: 'coupon',
    label: `Coupon ${coupon.code}: ${coupon.discountType === 'percentage' ? `${coupon.discountValue}% off` : `$${coupon.discountValue} off`}`,
    originalPrice,
    discountAmount,
    finalPrice: parseFloat((originalPrice - discountAmount).toFixed(2)),
  };
}

export function incrementCouponUsage(code: string): void {
  const coupons = loadCoupons().map((c) =>
    c.code.toUpperCase() === code.toUpperCase() ? { ...c, usageCount: c.usageCount + 1 } : c,
  );
  saveCoupons(coupons);
}

// ── Daily Deals ───────────────────────────────────────────────────────────────

export function loadDeals(): DailyDeal[] {
  return loadJson<DailyDeal>(KEY_DEALS, SEED_DEALS);
}

export function saveDeals(deals: DailyDeal[]): void {
  saveJson(KEY_DEALS, deals);
}

export function addDeal(data: Omit<DailyDeal, 'id' | 'claimsCount' | 'createdAt'>): DailyDeal {
  const deals = loadDeals();
  const deal: DailyDeal = { ...data, id: uid('deal'), claimsCount: 0, createdAt: new Date().toISOString() };
  deals.push(deal);
  saveDeals(deals);
  return deal;
}

export function updateDeal(id: string, patch: Partial<DailyDeal>): void {
  saveDeals(loadDeals().map((d) => (d.id === id ? { ...d, ...patch } : d)));
}

export function deleteDeal(id: string): void {
  saveDeals(loadDeals().filter((d) => d.id !== id));
}

/** Returns deals that are active today and haven't hit their claim cap. */
export function getTodayDeals(): DailyDeal[] {
  return loadDeals().filter((d) => {
    if (!d.active) return false;
    const matchDate = d.date === 'any' || d.date === format(new Date(), 'yyyy-MM-dd');
    if (!matchDate) return false;
    if (d.maxClaims !== undefined && d.claimsCount >= d.maxClaims) return false;
    return true;
  });
}

/** Returns the best active deal for a specific service today (lowest final price). */
export function getBestDealForService(serviceId: string, originalPrice: number): AppliedDiscount | null {
  const deals = getTodayDeals().filter((d) => d.serviceId === serviceId);
  if (deals.length === 0) return null;

  // Pick deal that gives the deepest discount
  let best: AppliedDiscount | null = null;
  for (const deal of deals) {
    const discountAmount =
      deal.discountType === 'percentage'
        ? parseFloat(((originalPrice * deal.discountValue) / 100).toFixed(2))
        : Math.min(deal.discountValue, originalPrice);
    const candidate: AppliedDiscount = {
      source: 'deal',
      label: `${deal.title}: ${deal.discountType === 'percentage' ? `${deal.discountValue}% off` : `$${deal.discountValue} off`}`,
      originalPrice,
      discountAmount,
      finalPrice: parseFloat((originalPrice - discountAmount).toFixed(2)),
    };
    if (!best || candidate.finalPrice < best.finalPrice) best = candidate;
  }
  return best;
}

export function claimDeal(dealId: string): void {
  saveDeals(loadDeals().map((d) => (d.id === dealId ? { ...d, claimsCount: d.claimsCount + 1 } : d)));
}

// ── Promotions ────────────────────────────────────────────────────────────────

export function loadPromotions(): Promotion[] {
  return loadJson<Promotion>(KEY_PROMOTIONS, SEED_PROMOTIONS);
}

export function savePromotions(promos: Promotion[]): void {
  saveJson(KEY_PROMOTIONS, promos);
}

export function addPromotion(data: Omit<Promotion, 'id' | 'usageCount' | 'createdAt'>): Promotion {
  const promos = loadPromotions();
  const promo: Promotion = { ...data, id: uid('promo'), usageCount: 0, createdAt: new Date().toISOString() };
  promos.push(promo);
  savePromotions(promos);
  return promo;
}

export function updatePromotion(id: string, patch: Partial<Promotion>): void {
  savePromotions(loadPromotions().map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

export function deletePromotion(id: string): void {
  savePromotions(loadPromotions().filter((p) => p.id !== id));
}

/** Compute effective promo status based on dates. */
export function resolvePromoStatus(promo: Promotion): PromoStatus {
  if (promo.status === 'paused') return 'paused';
  const now = new Date();
  const start = new Date(promo.startDate);
  const end = new Date(promo.endDate + 'T23:59:59');
  if (now < start) return 'scheduled';
  if (now > end) return 'expired';
  if (promo.usageLimit !== undefined && promo.usageCount >= promo.usageLimit) return 'expired';
  return 'active';
}

/** Returns currently active promotions applicable to a service. */
export function getActivePromotionsForService(serviceId: string): Promotion[] {
  return loadPromotions().filter((p) => {
    if (resolvePromoStatus(p) !== 'active') return false;
    if (p.applicableServiceIds.length > 0 && !p.applicableServiceIds.includes(serviceId)) return false;
    return true;
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function getMarketingStats(): MarketingStats {
  const coupons = loadCoupons();
  const deals = loadDeals();
  const promos = loadPromotions();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const activeCoupons = coupons.filter((c) => {
    if (!c.active) return false;
    if (c.expiresAt && new Date() > new Date(c.expiresAt)) return false;
    if (c.usageLimit !== undefined && c.usageCount >= c.usageLimit) return false;
    return true;
  }).length;

  const activeDeals = deals.filter((d) => d.active && (d.date === 'any' || d.date === todayStr)).length;
  const activePromos = promos.filter((p) => resolvePromoStatus(p) === 'active').length;

  const totalCouponUses = coupons.reduce((s, c) => s + c.usageCount, 0);
  const totalDealClaims = deals.reduce((s, d) => s + d.claimsCount, 0);

  // Approximate savings: coupons + deal claims * average discount
  const totalSavingsGiven = parseFloat(
    (
      coupons.reduce((s, c) => {
        const avg = c.discountType === 'fixed' ? c.discountValue : c.discountValue * 0.5;
        return s + avg * c.usageCount;
      }, 0) +
      deals.reduce((s, d) => {
        const avg = d.discountType === 'fixed' ? d.discountValue : d.discountValue * 0.5;
        return s + avg * d.claimsCount;
      }, 0)
    ).toFixed(2),
  );

  return {
    activeCoupons,
    activeDeals,
    activePromotions: activePromos,
    totalCouponUses,
    totalDealClaims,
    totalSavingsGiven,
  };
}
