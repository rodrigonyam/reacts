/**
 * Analytics Service — generates synthetic historical booking data and computes
 * KPI snapshots, booking trends, service breakdowns, staff performance, and
 * revenue summaries all from localStorage (consistent with app mock-data pattern).
 */
import {
  differenceInDays,
  eachDayOfInterval,
  format,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfYear,
  subDays,
} from 'date-fns';
import type {
  BookingTrendPoint,
  DateRange,
  DateRangePreset,
  KPISnapshot,
  RevenueBreakdown,
  ServiceBreakdown,
  StaffPerformance,
  TopClient,
} from '../types';
import { MOCK_SERVICES, MOCK_STAFF } from './mockData';

// ── Storage key ───────────────────────────────────────────────────────────────

const BOOKINGS_KEY = 'sos_analytics_bookings';

// ── Synthetic booking record (stored in localStorage) ────────────────────────

interface SyntheticBooking {
  id: string;
  serviceId: string;
  serviceName: string;
  staffId: string;
  staffName: string;
  clientId: string;
  clientName: string;
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:mm
  durationMinutes: number;
  status: 'completed' | 'cancelled' | 'no-show';
  revenue: number;       // cents
  gateway: 'stripe' | 'paypal' | 'square';
  paymentType: 'full' | 'deposit';
  isNewClient: boolean;
}

// ── Seed / generate synthetic data ───────────────────────────────────────────

const CLIENT_NAMES = [
  'Alice Johnson', 'Bob Williams', 'Carol Martinez', 'Dorothy Chen',
  'Edward Kim', 'Frances Lee', 'George Patel', 'Helen Brown',
  'Ivan Ortega', 'Janet Nguyen', 'Kenneth Davis', 'Linda Wilson',
  'Martin Harris', 'Nancy Thompson', 'Oscar Garcia', 'Patricia Moore',
  'Raymond Jackson', 'Sandra White', 'Thomas Anderson', 'Ursula Taylor',
];

const GATEWAYS: SyntheticBooking['gateway'][] = ['stripe', 'paypal', 'square'];
const GATEWAY_WEIGHTS = [0.6, 0.25, 0.15]; // stripe most common

function weightedRandom<T>(items: T[], weights: number[]): T {
  const r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < items.length; i++) {
    cumulative += weights[i];
    if (r < cumulative) return items[i];
  }
  return items[items.length - 1];
}

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateSyntheticBookings(): SyntheticBooking[] {
  // Generate 6 months of historical data
  const endDate = new Date();
  const startDate = subDays(endDate, 180);
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const rand = seededRand(42); // deterministic seed so data is consistent on refresh
  const bookings: SyntheticBooking[] = [];

  // Track first-visit dates per client (clientId → earliest date)
  const clientFirstVisit: Record<string, string> = {};

  let idCounter = 0;

  for (const day of days) {
    const dayOfWeek = day.getDay(); // 0=Sun
    // Fewer bookings on weekends
    const baseCount = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 4;
    const count = Math.floor(rand() * (baseCount + 2));

    for (let i = 0; i < count; i++) {
      const service = MOCK_SERVICES[Math.floor(rand() * MOCK_SERVICES.length)];
      // Pick staff that covers this service (or any staff as fallback)
      const eligibleStaff = MOCK_STAFF.filter((s) =>
        s.serviceIds.includes(service.id)
      );
      const staff =
        eligibleStaff.length > 0
          ? eligibleStaff[Math.floor(rand() * eligibleStaff.length)]
          : MOCK_STAFF[Math.floor(rand() * MOCK_STAFF.length)];

      const clientIdx = Math.floor(rand() * CLIENT_NAMES.length);
      const clientId = `ac${clientIdx}`;
      const clientName = CLIENT_NAMES[clientIdx];
      const dateStr = format(day, 'yyyy-MM-dd');

      const isNewClient = !clientFirstVisit[clientId];
      if (isNewClient) clientFirstVisit[clientId] = dateStr;

      // Status distribution: ~75% completed, ~18% cancelled, ~7% no-show
      const statusRoll = rand();
      const status: SyntheticBooking['status'] =
        statusRoll < 0.75 ? 'completed' : statusRoll < 0.93 ? 'cancelled' : 'no-show';

      // Revenue: full price or slight variation; cancelled/no-show partial or zero
      const baseRevenue = service.price * 100; // to cents
      let revenue = 0;
      if (status === 'completed') {
        revenue = baseRevenue;
      } else if (status === 'no-show') {
        revenue = Math.round(baseRevenue * 0.5); // deposit kept
      }

      const hour = 8 + Math.floor(rand() * 9); // 8am–4pm
      const startTime = `${String(hour).padStart(2, '0')}:00`;

      bookings.push({
        id: `ab${++idCounter}`,
        serviceId: service.id,
        serviceName: service.name,
        staffId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        clientId,
        clientName,
        date: dateStr,
        startTime,
        durationMinutes: service.durationMinutes,
        status,
        revenue,
        gateway: weightedRandom(GATEWAYS, GATEWAY_WEIGHTS),
        paymentType: rand() < 0.3 ? 'deposit' : 'full',
        isNewClient,
      });
    }
  }

  return bookings;
}

