import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import type {
  DateRange,
  DateRangePreset,
  ServiceBreakdown,
  StaffPerformance,
  TopClient,
  KPISnapshot,
} from '../types';
import {
  exportToCSV,
  getBookingTrends,
  getCumulativeRevenue,
  getDayOfWeekDistribution,
  getHourDistribution,
  getKPISnapshot,
  getPaymentTypeBreakdown,
  getRevenueBreakdown,
  getServiceBreakdown,
  getStaffPerformance,
  getTopClients,
  resolveDateRange,
} from '../services/analyticsService';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

function fmtChange(n: number, isPctPoint = false): { text: string; positive: boolean } {
  const abs = Math.abs(n);
  const sign = n >= 0 ? '+' : '−';
  const text = isPctPoint ? `${sign}${abs.toFixed(1)} pp` : `${sign}${abs.toFixed(1)}%`;
  return { text, positive: n >= 0 };
}

// ── Date Range Picker ─────────────────────────────────────────────────────────

const PRESETS: { label: string; value: DateRangePreset }[] = [
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '90 Days', value: '90d' },
  { label: 'Month-to-Date', value: 'mtd' },
  { label: 'Year-to-Date', value: 'ytd' },
  { label: 'Custom', value: 'custom' },
];

interface DateRangePickerProps {
  preset: DateRangePreset;
  customRange: DateRange;
  onChange: (preset: DateRangePreset, custom?: DateRange) => void;
}

function DateRangePicker({ preset, customRange, onChange }: DateRangePickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            preset === p.value
              ? 'bg-sky-600 border-sky-600 text-white'
              : 'bg-white border-gray-200 text-gray-600 hover:border-sky-300 hover:text-sky-700'
          }`}
        >
          {p.label}
        </button>
      ))}
      {preset === 'custom' && (
        <div className="flex items-center gap-2 ml-2">
          <input
            type="date"
            value={customRange.start}
            max={customRange.end}
            onChange={(e) => onChange('custom', { ...customRange, start: e.target.value })}
            className="px-2 py-1 text-sm border border-gray-200 rounded-lg"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={customRange.end}
            min={customRange.start}
            max={format(new Date(), 'yyyy-MM-dd')}
            onChange={(e) => onChange('custom', { ...customRange, end: e.target.value })}
            className="px-2 py-1 text-sm border border-gray-200 rounded-lg"
          />
        </div>
      )}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string;
  change: number;
  changeIsPctPoint?: boolean;
  icon: string;
  iconBg: string;
}

function KPICard({ label, value, change, changeIsPctPoint, icon, iconBg }: KPICardProps) {
  const { text, positive } = fmtChange(change, changeIsPctPoint);
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 font-medium">{label}</span>
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${iconBg}`}>
          {icon}
        </span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p
        className={`text-xs font-medium flex items-center gap-1 ${
          positive ? 'text-emerald-600' : 'text-red-500'
        }`}
      >
        <span>{positive ? '▲' : '▼'}</span>
        {text}
        <span className="text-gray-400 font-normal">vs prior period</span>
      </p>
    </div>
  );
}

// ── Simple SVG Bar Chart ──────────────────────────────────────────────────────

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  formatValue?: (v: number) => string;
}

