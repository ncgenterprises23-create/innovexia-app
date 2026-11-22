import { parseSheetDate } from '@/lib/dateUtils';
import {
  DASHBOARD_SECTION_TOTAL_LABEL,
  crmClientKey,
  crmCreatedIso,
  crmInRange,
  crmRevenueOf,
  crmWonIso,
} from '@/lib/crmPipelineDashboard';
import {
  buildMonthWeekBuckets,
  salespersonLabel,
  type PlannedActual,
} from '@/lib/crmPipelineFiveForThree';

export type SalesPerformanceStatusFilter = 'all' | 'open' | 'won' | 'lost';

export type SalesPerformanceMetricKey =
  | 'leads'
  | 'meetings'
  | 'conversion_ratio'
  | 'revenue'
  | 'costing'
  | 'profit';

export const SALES_PERFORMANCE_METRIC_ORDER: SalesPerformanceMetricKey[] = [
  'leads',
  'meetings',
  'conversion_ratio',
  'revenue',
  'costing',
  'profit',
];

export const SALES_PERFORMANCE_METRIC_LABELS: Record<SalesPerformanceMetricKey, string> = {
  leads: 'No. of Leads',
  meetings: 'No. of Meetings',
  conversion_ratio: 'Conversion Ratio',
  revenue: 'Revenue',
  costing: 'Costing',
  profit: 'Profit',
};

export type SalesPerformanceRow = {
  weekKey: string;
  weekLabel: string;
  salesperson: string;
  isTotal: boolean;
  metrics: Record<SalesPerformanceMetricKey, PlannedActual>;
};

export type SalesPerformanceWeek = {
  weekKey: string;
  weekLabel: string;
  start: number;
  end: number;
  rows: SalesPerformanceRow[];
};

export type SalesPerformanceKpiSummary = Record<SalesPerformanceMetricKey, number>;

export type SalesPerformanceChartPoint = {
  weekKey: string;
  weekLabel: string;
  revenue: number;
  profit: number;
};

export type SalesPerformancePlannedContext = {
  pipelineId: string;
  yearMonth: string;
};

export type SalesPerformanceBuildResult = {
  monthLabel: string;
  plannedContext?: SalesPerformancePlannedContext;
  weeks: SalesPerformanceWeek[];
  flatRows: SalesPerformanceRow[];
  salespeople: string[];
  weekOptions: { key: string; label: string }[];
  kpiSummary: SalesPerformanceKpiSummary;
  chartSeries: SalesPerformanceChartPoint[];
};

const FOLLOW_UP_ACTIVITY_TYPES = new Set(['todo', 'email', 'call', 'meeting']);

function activityDoneAt(act: any): string | null {
  return parseSheetDate(act.done_at) || parseSheetDate(act.created_at);
}

function isCompletedFollowUp(act: any): boolean {
  if (String(act.event_type || '').toLowerCase() !== 'activity') return false;
  if (String(act.is_done || 'N').toUpperCase() !== 'Y') return false;
  const type = String(act.activity_type || '').toLowerCase();
  return FOLLOW_UP_ACTIVITY_TYPES.has(type);
}