// ── Load / initialize bookings ────────────────────────────────────────────────

let _cachedBookings: SyntheticBooking[] | null = null;

export function getAnalyticsBookings(): SyntheticBooking[] {
  if (_cachedBookings) return _cachedBookings;

  try {
    const stored = localStorage.getItem(BOOKINGS_KEY);
    if (stored) {
      _cachedBookings = JSON.parse(stored) as SyntheticBooking[];
      return _cachedBookings;
    }
  } catch {
    // ignore
  }

  const generated = generateSyntheticBookings();
  try {
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(generated));
  } catch {
    // ignore storage quota
  }
  _cachedBookings = generated;
  return _cachedBookings;
}

// ── Date range helpers ────────────────────────────────────────────────────────

export function resolveDateRange(preset: DateRangePreset, custom?: DateRange): DateRange {
  const today = new Date();
  const end = format(today, 'yyyy-MM-dd');
  switch (preset) {
    case '7d':
      return { start: format(subDays(today, 6), 'yyyy-MM-dd'), end };
    case '30d':
      return { start: format(subDays(today, 29), 'yyyy-MM-dd'), end };
    case '90d':
      return { start: format(subDays(today, 89), 'yyyy-MM-dd'), end };
    case 'mtd':
      return { start: format(startOfMonth(today), 'yyyy-MM-dd'), end };
    case 'ytd':
      return { start: format(startOfYear(today), 'yyyy-MM-dd'), end };
    case 'custom':
      return custom ?? { start: format(subDays(today, 29), 'yyyy-MM-dd'), end };
  }
}

function filterByRange(bookings: SyntheticBooking[], range: DateRange): SyntheticBooking[] {
  const interval = { start: parseISO(range.start), end: parseISO(range.end) };
  return bookings.filter((b) => isWithinInterval(parseISO(b.date), interval));
}

function priorRange(range: DateRange): DateRange {
  const days = differenceInDays(parseISO(range.end), parseISO(range.start)) + 1;
  return {
    start: format(subDays(parseISO(range.start), days), 'yyyy-MM-dd'),
    end: format(subDays(parseISO(range.start), 1), 'yyyy-MM-dd'),
  };
}

// ── KPI Snapshot ──────────────────────────────────────────────────────────────

export function getKPISnapshot(range: DateRange): KPISnapshot {
  const all = getAnalyticsBookings();
  const current = filterByRange(all, range);
  const prior = filterByRange(all, priorRange(range));

  const completedCurrent = current.filter((b) => b.status === 'completed');
  const completedPrior = prior.filter((b) => b.status === 'completed');

  const totalRevenue = completedCurrent.reduce((s, b) => s + b.revenue, 0);
  const priorRevenue = completedPrior.reduce((s, b) => s + b.revenue, 0);

  const totalBookings = current.length;
  const priorBookings = prior.length;

  const completionRate = totalBookings > 0 ? (completedCurrent.length / totalBookings) * 100 : 0;
  const priorCompletionRate =
    priorBookings > 0 ? (completedPrior.length / priorBookings) * 100 : 0;

  const avgBookingValue = completedCurrent.length > 0 ? totalRevenue / completedCurrent.length : 0;
  const priorAvgValue =
    completedPrior.length > 0 ? priorRevenue / completedPrior.length : 0;

  const newClients = current.filter((b) => b.isNewClient).length;
  const returningClients = current.length - newClients;

  const pctChange = (cur: number, prev: number) =>
    prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

  return {
    totalRevenue,
    totalBookings,
    completionRate,
    avgBookingValue,
    newClients,
    returningClients,
    revenueChange: pctChange(totalRevenue, priorRevenue),
    bookingsChange: pctChange(totalBookings, priorBookings),
    completionChange: completionRate - priorCompletionRate,
    avgValueChange: pctChange(avgBookingValue, priorAvgValue),
  };
}