function BarChart({ data, height = 160, formatValue = String }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-end gap-1.5 min-w-0" style={{ height }}>
        {data.map((d, i) => {
          const pct = (d.value / max) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-[28px] group">
              <div className="relative w-full flex flex-col justify-end" style={{ height: height - 28 }}>
                <div
                  className="w-full rounded-t-sm transition-all duration-300 cursor-default"
                  style={{
                    height: `${Math.max(pct, 2)}%`,
                    background: d.color ?? '#0284c7',
                  }}
                  title={`${d.label}: ${formatValue(d.value)}`}
                />
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                  {formatValue(d.value)}
                </div>
              </div>
              <span className="text-xs text-gray-500 truncate w-full text-center">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SVG Line Chart ────────────────────────────────────────────────────────────

interface LineChartProps {
  data: { x: string; y: number }[];
  height?: number;
  color?: string;
  fillColor?: string;
  formatY?: (v: number) => string;
  labelStep?: number;
}

function LineChart({
  data,
  height = 180,
  color = '#0284c7',
  fillColor = 'rgba(2,132,199,0.08)',
  formatY = String,
  labelStep = 1,
}: LineChartProps) {
  const W = 600;
  const H = height;
  const PAD = { top: 12, right: 12, bottom: 28, left: 52 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxY = Math.max(...data.map((d) => d.y), 1);
  const minY = 0;

  const xScale = (i: number) => (data.length <= 1 ? PAD.left + innerW / 2 : PAD.left + (i / (data.length - 1)) * innerW);
  const yScale = (v: number) => PAD.top + innerH - ((v - minY) / (maxY - minY)) * innerH;

  const points = data.map((d, i) => `${xScale(i)},${yScale(d.y)}`).join(' ');
  const areaPoints = [
    `${xScale(0)},${PAD.top + innerH}`,
    ...data.map((d, i) => `${xScale(i)},${yScale(d.y)}`),
    `${xScale(data.length - 1)},${PAD.top + innerH}`,
  ].join(' ');

  // Y-axis labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    value: minY + f * (maxY - minY),
    y: PAD.top + innerH - f * innerH,
  }));

  // X-axis labels (sparse)
  const xLabels: { label: string; x: number }[] = data
    .filter((_, i) => i % labelStep === 0 || i === data.length - 1)
    .map((d, _, arr) => {
      const idx = data.indexOf(d);
      try {
        const parsed = parseISO(d.x);
        const label =
          arr.length > 14
            ? format(parsed, 'M/d')
            : format(parsed, 'MMM d');
        return { label, x: xScale(idx) };
      } catch {
        return { label: d.x, x: xScale(idx) };
      }
    });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="#f0f0f0" strokeWidth={1} />
          <text x={PAD.left - 6} y={t.y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
            {formatY(t.value)}
          </text>
        </g>
      ))}
      {/* Area fill */}
      <polygon points={areaPoints} fill={fillColor} />
      {/* Line */}
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {/* X labels */}
      {xLabels.map((l, i) => (
        <text key={i} x={l.x} y={H - 4} textAnchor="middle" fontSize={10} fill="#9ca3af">
          {l.label}
        </text>
      ))}
    </svg>
  );
}

// ── Donut Chart ───────────────────────────────────────────────────────────────

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  formatValue?: (v: number) => string;
}

function DonutChart({ data, size = 160, formatValue = String }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-sm" style={{ height: size }}>
        No data
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.38;
  const r = size * 0.22;

  let startAngle = -Math.PI / 2;
  const slices = data.map((d) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + R * Math.cos(startAngle);
    const y1 = cy + R * Math.sin(startAngle);
    const x2 = cx + R * Math.cos(endAngle);
    const y2 = cy + R * Math.sin(endAngle);
    const xi1 = cx + r * Math.cos(startAngle);
    const yi1 = cy + r * Math.sin(startAngle);
    const xi2 = cx + r * Math.cos(endAngle);
    const yi2 = cy + r * Math.sin(endAngle);
    const large = angle > Math.PI ? 1 : 0;
    const path = [
      `M ${x1} ${y1}`,
      `A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`,
      `L ${xi2} ${yi2}`,
      `A ${r} ${r} 0 ${large} 0 ${xi1} ${yi1}`,
      'Z',
    ].join(' ');
    const slice = { ...d, path };
    startAngle = endAngle;
    return slice;
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth={2}>
            <title>
              {s.label}: {formatValue(s.value)} ({fmtPct((s.value / total) * 100)})
            </title>
          </path>
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={11} fill="#6b7280">Total</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={13} fontWeight="bold" fill="#111827">
          {formatValue(total)}
        </text>
      </svg>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: d.color }} />
            {d.label} ({fmtPct((d.value / total) * 100)})
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sortable Table ────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc';

