import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import type { Coupon, DailyDeal, Promotion, DiscountType, PromoType, MarketingStats } from '../types';
import {
  loadCoupons,
  addCoupon,
  updateCoupon,
  deleteCoupon,
  loadDeals,
  addDeal,
  updateDeal,
  deleteDeal,
  loadPromotions,
  addPromotion,
  updatePromotion,
  deletePromotion,
  resolvePromoStatus,
  getMarketingStats,
} from '../services/marketingService';
import { loadServices } from '../services/serviceService';
import type { Service } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso?: string): string {
  if (!iso) return '—';
  try { return format(parseISO(iso), 'MMM d, yyyy'); } catch { return iso; }
}

function DiscountBadge({ type, value }: { type: DiscountType; value: number }) {
  return (
    <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
      {type === 'percentage' ? `${value}%` : `$${value}`} off
    </span>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

type Tab = 'coupons' | 'deals' | 'promotions';

// ── Coupon Form ────────────────────────────────────────────────────────────────

interface CouponFormData {
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  minAmount: string;
  usageLimit: string;
  expiresAt: string;
  onePerClient: boolean;
  active: boolean;
}

const emptyCoupon = (): CouponFormData => ({
  code: '',
  description: '',
  discountType: 'percentage',
  discountValue: 10,
  minAmount: '',
  usageLimit: '',
  expiresAt: '',
  onePerClient: true,
  active: true,
});

function CouponModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Coupon;
  onSave: (data: CouponFormData) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CouponFormData>(
    initial
      ? {
          code: initial.code,
          description: initial.description,
          discountType: initial.discountType,
          discountValue: initial.discountValue,
          minAmount: initial.minAmount !== undefined ? String(initial.minAmount) : '',
          usageLimit: initial.usageLimit !== undefined ? String(initial.usageLimit) : '',
          expiresAt: initial.expiresAt ? initial.expiresAt.slice(0, 10) : '',
          onePerClient: initial.onePerClient,
          active: initial.active,
        }
      : emptyCoupon(),
  );

  const set = <K extends keyof CouponFormData>(k: K, v: CouponFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">
            {initial ? 'Edit Coupon' : 'New Coupon'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Code *</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase tracking-widest focus:border-sky-500 focus:outline-none"
                value={form.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                placeholder="WELCOME10"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Discount Type</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                value={form.discountType}
                onChange={(e) => set('discountType', e.target.value as DiscountType)}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed ($)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Value {form.discountType === 'percentage' ? '(%)' : '($)'}
              </label>
              <input
                type="number"
                min={1}
                max={form.discountType === 'percentage' ? 100 : undefined}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                value={form.discountValue}
                onChange={(e) => set('discountValue', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Min Order ($)</label>
              <input
                type="number"
                min={0}
                placeholder="None"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                value={form.minAmount}
                onChange={(e) => set('minAmount', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Usage Limit</label>
              <input
                type="number"
                min={1}
                placeholder="Unlimited"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                value={form.usageLimit}
                onChange={(e) => set('usageLimit', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Expires</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                value={form.expiresAt}
                onChange={(e) => set('expiresAt', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Brief description shown to clients"
            />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                className="rounded"
                checked={form.onePerClient}
                onChange={(e) => set('onePerClient', e.target.checked)}
              />
              One per client
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                className="rounded"
                checked={form.active}
                onChange={(e) => set('active', e.target.checked)}
              />
              Active
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!form.code.trim()) { toast.error('Code is required'); return; }
              onSave(form);
            }}
            className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Deal Form ──────────────────────────────────────────────────────────────────

interface DealFormData {
  serviceId: string;
  title: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  date: string;
  maxClaims: string;
  active: boolean;
}

const emptyDeal = (): DealFormData => ({
  serviceId: '',
  title: '',
  description: '',
  discountType: 'percentage',
  discountValue: 20,
  date: format(new Date(), 'yyyy-MM-dd'),
  maxClaims: '',
  active: true,
});

function DealModal({
  initial,
  services,
  onSave,
  onClose,
}: {
  initial?: DailyDeal;
  services: Service[];
  onSave: (data: DealFormData) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<DealFormData>(
    initial
      ? {
          serviceId: initial.serviceId,
          title: initial.title,
          description: initial.description,
          discountType: initial.discountType,
          discountValue: initial.discountValue,
          date: initial.date,
          maxClaims: initial.maxClaims !== undefined ? String(initial.maxClaims) : '',
          active: initial.active,
        }
      : emptyDeal(),
  );

  const set = <K extends keyof DealFormData>(k: K, v: DealFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">
            {initial ? 'Edit Daily Deal' : 'New Daily Deal'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Service *</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              value={form.serviceId}
              onChange={(e) => set('serviceId', e.target.value)}
            >
              <option value="">— Select service —</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name} (${s.price})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Deal Title</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Tuesday Flash Sale"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Optional short description"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Discount Type</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                value={form.discountType}
                onChange={(e) => set('discountType', e.target.value as DiscountType)}
              >
                <option value="percentage">%</option>
                <option value="fixed">$</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Value</label>
              <input
                type="number"
                min={1}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                value={form.discountValue}
                onChange={(e) => set('discountValue', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Max Claims</label>
              <input
                type="number"
                min={1}
                placeholder="∞"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                value={form.maxClaims}
                onChange={(e) => set('maxClaims', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Deal Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={form.active}
                  onChange={(e) => set('active', e.target.checked)}
                />
                Active
              </label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!form.serviceId) { toast.error('Please select a service'); return; }
              onSave(form);
            }}
            className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Promotion Form ─────────────────────────────────────────────────────────────

interface PromoFormData {
  name: string;
  description: string;
  type: PromoType;
  value: number;
  minBookingAmount: string;
  startDate: string;
  endDate: string;
  usageLimit: string;
  code: string;
  serviceScope: 'all' | 'specific';
  serviceIds: string[];
}

const emptyPromo = (): PromoFormData => ({
  name: '',
  description: '',
  type: 'percentage',
  value: 15,
  minBookingAmount: '',
  startDate: format(new Date(), 'yyyy-MM-dd'),
  endDate: '',
  usageLimit: '',
  code: '',
  serviceScope: 'all',
  serviceIds: [],
});

function PromoModal({
  initial,
  services,
  onSave,
  onClose,
}: {
  initial?: Promotion;
  services: Service[];
  onSave: (data: PromoFormData) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PromoFormData>(
    initial
      ? {
          name: initial.name,
          description: initial.description,
          type: initial.type,
          value: initial.value,
          minBookingAmount: initial.minBookingAmount !== undefined ? String(initial.minBookingAmount) : '',
          startDate: initial.startDate.slice(0, 10),
          endDate: initial.endDate.slice(0, 10),
          usageLimit: initial.usageLimit !== undefined ? String(initial.usageLimit) : '',
          code: initial.code ?? '',
          serviceScope: initial.applicableServiceIds.length === 0 ? 'all' : 'specific',
          serviceIds: initial.applicableServiceIds,
        }
      : emptyPromo(),
  );

  const set = <K extends keyof PromoFormData>(k: K, v: PromoFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleServiceId = (id: string) => {
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id)
        ? f.serviceIds.filter((s) => s !== id)
        : [...f.serviceIds, id],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">
            {initial ? 'Edit Promotion' : 'New Promotion'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Campaign Name *</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Summer Savings"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Brief description"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Type</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                value={form.type}
                onChange={(e) => set('type', e.target.value as PromoType)}
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed $</option>
                <option value="bogo">BOGO</option>
                <option value="free_service">Free Service</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Value</label>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                value={form.value}
                onChange={(e) => set('value', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Min Amount ($)</label>
              <input
                type="number"
                min={0}
                placeholder="None"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                value={form.minBookingAmount}
                onChange={(e) => set('minBookingAmount', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Start Date *</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">End Date *</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                value={form.endDate}
                onChange={(e) => set('endDate', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Usage Limit</label>
              <input
                type="number"
                min={1}
                placeholder="Unlimited"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                value={form.usageLimit}
                onChange={(e) => set('usageLimit', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Promo Code (optional)</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase tracking-widest focus:border-sky-500 focus:outline-none"
                value={form.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                placeholder="AUTO-APPLIED"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-600">Applies To</label>
            <div className="flex gap-4 mb-2">
              {(['all', 'specific'] as const).map((scope) => (
                <label key={scope} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="serviceScope"
                    checked={form.serviceScope === scope}
                    onChange={() => set('serviceScope', scope)}
                  />
                  {scope === 'all' ? 'All services' : 'Specific services'}
                </label>
              ))}
            </div>
            {form.serviceScope === 'specific' && (
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                {services.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.serviceIds.includes(s.id)}
                      onChange={() => toggleServiceId(s.id)}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!form.name.trim()) { toast.error('Campaign name is required'); return; }
              if (!form.startDate || !form.endDate) { toast.error('Start and end dates are required'); return; }
              onSave(form);
            }}
            className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function MarketingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('coupons');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [deals, setDeals] = useState<DailyDeal[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [stats, setStats] = useState<MarketingStats>({
    activeCoupons: 0,
    activeDeals: 0,
    activePromotions: 0,
    totalCouponUses: 0,
    totalDealClaims: 0,
    totalSavingsGiven: 0,
  });

  // Modals
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | undefined>();
  const [showDealModal, setShowDealModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<DailyDeal | undefined>();
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | undefined>();

  const refresh = useCallback(() => {
    setCoupons(loadCoupons());
    setDeals(loadDeals());
    setPromotions(loadPromotions());
    setServices(loadServices());
    setStats(getMarketingStats());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Coupon handlers ────────────────────────────────────────────────────────

  const handleSaveCoupon = (data: CouponFormData) => {
    const payload: Omit<Coupon, 'id' | 'usageCount' | 'createdAt'> = {
      code: data.code.trim(),
      description: data.description.trim(),
      discountType: data.discountType,
      discountValue: data.discountValue,
      minAmount: data.minAmount ? Number(data.minAmount) : undefined,
      usageLimit: data.usageLimit ? Number(data.usageLimit) : undefined,
      expiresAt: data.expiresAt ? `${data.expiresAt}T23:59:59.000Z` : undefined,
      onePerClient: data.onePerClient,
      active: data.active,
      applicableServiceIds: [],
    };
    if (editingCoupon) {
      updateCoupon({ ...editingCoupon, ...payload });
      toast.success('Coupon updated');
    } else {
      addCoupon(payload);
      toast.success('Coupon created');
    }
    setShowCouponModal(false);
    setEditingCoupon(undefined);
    refresh();
  };

  const handleDeleteCoupon = (id: string) => {
    if (!confirm('Delete this coupon?')) return;
    deleteCoupon(id);
    toast.success('Coupon deleted');
    refresh();
  };

  const handleToggleCoupon = (coupon: Coupon) => {
    updateCoupon({ ...coupon, active: !coupon.active });
    refresh();
  };

  // ── Deal handlers ──────────────────────────────────────────────────────────

  const handleSaveDeal = (data: DealFormData) => {
    const svc = services.find((s) => s.id === data.serviceId);
    if (!svc) return;
    const rawDiscount =
      data.discountType === 'percentage'
        ? svc.price * (data.discountValue / 100)
        : data.discountValue;
    const dealPrice = Math.max(0, svc.price - rawDiscount);

    const payload: Omit<DailyDeal, 'id' | 'claimsCount' | 'createdAt'> = {
      serviceId: data.serviceId,
      serviceName: svc.name,
      title: data.title || `${data.discountValue}${data.discountType === 'percentage' ? '%' : '$'} off ${svc.name}`,
      description: data.description,
      discountType: data.discountType,
      discountValue: data.discountValue,
      dealPrice: Math.round(dealPrice * 100) / 100,
      date: data.date,
      active: data.active,
      maxClaims: data.maxClaims ? Number(data.maxClaims) : undefined,
    };
    if (editingDeal) {
      updateDeal({ ...editingDeal, ...payload });
      toast.success('Deal updated');
    } else {
      addDeal(payload);
      toast.success('Daily deal created');
    }
    setShowDealModal(false);
    setEditingDeal(undefined);
    refresh();
  };

  const handleDeleteDeal = (id: string) => {
    if (!confirm('Delete this deal?')) return;
    deleteDeal(id);
    toast.success('Deal deleted');
    refresh();
  };

  const handleToggleDeal = (deal: DailyDeal) => {
    updateDeal({ ...deal, active: !deal.active });
    refresh();
  };

  // ── Promotion handlers ─────────────────────────────────────────────────────

  const handleSavePromo = (data: PromoFormData) => {
    const payload: Omit<Promotion, 'id' | 'usageCount' | 'status' | 'createdAt'> = {
      name: data.name.trim(),
      description: data.description.trim(),
      type: data.type,
      value: data.value,
      minBookingAmount: data.minBookingAmount ? Number(data.minBookingAmount) : undefined,
      startDate: `${data.startDate}T00:00:00.000Z`,
      endDate: `${data.endDate}T23:59:59.000Z`,
      usageLimit: data.usageLimit ? Number(data.usageLimit) : undefined,
      code: data.code || undefined,
      applicableServiceIds: data.serviceScope === 'all' ? [] : data.serviceIds,
    };
    if (editingPromo) {
      updatePromotion({ ...editingPromo, ...payload, status: resolvePromoStatus({ ...editingPromo, ...payload, status: 'active' }) });
      toast.success('Promotion updated');
    } else {
      addPromotion(payload);
      toast.success('Promotion created');
    }
    setShowPromoModal(false);
    setEditingPromo(undefined);
    refresh();
  };

  const handleDeletePromo = (id: string) => {
    if (!confirm('Delete this promotion?')) return;
    deletePromotion(id);
    toast.success('Promotion deleted');
    refresh();
  };

  const statusBadge = (promo: Promotion) => {
    const s = resolvePromoStatus(promo);
    const map: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-700',
      scheduled: 'bg-sky-100 text-sky-700',
      paused: 'bg-amber-100 text-amber-700',
      expired: 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[s] ?? map.expired}`}>
        {s.charAt(0).toUpperCase() + s.slice(1)}
      </span>
    );
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'coupons', label: 'Coupons', icon: '🎟️' },
    { key: 'deals', label: 'Daily Deals', icon: '🔥' },
    { key: 'promotions', label: 'Promotions', icon: '📢' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing</h1>
          <p className="mt-1 text-sm text-gray-500">Manage coupons, daily deals, and promotional campaigns</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon="🎟️" label="Active Coupons" value={stats.activeCoupons} />
        <StatCard icon="🔥" label="Active Deals" value={stats.activeDeals} />
        <StatCard icon="📢" label="Active Promos" value={stats.activePromotions} />
        <StatCard icon="✅" label="Coupon Uses" value={stats.totalCouponUses} />
        <StatCard icon="⚡" label="Deal Claims" value={stats.totalDealClaims} />
        <StatCard icon="💰" label="Savings Given" value={`$${stats.totalSavingsGiven.toFixed(0)}`} />
      </div>

      {/* Tabs */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex gap-1 border-b border-gray-200 px-4 pt-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? 'border-b-2 border-sky-500 text-sky-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Coupons Tab ─────────────────────────────────────────────────────── */}
        {activeTab === 'coupons' && (
          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">{coupons.length} coupon{coupons.length !== 1 ? 's' : ''}</p>
              <button
                type="button"
                onClick={() => { setEditingCoupon(undefined); setShowCouponModal(true); }}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                + Add Coupon
              </button>
            </div>
            {coupons.length === 0 ? (
              <div className="py-12 text-center text-gray-400">No coupons yet. Create your first one!</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-500">
                      <th className="pb-2 font-medium">Code</th>
                      <th className="pb-2 font-medium">Discount</th>
                      <th className="pb-2 font-medium">Min Order</th>
                      <th className="pb-2 font-medium">Usage</th>
                      <th className="pb-2 font-medium">Expires</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {coupons.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="py-3 font-mono font-semibold tracking-wider text-gray-900">{c.code}</td>
                        <td className="py-3"><DiscountBadge type={c.discountType} value={c.discountValue} /></td>
                        <td className="py-3 text-gray-500">{c.minAmount ? `$${c.minAmount}` : '—'}</td>
                        <td className="py-3 text-gray-500">
                          {c.usageCount}{c.usageLimit ? `/${c.usageLimit}` : ''}
                        </td>
                        <td className="py-3 text-gray-500">{fmt(c.expiresAt)}</td>
                        <td className="py-3">
                          <button
                            type="button"
                            onClick={() => handleToggleCoupon(c)}
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                              c.active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {c.active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => { setEditingCoupon(c); setShowCouponModal(true); }}
                            className="mr-2 text-sky-600 hover:text-sky-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCoupon(c.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            Delete
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

        {/* ── Daily Deals Tab ──────────────────────────────────────────────────── */}
        {activeTab === 'deals' && (
          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">{deals.length} deal{deals.length !== 1 ? 's' : ''}</p>
              <button
                type="button"
                onClick={() => { setEditingDeal(undefined); setShowDealModal(true); }}
                className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
              >
                🔥 New Deal
              </button>
            </div>
            {deals.length === 0 ? (
              <div className="py-12 text-center text-gray-400">No daily deals yet. Fire one up!</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-500">
                      <th className="pb-2 font-medium">Service</th>
                      <th className="pb-2 font-medium">Title</th>
                      <th className="pb-2 font-medium">Discount</th>
                      <th className="pb-2 font-medium">Deal Price</th>
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Claims</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deals.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="py-3 font-medium text-gray-900">{d.serviceName}</td>
                        <td className="py-3 text-gray-600">{d.title || '—'}</td>
                        <td className="py-3"><DiscountBadge type={d.discountType} value={d.discountValue} /></td>
                        <td className="py-3 font-semibold text-rose-600">${d.dealPrice}</td>
                        <td className="py-3 text-gray-500">{fmt(d.date)}</td>
                        <td className="py-3 text-gray-500">
                          {d.claimsCount}{d.maxClaims ? `/${d.maxClaims}` : ''}
                        </td>
                        <td className="py-3">
                          <button
                            type="button"
                            onClick={() => handleToggleDeal(d)}
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                              d.active ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {d.active ? 'On' : 'Off'}
                          </button>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => { setEditingDeal(d); setShowDealModal(true); }}
                            className="mr-2 text-sky-600 hover:text-sky-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDeal(d.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            Delete
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

        {/* ── Promotions Tab ───────────────────────────────────────────────────── */}
        {activeTab === 'promotions' && (
          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">{promotions.length} promotion{promotions.length !== 1 ? 's' : ''}</p>
              <button
                type="button"
                onClick={() => { setEditingPromo(undefined); setShowPromoModal(true); }}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
              >
                📢 New Promotion
              </button>
            </div>
            {promotions.length === 0 ? (
              <div className="py-12 text-center text-gray-400">No promotions yet. Launch your first campaign!</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-500">
                      <th className="pb-2 font-medium">Campaign</th>
                      <th className="pb-2 font-medium">Type / Value</th>
                      <th className="pb-2 font-medium">Dates</th>
                      <th className="pb-2 font-medium">Usage</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {promotions.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="py-3">
                          <p className="font-medium text-gray-900">{p.name}</p>
                          {p.code && <p className="font-mono text-[11px] text-gray-400">{p.code}</p>}
                        </td>
                        <td className="py-3">
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                            {p.type === 'percentage' ? `${p.value}%` : p.type === 'fixed' ? `$${p.value}` : p.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 text-gray-500">
                          {fmt(p.startDate)} – {fmt(p.endDate)}
                        </td>
                        <td className="py-3 text-gray-500">
                          {p.usageCount}{p.usageLimit ? `/${p.usageLimit}` : ''}
                        </td>
                        <td className="py-3">{statusBadge(p)}</td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => { setEditingPromo(p); setShowPromoModal(true); }}
                            className="mr-2 text-sky-600 hover:text-sky-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePromo(p.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            Delete
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
      </div>

      {/* Modals */}
      {showCouponModal && (
        <CouponModal
          initial={editingCoupon}
          onSave={handleSaveCoupon}
          onClose={() => { setShowCouponModal(false); setEditingCoupon(undefined); }}
        />
      )}
      {showDealModal && (
        <DealModal
          initial={editingDeal}
          services={services}
          onSave={handleSaveDeal}
          onClose={() => { setShowDealModal(false); setEditingDeal(undefined); }}
        />
      )}
      {showPromoModal && (
        <PromoModal
          initial={editingPromo}
          services={services}
          onSave={handleSavePromo}
          onClose={() => { setShowPromoModal(false); setEditingPromo(undefined); }}
        />
      )}
    </div>
  );
}