// ── Booking Trends ────────────────────────────────────────────────────────────

export function getBookingTrends(range: DateRange): BookingTrendPoint[] {
  const all = getAnalyticsBookings();
  const inRange = filterByRange(all, range);

  const days = eachDayOfInterval({ start: parseISO(range.start), end: parseISO(range.end) });

  return days.map((day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayBookings = inRange.filter((b) => b.date === dateStr);
    const completed = dayBookings.filter((b) => b.status === 'completed');
    const cancelled = dayBookings.filter((b) => b.status === 'cancelled');
    return {
      date: dateStr,
      count: dayBookings.length,
      revenue: completed.reduce((s, b) => s + b.revenue, 0),
      completedCount: completed.length,
      cancelledCount: cancelled.length,
    };
  });
}

// ── Service Breakdown ─────────────────────────────────────────────────────────

export function getServiceBreakdown(range: DateRange): ServiceBreakdown[] {
  const all = getAnalyticsBookings();
  const inRange = filterByRange(all, range);

  return MOCK_SERVICES.map((service) => {
    const sBookings = inRange.filter((b) => b.serviceId === service.id);
    const completed = sBookings.filter((b) => b.status === 'completed');
    return {
      serviceId: service.id,
      serviceName: service.name,
      count: sBookings.length,
      revenue: completed.reduce((s, b) => s + b.revenue, 0),
      color: service.color,
      completionRate: sBookings.length > 0 ? (completed.length / sBookings.length) * 100 : 0,
    };
  }).sort((a, b) => b.count - a.count);
}

// ── Staff Performance ─────────────────────────────────────────────────────────

export function getStaffPerformance(range: DateRange): StaffPerformance[] {
  const all = getAnalyticsBookings();
  const inRange = filterByRange(all, range);

  return MOCK_STAFF.map((staff) => {
    const sBookings = inRange.filter((b) => b.staffId === staff.id);
    const completed = sBookings.filter((b) => b.status === 'completed');
    const cancelled = sBookings.filter((b) => b.status === 'cancelled');

    // Retention: clients who had at least 2 bookings with this staff in range
    const clientCounts: Record<string, number> = {};
    for (const b of sBookings) {
      clientCounts[b.clientId] = (clientCounts[b.clientId] || 0) + 1;
    }
    const uniqueClients = Object.keys(clientCounts).length;
    const returningClients = Object.values(clientCounts).filter((c) => c > 1).length;

    return {
      staffId: staff.id,
      staffName: `${staff.firstName} ${staff.lastName}`,
      appointmentsCompleted: completed.length,
      appointmentsTotal: sBookings.length,
      cancellationRate: sBookings.length > 0 ? (cancelled.length / sBookings.length) * 100 : 0,
      revenue: completed.reduce((s, b) => s + b.revenue, 0),
      avgSessionMinutes:
        completed.length > 0
          ? completed.reduce((s, b) => s + b.durationMinutes, 0) / completed.length
          : 0,
      clientRetentionRate: uniqueClients > 0 ? (returningClients / uniqueClients) * 100 : 0,
    };
  }).sort((a, b) => b.appointmentsCompleted - a.appointmentsCompleted);
}

// ── Revenue Breakdown ─────────────────────────────────────────────────────────