interface Column<T> {
  key: keyof T;
  label: string;
  render?: (val: unknown, row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
}

function DataTable<T>({
  columns,
  rows,
  defaultSort,
}: {
  columns: Column<T>[];
  rows: T[];
  defaultSort?: { key: keyof T; dir: SortDir };
}) {
  const [sortKey, setSortKey] = useState<keyof T | null>(defaultSort?.key ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSort?.dir ?? 'desc');

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === 'number' ? (av as number) - (bv as number) : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  function handleSort(key: keyof T) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-100">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                onClick={() => handleSort(col.key)}
                className={`py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-sky-600 whitespace-nowrap ${
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                }`}
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
              {columns.map((col) => (
                <td
                  key={String(col.key)}
                  className={`py-2.5 px-3 text-gray-700 ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                  }`}
                >
                  {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-gray-400 text-sm">
                No data for selected period
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────

function Card({ title, action, children }: { title?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="text-base font-semibold text-gray-900">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ── Tab nav ───────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'trends' | 'revenue' | 'staff' | 'services';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '🏠' },
  { id: 'trends', label: 'Booking Trends', icon: '📈' },
  { id: 'revenue', label: 'Revenue', icon: '💰' },
  { id: 'staff', label: 'Staff Performance', icon: '👤' },
  { id: 'services', label: 'Services', icon: '🩺' },
];

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ range, kpi }: { range: DateRange; kpi: KPISnapshot }) {
  const trends = useMemo(() => getBookingTrends(range), [range]);
  const services = useMemo(() => getServiceBreakdown(range), [range]);

  const labelStep = useMemo(() => {
    const days = trends.length;
    if (days <= 14) return 1;
    if (days <= 30) return 3;
    if (days <= 90) return 7;
    return 14;
  }, [trends]);

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Revenue"
          value={fmt$(kpi.totalRevenue)}
          change={kpi.revenueChange}
          icon="💵"
          iconBg="bg-emerald-50"
        />
        <KPICard
          label="Total Bookings"
          value={kpi.totalBookings.toLocaleString()}
          change={kpi.bookingsChange}
          icon="📅"
          iconBg="bg-sky-50"
        />
        <KPICard
          label="Completion Rate"
          value={fmtPct(kpi.completionRate)}
          change={kpi.completionChange}
          changeIsPctPoint
          icon="✅"
          iconBg="bg-violet-50"
        />
        <KPICard
          label="Avg Booking Value"
          value={fmt$(kpi.avgBookingValue)}
          change={kpi.avgValueChange}
          icon="🎯"
          iconBg="bg-amber-50"
        />
      </div>

      {/* Client split */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-500 mb-1">New Clients</p>
          <p className="text-3xl font-bold text-sky-600">{kpi.newClients}</p>
          <p className="text-xs text-gray-400 mt-1">First-time bookings</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-500 mb-1">Returning Clients</p>
          <p className="text-3xl font-bold text-violet-600">{kpi.returningClients}</p>
          <p className="text-xs text-gray-400 mt-1">Repeat bookings</p>
        </div>
      </div>

      {/* Trend line */}
      <Card title="Booking Volume & Revenue Trend">
        <LineChart
          data={trends.map((t) => ({ x: t.date, y: t.revenue }))}
          height={200}
          formatY={(v) => fmt$(v)}
          labelStep={labelStep}
        />
        <p className="text-xs text-gray-400 mt-2 text-center">Daily revenue (completed bookings)</p>
      </Card>

      {/* Service mix */}
      <Card title="Service Mix">
        <div className="flex flex-col md:flex-row gap-6 items-center">
          <DonutChart
            data={services.map((s) => ({ label: s.serviceName, value: s.count, color: s.color }))}
            size={180}
            formatValue={(v) => String(v)}
          />
          <div className="flex-1 space-y-3 w-full">
            {services.map((s) => (
              <div key={s.serviceId}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700 font-medium">{s.serviceName}</span>
                  <span className="text-gray-500">
                    {s.count} bookings · {fmt$(s.revenue)}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${((s.count / Math.max(...services.map((x) => x.count), 1)) * 100).toFixed(1)}%`,
                      background: s.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Booking Trends Tab ────────────────────────────────────────────────────────

function TrendsTab({ range }: { range: DateRange }) {
  const trends = useMemo(() => getBookingTrends(range), [range]);
  const dayDist = useMemo(() => getDayOfWeekDistribution(range), [range]);
  const hourDist = useMemo(() => getHourDistribution(range), [range]);

  const labelStep = useMemo(() => {
    if (trends.length <= 14) return 1;
    if (trends.length <= 30) return 3;
    if (trends.length <= 90) return 7;
    return 14;
  }, [trends]);

  const maxDay = Math.max(...dayDist.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      <Card title="Daily Booking Volume">
        <LineChart
          data={trends.map((t) => ({ x: t.date, y: t.count }))}
          height={200}
          color="#7c3aed"
          fillColor="rgba(124,58,237,0.08)"
          formatY={(v) => String(Math.round(v))}
          labelStep={labelStep}
        />
        <p className="text-xs text-gray-400 mt-2 text-center">Total bookings per day</p>
      </Card>

      {/* Completed vs Cancelled stacked summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Completed vs Cancelled">
          <BarChart
            data={trends
              .filter((_, i) => i % Math.max(1, Math.floor(trends.length / 20)) === 0)
              .map((t) => ({ label: format(parseISO(t.date), 'M/d'), value: t.completedCount, color: '#059669' }))}
            height={150}
            formatValue={String}
          />
          <p className="text-xs text-gray-400 mt-2 text-center">Completed appointments (sample)</p>
        </Card>
        <Card title="Cancellations">
          <BarChart
            data={trends
              .filter((_, i) => i % Math.max(1, Math.floor(trends.length / 20)) === 0)
              .map((t) => ({ label: format(parseISO(t.date), 'M/d'), value: t.cancelledCount, color: '#f87171' }))}
            height={150}
            formatValue={String}
          />
          <p className="text-xs text-gray-400 mt-2 text-center">Cancelled appointments (sample)</p>
        </Card>
      </div>

      {/* Day of week heatmap */}
      <Card title="Bookings by Day of Week">
        <div className="flex items-end gap-2 h-28">
          {dayDist.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="relative w-full flex flex-col justify-end" style={{ height: 80 }}>
                <div
                  className="w-full rounded-t transition-all duration-300"
                  style={{
                    height: `${Math.max((d.count / maxDay) * 100, 4)}%`,
                    background: `rgba(2, 132, 199, ${0.2 + (d.count / maxDay) * 0.8})`,
                  }}
                  title={`${d.day}: ${d.count} bookings`}
                />
              </div>
              <span className="text-xs text-gray-500">{d.shortDay}</span>
              <span className="text-xs font-medium text-gray-700">{d.count}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Hour of day distribution */}
      <Card title="Bookings by Hour of Day">
        <BarChart
          data={hourDist.map((h) => ({ label: h.label, value: h.count, color: '#0284c7' }))}
          height={160}
          formatValue={String}
        />
        <p className="text-xs text-gray-400 mt-2 text-center">Total bookings by appointment start time</p>
      </Card>
    </div>
  );
}

// ── Revenue Tab ───────────────────────────────────────────────────────────────

function RevenueTab({ range }: { range: DateRange }) {
  const cumulative = useMemo(() => getCumulativeRevenue(range), [range]);
  const gateway = useMemo(() => getRevenueBreakdown(range), [range]);
  const paymentType = useMemo(() => getPaymentTypeBreakdown(range), [range]);
  const trends = useMemo(() => getBookingTrends(range), [range]);

  const labelStep = useMemo(() => {
    if (cumulative.length <= 14) return 1;
    if (cumulative.length <= 30) return 3;
    if (cumulative.length <= 90) return 7;
    return 14;
  }, [cumulative]);

  function handleExport() {
    exportToCSV(
      ['Date', 'Daily Revenue', 'Cumulative Revenue'],
      trends.map((t, i) => [t.date, fmt$(t.revenue), fmt$(cumulative[i]?.cumulative ?? 0)])
    );
  }

  return (
    <div className="space-y-6">
      {/* Cumulative revenue line */}
      <Card
        title="Cumulative Revenue"
        action={
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:text-sky-600 hover:border-sky-300 transition-colors"
          >
            Export CSV
          </button>
        }
      >
        <LineChart
          data={cumulative.map((d) => ({ x: d.date, y: d.cumulative }))}
          height={200}
          color="#059669"
          fillColor="rgba(5,150,105,0.08)"
          formatY={(v) => fmt$(v)}
          labelStep={labelStep}
        />
        <p className="text-xs text-gray-400 mt-2 text-center">Cumulative revenue from completed bookings</p>
      </Card>

      {/* Daily revenue bars */}
      <Card title="Daily Revenue">
        <BarChart
          data={trends
            .filter((_, i) => i % Math.max(1, Math.floor(trends.length / 30)) === 0)
            .map((t) => ({ label: format(parseISO(t.date), 'M/d'), value: t.revenue / 100, color: '#059669' }))}
          height={160}
          formatValue={(v) => `$${Math.round(v)}`}
        />
      </Card>

      {/* Gateway + Payment type donuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Revenue by Gateway">
          <DonutChart
            data={gateway.map((g) => ({ label: g.label, value: g.amount, color: g.color }))}
            size={180}
            formatValue={fmt$}
          />
          {gateway.length > 0 && (
            <table className="w-full text-sm mt-4 border-t border-gray-50 pt-3">
              <tbody>
                {gateway.map((g) => (
                  <tr key={g.label} className="border-b border-gray-50">
                    <td className="py-1.5 px-2 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm" style={{ background: g.color }} />
                      {g.label}
                    </td>
                    <td className="py-1.5 px-2 text-right font-medium">{fmt$(g.amount)}</td>
                    <td className="py-1.5 px-2 text-right text-gray-400">{g.count} txn</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Payment Type Split">
          <DonutChart
            data={paymentType.map((p) => ({ label: p.label, value: p.amount, color: p.color }))}
            size={180}
            formatValue={fmt$}
          />
        </Card>
      </div>
    </div>
  );
}

// ── Staff Tab ─────────────────────────────────────────────────────────────────

function StaffTab({ range }: { range: DateRange }) {
  const staff = useMemo<StaffPerformance[]>(() => getStaffPerformance(range), [range]);

  function handleExport() {
    exportToCSV(
      ['Staff Name', 'Completed', 'Total', 'Cancellation Rate', 'Revenue', 'Avg Session (min)', 'Retention Rate'],
      staff.map((s) => [
        s.staffName,
        s.appointmentsCompleted,
        s.appointmentsTotal,
        fmtPct(s.cancellationRate),
        fmt$(s.revenue),
        s.avgSessionMinutes.toFixed(0),
        fmtPct(s.clientRetentionRate),
      ])
    );
  }

  const columns: Column<StaffPerformance>[] = [
    {
      key: 'staffName',
      label: 'Staff Member',
      render: (v) => <span className="font-medium text-gray-900">{String(v)}</span>,
    },
    {
      key: 'appointmentsCompleted',
      label: 'Completed',
      align: 'right',
      render: (v) => <span className="font-semibold text-gray-800">{String(v)}</span>,
    },
    {
      key: 'appointmentsTotal',
      label: 'Total',
      align: 'right',
    },
    {
      key: 'cancellationRate',
      label: 'Cancel Rate',
      align: 'right',
      render: (v) => {
        const n = v as number;
        return (
          <span className={n > 25 ? 'text-red-500 font-medium' : 'text-gray-700'}>
            {fmtPct(n)}
          </span>
        );
      },
    },
    {
      key: 'revenue',
      label: 'Revenue',
      align: 'right',
      render: (v) => <span className="font-semibold text-emerald-700">{fmt$(v as number)}</span>,
    },
    {
      key: 'avgSessionMinutes',
      label: 'Avg Session',
      align: 'right',
      render: (v) => `${(v as number).toFixed(0)} min`,
    },
    {
      key: 'clientRetentionRate',
      label: 'Retention',
      align: 'right',
      render: (v) => (
        <div className="flex items-center justify-end gap-2">
          <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full"
              style={{ width: `${(v as number).toFixed(1)}%` }}
            />
          </div>
          <span>{fmtPct(v as number, 0)}</span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Revenue per staff bar */}
      <Card title="Revenue by Staff Member">
        <BarChart
          data={staff.map((s) => ({
            label: s.staffName.split(' ')[0],
            value: s.revenue / 100,
            color: '#7c3aed',
          }))}
          height={160}
          formatValue={(v) => `$${Math.round(v)}`}
        />
      </Card>

      <Card
        title="Staff Performance Table"
        action={
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:text-sky-600 hover:border-sky-300 transition-colors"
          >
            Export CSV
          </button>
        }
      >
        <DataTable<StaffPerformance>
          columns={columns}
          rows={staff}
          defaultSort={{ key: 'revenue', dir: 'desc' }}
        />
      </Card>
    </div>
  );
}

// ── Services Tab ──────────────────────────────────────────────────────────────

function ServicesTab({ range }: { range: DateRange }) {
  const services = useMemo<ServiceBreakdown[]>(() => getServiceBreakdown(range), [range]);

  function handleExport() {
    exportToCSV(
      ['Service', 'Bookings', 'Revenue', 'Completion Rate'],
      services.map((s) => [s.serviceName, s.count, fmt$(s.revenue), fmtPct(s.completionRate)])
    );
  }

  const columns: Column<ServiceBreakdown>[] = [
    {
      key: 'serviceName',
      label: 'Service',
      render: (v, row) => (
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: (row as ServiceBreakdown).color }} />
          <span className="font-medium text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: 'count',
      label: 'Bookings',
      align: 'right',
      render: (v) => <span className="font-semibold">{String(v)}</span>,
    },
    {
      key: 'revenue',
      label: 'Revenue',
      align: 'right',
      render: (v) => <span className="font-semibold text-emerald-700">{fmt$(v as number)}</span>,
    },
    {
      key: 'completionRate',
      label: 'Completion Rate',
      align: 'right',
      render: (v) => {
        const n = v as number;
        return (
          <div className="flex items-center justify-end gap-2">
            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${n.toFixed(1)}%` }} />
            </div>
            <span>{fmtPct(n, 0)}</span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Bookings per Service">
          <BarChart
            data={services.map((s) => ({ label: s.serviceName.split(' ')[0], value: s.count, color: s.color }))}
            height={160}
            formatValue={String}
          />
        </Card>
        <Card title="Revenue per Service">
          <BarChart
            data={services.map((s) => ({ label: s.serviceName.split(' ')[0], value: s.revenue / 100, color: s.color }))}
            height={160}
            formatValue={(v) => `$${Math.round(v)}`}
          />
        </Card>
      </div>

      <Card
        title="Service Details"
        action={
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:text-sky-600 hover:border-sky-300 transition-colors"
          >
            Export CSV
          </button>
        }
      >
        <DataTable<ServiceBreakdown>
          columns={columns}
          rows={services}
          defaultSort={{ key: 'count', dir: 'desc' }}
        />
      </Card>

      {/* Top Clients */}
      <TopClientsCard range={range} />
    </div>
  );
}

// ── Top Clients card ──────────────────────────────────────────────────────────

function TopClientsCard({ range }: { range: DateRange }) {
  const clients = useMemo<TopClient[]>(() => getTopClients(range, 10), [range]);

  function handleExport() {
    exportToCSV(
      ['Client', 'Bookings', 'Total Spent', 'Last Visit'],
      clients.map((c) => [c.clientName, c.totalBookings, fmt$(c.totalSpent), c.lastVisit])
    );
  }

  const columns: Column<TopClient>[] = [
    {
      key: 'clientName',
      label: 'Client',
      render: (v) => <span className="font-medium text-gray-900">{String(v)}</span>,
    },
    {
      key: 'totalBookings',
      label: 'Bookings',
      align: 'right',
    },
    {
      key: 'totalSpent',
      label: 'Total Spent',
      align: 'right',
      render: (v) => <span className="font-semibold text-emerald-700">{fmt$(v as number)}</span>,
    },
    {
      key: 'lastVisit',
      label: 'Last Visit',
      align: 'right',
      render: (v) => {
        try {
          return format(parseISO(String(v)), 'MMM d, yyyy');
        } catch {
          return String(v);
        }
      },
    },
  ];

  return (
    <Card
      title="Top Clients"
      action={
        <button
          onClick={handleExport}
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:text-sky-600 hover:border-sky-300 transition-colors"
        >
          Export CSV
        </button>
      }
    >
      <DataTable<TopClient>
        columns={columns}
        rows={clients}
        defaultSort={{ key: 'totalSpent', dir: 'desc' }}
      />
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [preset, setPreset] = useState<DateRangePreset>('30d');
  const [customRange, setCustomRange] = useState<DateRange>({
    start: format(new Date(Date.now() - 29 * 86400000), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });

  const range = useMemo(() => resolveDateRange(preset, customRange), [preset, customRange]);

  const kpi = useMemo(() => getKPISnapshot(range), [range]);

  const handleRangeChange = useCallback((newPreset: DateRangePreset, newCustom?: DateRange) => {
    setPreset(newPreset);
    if (newCustom) setCustomRange(newCustom);
  }, []);

  // Scroll to top when tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
        <p className="text-sm text-gray-500">
          Booking trends, staff performance, and revenue — powered by your booking history.
        </p>
      </div>

      {/* Date range picker */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <DateRangePicker preset={preset} customRange={customRange} onChange={handleRangeChange} />
        <p className="text-xs text-gray-400 mt-2">
          Showing data from{' '}
          <strong>
            {format(parseISO(range.start), 'MMM d, yyyy')} – {format(parseISO(range.end), 'MMM d, yyyy')}
          </strong>
        </p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab range={range} kpi={kpi} />}
      {activeTab === 'trends' && <TrendsTab range={range} />}
      {activeTab === 'revenue' && <RevenueTab range={range} />}
      {activeTab === 'staff' && <StaffTab range={range} />}
      {activeTab === 'services' && <ServicesTab range={range} />}
    </div>
  );
}