export function crmCostingOf(opp: any): number {
  const n = Number(opp.costing);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function monthLabel(year: number, monthIndex: number): string {
  const d = new Date(year, monthIndex, 1);
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function singleDisplayMonth(to: Date): { year: number; month: number } {
  return { year: to.getFullYear(), month: to.getMonth() };
}

function oppMatchesStatus(opp: any, status: SalesPerformanceStatusFilter): boolean {
  if (status === 'all') return true;
  const o = String(opp.outcome || 'open').toLowerCase();
  return o === status;
}

export function filterOpportunitiesByStatus(
  opps: any[],
  status: SalesPerformanceStatusFilter
): any[] {
  if (status === 'all') return opps;
  return opps.filter((o) => oppMatchesStatus(o, status));
}

type WeekAccum = {
  leads: number;
  meetingParties: Set<string>;
  clientParties: Set<string>;
  revenue: number;
  costing: number;
};

function newWeekAccum(): WeekAccum {
  return { leads: 0, meetingParties: new Set(), clientParties: new Set(), revenue: 0, costing: 0 };
}

function finalizeMetrics(acc: WeekAccum): Record<SalesPerformanceMetricKey, PlannedActual> {
  const meetings = acc.meetingParties.size;
  const clients = acc.clientParties.size;
  const revenue = acc.revenue;
  const costing = acc.costing;
  const profit = revenue - costing;
  const conversion = meetings > 0 ? (clients / meetings) * 100 : 0;
  const blank = { planned: null, actual: null as number | null };
  return {
    leads: { planned: null, actual: acc.leads },
    meetings: { planned: null, actual: meetings },
    conversion_ratio: { planned: null, actual: conversion },
    revenue: { planned: null, actual: revenue },
    costing: { planned: null, actual: costing },
    profit: { planned: null, actual: profit },
  };
}

function collectSalespeople(opps: any[]): string[] {
  const set = new Set<string>();
  for (const o of opps) set.add(salespersonLabel(o.salesperson));
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function metricActual(row: SalesPerformanceRow, key: SalesPerformanceMetricKey): number {
  const v = row.metrics[key]?.actual;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export function summarizeSalesPerformanceRows(rows: SalesPerformanceRow[]): SalesPerformanceKpiSummary {
  const dataRows = rows.filter((r) => !r.isTotal);
  const leads = dataRows.reduce((s, r) => s + metricActual(r, 'leads'), 0);
  const meetings = dataRows.reduce((s, r) => s + metricActual(r, 'meetings'), 0);
  const revenue = dataRows.reduce((s, r) => s + metricActual(r, 'revenue'), 0);
  const costing = dataRows.reduce((s, r) => s + metricActual(r, 'costing'), 0);
  const profit = revenue - costing;
  let totalClients = 0;
  for (const r of dataRows) {
    const m = metricActual(r, 'meetings');
    if (m <= 0) continue;
    totalClients += m * (metricActual(r, 'conversion_ratio') / 100);
  }
  const conversion_ratio = meetings > 0 ? (totalClients / meetings) * 100 : 0;

  return {
    leads,
    meetings,
    conversion_ratio,
    revenue,
    costing,
    profit,
  };
}

export function summarizeSalesPerformanceFromWeeks(weeks: SalesPerformanceWeek[]): SalesPerformanceKpiSummary {
  const totals = weeks
    .map((w) => w.rows.find((r) => r.isTotal))
    .filter((r): r is SalesPerformanceRow => Boolean(r));
  return sumSalesPerformanceMetrics(totals);
}

function summaryToMetrics(summary: SalesPerformanceKpiSummary): Record<SalesPerformanceMetricKey, PlannedActual> {
  return {
    leads: { planned: null, actual: summary.leads },
    meetings: { planned: null, actual: summary.meetings },
    conversion_ratio: { planned: null, actual: summary.conversion_ratio },
    revenue: { planned: null, actual: summary.revenue },
    costing: { planned: null, actual: summary.costing },
    profit: { planned: null, actual: summary.profit },
  };
}

export function applySalesPerformanceClientFilters(
  source: SalesPerformanceBuildResult,
  opts: { weekKey?: string; salesperson?: string }
): Pick<SalesPerformanceBuildResult, 'weeks' | 'kpiSummary' | 'chartSeries'> {
  let weeks = source.weeks;
  if (opts.weekKey && opts.weekKey !== 'all') {
    weeks = weeks.filter((w) => w.weekKey === opts.weekKey);
  }
  if (opts.salesperson && opts.salesperson !== 'all') {
    weeks = weeks
      .map((w) => {
        const spRows = w.rows.filter((r) => !r.isTotal && r.salesperson === opts.salesperson);
        if (spRows.length === 0) return null;
        const sum = sumSalesPerformanceMetrics(spRows);
        return {
          ...w,
          rows: [
            ...spRows,
            {
              weekKey: w.weekKey,
              weekLabel: w.weekLabel,
              salesperson: DASHBOARD_SECTION_TOTAL_LABEL,
              isTotal: true,
              metrics: summaryToMetrics(sum),
            },
          ],
        };
      })
      .filter((w): w is SalesPerformanceWeek => w != null);
  }
  const kpiSummary =
    (opts.weekKey && opts.weekKey !== 'all') || (opts.salesperson && opts.salesperson !== 'all')
      ? summarizeSalesPerformanceRows(weeks.flatMap((w) => w.rows.filter((r) => !r.isTotal)))
      : source.kpiSummary;
  const chartSeries = chartSeriesFromWeeks(weeks);
  return { weeks, kpiSummary, chartSeries };
}

function sumSalesPerformanceMetrics(rows: SalesPerformanceRow[]): SalesPerformanceKpiSummary {
  const leads = rows.reduce((s, r) => s + metricActual(r, 'leads'), 0);
  const meetings = rows.reduce((s, r) => s + metricActual(r, 'meetings'), 0);
  const revenue = rows.reduce((s, r) => s + metricActual(r, 'revenue'), 0);
  const costing = rows.reduce((s, r) => s + metricActual(r, 'costing'), 0);
  const profit = revenue - costing;
  let totalClients = 0;
  for (const r of rows) {
    const m = metricActual(r, 'meetings');
    if (m <= 0) continue;
    totalClients += m * (metricActual(r, 'conversion_ratio') / 100);
  }
  const conversion_ratio = meetings > 0 ? (totalClients / meetings) * 100 : 0;
  return { leads, meetings, conversion_ratio, revenue, costing, profit };
}

export function chartSeriesFromWeeks(weeks: SalesPerformanceWeek[]): SalesPerformanceChartPoint[] {
  return weeks.map((w) => {
    const total = w.rows.find((r) => r.isTotal);
    const revenue = total ? metricActual(total, 'revenue') : 0;
    const profit = total ? metricActual(total, 'profit') : 0;
    return { weekKey: w.weekKey, weekLabel: w.weekLabel, revenue, profit };
  });
}

export function filterSalesPerformanceFlatRows(
  flatRows: SalesPerformanceRow[],
  opts: { weekKey?: string; salesperson?: string }
): SalesPerformanceRow[] {
  let rows = flatRows.filter((r) => !r.isTotal);
  if (opts.weekKey && opts.weekKey !== 'all') {
    rows = rows.filter((r) => r.weekKey === opts.weekKey);
  }
  if (opts.salesperson && opts.salesperson !== 'all') {
    rows = rows.filter((r) => r.salesperson === opts.salesperson);
  }
  return rows;
}

export type BuildSalesPerformanceParams = {
  opportunities: any[];
  activities: any[];
  wonDatesByOppId: Record<string, string>;
  to: Date;
  statusFilter?: SalesPerformanceStatusFilter;
};

export function buildCrmPipelineSalesPerformance(
  params: BuildSalesPerformanceParams
): SalesPerformanceBuildResult {
  const statusFilter = params.statusFilter ?? 'all';
  const opportunities = filterOpportunitiesByStatus(params.opportunities, statusFilter);
  const { activities, wonDatesByOppId, to } = params;

  const oppById = new Map<string, any>();
  for (const o of opportunities) oppById.set(String(o.id), o);

  const salespeople = collectSalespeople(opportunities);
  const { year, month } = singleDisplayMonth(to);
  const weekDefs = buildMonthWeekBuckets(year, month);

  const weeks: SalesPerformanceWeek[] = weekDefs.map((def, wi) => {
    const weekNumMatch = def.label.match(/^Week\s+(\d+)/i);
    const weekKey = weekNumMatch ? `w${weekNumMatch[1]}` : `w${wi + 1}`;
    const perSp = new Map<string, WeekAccum>();
    for (const sp of salespeople) perSp.set(sp, newWeekAccum());
    const totalAcc = newWeekAccum();

    for (const o of opportunities) {
      const sp = salespersonLabel(o.salesperson);
      const created = crmCreatedIso(o);
      if (crmInRange(created, def.start, def.end)) {
        const acc = perSp.get(sp) || newWeekAccum();
        if (!perSp.has(sp)) perSp.set(sp, acc);
        acc.leads += 1;
        totalAcc.leads += 1;
      }

      const won = crmWonIso(o, wonDatesByOppId);
      if (String(o.outcome || '').toLowerCase() === 'won' && crmInRange(won, def.start, def.end)) {
        const key = crmClientKey(o);
        const acc = perSp.get(sp) || newWeekAccum();
        if (!perSp.has(sp)) perSp.set(sp, acc);
        acc.clientParties.add(key);
        acc.revenue += crmRevenueOf(o);
        acc.costing += crmCostingOf(o);
        totalAcc.clientParties.add(key);
        totalAcc.revenue += crmRevenueOf(o);
        totalAcc.costing += crmCostingOf(o);
      }
    }

    for (const act of activities) {
      if (!isCompletedFollowUp(act)) continue;
      const at = activityDoneAt(act);
      if (!crmInRange(at, def.start, def.end)) continue;
      const opp = oppById.get(String(act.opportunity_id));
      if (!opp) continue;
      if (!oppMatchesStatus(opp, statusFilter)) continue;
      const sp = salespersonLabel(opp.salesperson);
      const partyKey = `${sp}|${crmClientKey(opp)}`;
      const acc = perSp.get(sp) || newWeekAccum();
      if (!perSp.has(sp)) perSp.set(sp, acc);
      acc.meetingParties.add(partyKey);
      totalAcc.meetingParties.add(crmClientKey(opp));
    }

    const rows: SalesPerformanceRow[] = salespeople.map((sp) => ({
      weekKey,
      weekLabel: def.label,
      salesperson: sp,
      isTotal: false,
      metrics: finalizeMetrics(perSp.get(sp) || newWeekAccum()),
    }));

    rows.push({
      weekKey,
      weekLabel: def.label,
      salesperson: DASHBOARD_SECTION_TOTAL_LABEL,
      isTotal: true,
      metrics: finalizeMetrics(totalAcc),
    });

    return { weekKey, weekLabel: def.label, start: def.start, end: def.end, rows };
  });

  const flatRows = weeks.flatMap((w) => w.rows);
  const kpiSummary = summarizeSalesPerformanceFromWeeks(weeks);
  const chartSeries = chartSeriesFromWeeks(weeks);
  const weekOptions = weeks.map((w) => ({ key: w.weekKey, label: w.weekLabel }));

  return {
    monthLabel: monthLabel(year, month),
    weeks,
    flatRows,
    salespeople,
    weekOptions,
    kpiSummary,
    chartSeries,
  };
}

export function formatSalesPerformanceActual(
  metric: SalesPerformanceMetricKey,
  value: number | null | undefined
): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (metric === 'conversion_ratio') return `${value.toFixed(1)}%`;
  if (metric === 'revenue' || metric === 'costing' || metric === 'profit') {
    return value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }
  return String(Math.round(value));
}

export function formatSalesPerformanceCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value === 0) return '₹0';
  const abs = Math.abs(value);
  if (abs >= 1_00_000) return `₹${(value / 1_00_000).toFixed(2)}L`;
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}