export function getRevenueBreakdown(range: DateRange): RevenueBreakdown[] {
  const all = getAnalyticsBookings();
  const completed = filterByRange(all, range).filter((b) => b.status === 'completed');

  const GATEWAY_COLORS: Record<string, string> = {
    stripe: '#6366f1',
    paypal: '#f59e0b',
    square: '#10b981',
  };

  const gatewayMap: Record<string, { amount: number; count: number }> = {};
  for (const b of completed) {
    if (!gatewayMap[b.gateway]) gatewayMap[b.gateway] = { amount: 0, count: 0 };
    gatewayMap[b.gateway].amount += b.revenue;
    gatewayMap[b.gateway].count += 1;
  }

  return Object.entries(gatewayMap)
    .map(([gateway, data]) => ({
      label: gateway.charAt(0).toUpperCase() + gateway.slice(1),
      amount: data.amount,
      count: data.count,
      color: GATEWAY_COLORS[gateway] ?? '#9ca3af',
    }))
    .sort((a, b) => b.amount - a.amount);
}

// ── Payment type breakdown ────────────────────────────────────────────────────

export function getPaymentTypeBreakdown(range: DateRange): RevenueBreakdown[] {
  const all = getAnalyticsBookings();
  const completed = filterByRange(all, range).filter((b) => b.status === 'completed');

  const full = completed.filter((b) => b.paymentType === 'full');
  const deposit = completed.filter((b) => b.paymentType === 'deposit');

  return [
    {
      label: 'Full Payment',
      amount: full.reduce((s, b) => s + b.revenue, 0),
      count: full.length,
      color: '#0284c7',
    },
    {
      label: 'Deposit',
      amount: deposit.reduce((s, b) => s + b.revenue, 0),
      count: deposit.length,
      color: '#7c3aed',
    },
  ].filter((r) => r.count > 0);
}

// ── Day-of-week distribution ──────────────────────────────────────────────────

export function getDayOfWeekDistribution(
  range: DateRange
): { day: string; shortDay: string; count: number; revenue: number }[] {
  const all = getAnalyticsBookings();
  const inRange = filterByRange(all, range);

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return DAYS.map((day, idx) => {
    const dayBookings = inRange.filter((b) => parseISO(b.date).getDay() === idx);
    const completed = dayBookings.filter((b) => b.status === 'completed');
    return {
      day,
      shortDay: SHORT[idx],
      count: dayBookings.length,
      revenue: completed.reduce((s, b) => s + b.revenue, 0),
    };
  });
}

// ── Hour-of-day distribution ──────────────────────────────────────────────────

export function getHourDistribution(
  range: DateRange
): { hour: number; label: string; count: number }[] {
  const all = getAnalyticsBookings();
  const inRange = filterByRange(all, range);

  const result: { hour: number; label: string; count: number }[] = [];
  for (let h = 7; h <= 18; h++) {
    const hourStr = `${String(h).padStart(2, '0')}:`;
    const count = inRange.filter((b) => b.startTime.startsWith(hourStr)).length;
    const ampm = h < 12 ? 'AM' : 'PM';
    const label = `${h > 12 ? h - 12 : h}${ampm}`;
    result.push({ hour: h, label, count });
  }
  return result;
}

// ── Top Clients ───────────────────────────────────────────────────────────────

export function getTopClients(range: DateRange, limit = 10): TopClient[] {
  const all = getAnalyticsBookings();
  const inRange = filterByRange(all, range);

  const map: Record<string, { name: string; total: number; spent: number; lastVisit: string }> = {};
  for (const b of inRange) {
    if (!map[b.clientId]) {
      map[b.clientId] = { name: b.clientName, total: 0, spent: 0, lastVisit: b.date };
    }
    map[b.clientId].total += 1;
    if (b.status === 'completed') map[b.clientId].spent += b.revenue;
    if (b.date > map[b.clientId].lastVisit) map[b.clientId].lastVisit = b.date;
  }

  return Object.entries(map)
    .map(([clientId, data]) => ({
      clientId,
      clientName: data.name,
      totalBookings: data.total,
      totalSpent: data.spent,
      lastVisit: data.lastVisit,
      status: 'active' as const,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, limit);
}

// ── Cumulative revenue ────────────────────────────────────────────────────────

export function getCumulativeRevenue(
  range: DateRange
): { date: string; cumulative: number }[] {
  const trends = getBookingTrends(range);
  let running = 0;
  return trends.map((t) => {
    running += t.revenue;
    return { date: t.date, cumulative: running };
  });
}

// ── CSV export helper ─────────────────────────────────────────────────────────

export function exportToCSV(headers: string[], rows: (string | number)[][]): void {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv =
    headers.map(escape).join(',') +
    '\n' +
    rows.map((r) => r.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `analytics-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
