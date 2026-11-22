import { parseSheetDate } from '@/lib/dateUtils';
import { plannedCellKey, type SalesPerformancePlannedMap } from '@/lib/crmPipelineSalesPerformancePlanned';
import {
  DASHBOARD_SECTION_TOTAL_LABEL,
  crmClientKey,
  crmCreatedIso,
  crmInRange,
  crmIsoTime,
  crmRevenueOf,
  crmWonIso,
} from '@/lib/crmPipelineDashboard';

export type FiveForThreeMetricKey =
  | 'leads'
  | 'unique_meetings'
  | 'clients'
  | 'conversion_ratio'
  | 'revenue'
  | 'avg_sale';

export const FIVE_FOR_THREE_METRIC_ORDER: FiveForThreeMetricKey[] = [
  'leads',
  'unique_meetings',
  'clients',
  'conversion_ratio',
  'revenue',
  'avg_sale',
];

export const FIVE_FOR_THREE_METRIC_LABELS: Record<FiveForThreeMetricKey, string> = {
  leads: 'No Of Leads',
  unique_meetings: 'No. of Unique Meetings',
  clients: 'No of Clients',
  conversion_ratio: 'Conversion Ratio (Meetings to Clients)',
  revenue: 'Revenue',
  avg_sale: 'Avg Rs Sales',
};

export type PlannedActual = { planned: number | null; actual: number | null };

export type FiveForThreeSalesRow = {
  salesperson: string;
  isTotal: boolean;
  metrics: Record<FiveForThreeMetricKey, PlannedActual>;
};

export type FiveForThreeWeek = {
  label: string;
  start: number;
  end: number;
  rows: FiveForThreeSalesRow[];
};

export type FiveForThreeMonth = {
  label: string;
  year: number;
  month: number;
  weeks: FiveForThreeWeek[];
};

export type FiveForThreeBuildResult = {
  months: FiveForThreeMonth[];
};

const UNASSIGNED = '(Unassigned)';

/** Collapse spaces and lowercase — used to merge "Akas Das" / "Akas das" / "Akas  Das". */
export function salespersonNormalizeKey(raw: unknown): string {
  const s = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  return s || UNASSIGNED.toLowerCase();
}

function salespersonDisplayName(normalizedKey: string): string {
  if (normalizedKey === UNASSIGNED.toLowerCase()) return UNASSIGNED;
  return normalizedKey
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Canonical salesperson label for grouping rows (case- and spacing-insensitive). */
export function salespersonLabel(raw: unknown): string {
  return salespersonDisplayName(salespersonNormalizeKey(raw));
}

function activityDoneAt(act: any): string | null {
  return parseSheetDate(act.done_at) || parseSheetDate(act.created_at);
}

/** CRM follow-ups: todo, email, call, and meeting all count as a unique “meeting” for 5 For 3 when marked done. */
const FOLLOW_UP_ACTIVITY_TYPES = new Set(['todo', 'email', 'call', 'meeting']);

function isCompletedFollowUp(act: any): boolean {
  if (String(act.event_type || '').toLowerCase() !== 'activity') return false;
  if (String(act.is_done || 'N').toUpperCase() !== 'Y') return false;
  const type = String(act.activity_type || '').toLowerCase();
  return FOLLOW_UP_ACTIVITY_TYPES.has(type);
}

function weekdayShort(year: number, monthIndex: number, day: number): string {
  const d = new Date(year, monthIndex, day);
  return d.toLocaleString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' });
}

export function buildMonthWeekBuckets(year: number, monthIndex: number): Omit<FiveForThreeWeek, 'rows'>[] {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const weeks: Omit<FiveForThreeWeek, 'rows'>[] = [];
  let w = 1;

  let firstMonday = 1;
  while (firstMonday <= lastDay && new Date(year, monthIndex, firstMonday).getDay() !== 1) {
    firstMonday += 1;
  }

  // Days before the first Monday (Mon→Sun weeks). If the 1st is Sunday, skip it — that day belongs to the prior month's week ending Sunday.
  const monthStartsSunday = new Date(year, monthIndex, 1).getDay() === 0;
  const prefixStartDay = monthStartsSunday ? 2 : 1;
  if (firstMonday > prefixStartDay) {
    const prefixEnd = firstMonday - 1;
    const start = new Date(year, monthIndex, prefixStartDay, 0, 0, 0, 0).getTime();
    const end = new Date(year, monthIndex, prefixEnd, 23, 59, 59, 999).getTime() + 1;
    const rangeLabel = `${prefixStartDay} ${weekdayShort(year, monthIndex, prefixStartDay)}-${prefixEnd} ${weekdayShort(year, monthIndex, prefixEnd)}`;
    weeks.push({ label: `Week ${w} (${rangeLabel})`, start, end });
    w += 1;
  }

  for (let mon = firstMonday; mon <= lastDay; mon++) {
    if (new Date(year, monthIndex, mon).getDay() !== 1) continue;

    const sunDate = new Date(year, monthIndex, mon);
    sunDate.setDate(sunDate.getDate() + 6);

    const start = new Date(year, monthIndex, mon, 0, 0, 0, 0).getTime();
    const end =
      sunDate.getMonth() === monthIndex
        ? new Date(year, monthIndex, sunDate.getDate(), 23, 59, 59, 999).getTime() + 1
        : new Date(year, monthIndex, lastDay, 23, 59, 59, 999).getTime() + 1;

    const sunDay = sunDate.getDate();
    const sunMo = sunDate.getMonth();
    const sunY = sunDate.getFullYear();
    const rangeLabel = `${mon} Mon-${sunDay} ${weekdayShort(sunY, sunMo, sunDay)}`;
    weeks.push({ label: `Week ${w} (${rangeLabel})`, start, end });
    w += 1;
  }

  return weeks;
}

function monthLabel(year: number, monthIndex: number): string {
  const d = new Date(year, monthIndex, 1);
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

/** 5 For 3 shows one calendar month — the month that contains the range end (`to`). */
function singleDisplayMonth(to: Date): { year: number; month: number } {
  return { year: to.getFullYear(), month: to.getMonth() };
}

type WeekAccum = {
  leads: number;
  meetingParties: Set<string>;
  clientParties: Set<string>;
  revenue: number;
};

function newWeekAccum(): WeekAccum {
  return { leads: 0, meetingParties: new Set(), clientParties: new Set(), revenue: 0 };
}

function finalizeMetrics(acc: WeekAccum): Record<FiveForThreeMetricKey, PlannedActual> {
  const meetings = acc.meetingParties.size;
  const clients = acc.clientParties.size;
  const revenue = acc.revenue;
  const conversion = meetings > 0 ? (clients / meetings) * 100 : 0;
  const avg = clients > 0 ? revenue / clients : 0;
  return {
    leads: { planned: null, actual: acc.leads },
    unique_meetings: { planned: null, actual: meetings },
    clients: { planned: null, actual: clients },
    conversion_ratio: { planned: null, actual: conversion },
    revenue: { planned: null, actual: revenue },
    avg_sale: { planned: null, actual: avg },
  };
}

function collectSalespeople(opps: any[]): string[] {
  const set = new Set<string>();
  for (const o of opps) set.add(salespersonLabel(o.salesperson));
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export type BuildFiveForThreeParams = {
  opportunities: any[];
  activities: any[];
  wonDatesByOppId: Record<string, string>;
  from: Date;
  to: Date;
};

export function buildCrmPipelineFiveForThree(params: BuildFiveForThreeParams): FiveForThreeBuildResult {
  const { opportunities, activities, wonDatesByOppId, to } = params;
  const oppById = new Map<string, any>();
  for (const o of opportunities) oppById.set(String(o.id), o);

  const salespeople = collectSalespeople(opportunities);
  const monthList = [singleDisplayMonth(to)];

  const months: FiveForThreeMonth[] = monthList.map(({ year, month }) => {
    const weekDefs = buildMonthWeekBuckets(year, month);
    const weeks: FiveForThreeWeek[] = weekDefs.map((def) => {
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
          totalAcc.clientParties.add(key);
          totalAcc.revenue += crmRevenueOf(o);
        }
      }

      for (const act of activities) {
        if (!isCompletedFollowUp(act)) continue;
        const at = activityDoneAt(act);
        if (!crmInRange(at, def.start, def.end)) continue;
        const opp = oppById.get(String(act.opportunity_id));
        if (!opp) continue;
        const sp = salespersonLabel(opp.salesperson);
        const partyKey = `${sp}|${crmClientKey(opp)}`;
        const acc = perSp.get(sp) || newWeekAccum();
        if (!perSp.has(sp)) perSp.set(sp, acc);
        acc.meetingParties.add(partyKey);
        totalAcc.meetingParties.add(crmClientKey(opp));
      }

      const rows: FiveForThreeSalesRow[] = salespeople.map((sp) => ({
        salesperson: sp,
        isTotal: false,
        metrics: finalizeMetrics(perSp.get(sp) || newWeekAccum()),
      }));

      rows.push({
        salesperson: DASHBOARD_SECTION_TOTAL_LABEL,
        isTotal: true,
        metrics: finalizeMetrics(totalAcc),
      });

      return { ...def, rows };
    });

    return {
      label: monthLabel(year, month),
      year,
      month,
      weeks,
    };
  });

  return { months };
}

export function formatFiveForThreeActual(metric: FiveForThreeMetricKey, value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (metric === 'conversion_ratio') return `${value.toFixed(1)}%`;
  if (metric === 'revenue' || metric === 'avg_sale') {
    return value.toLocaleString('en-IN', { maximumFractionDigits: metric === 'avg_sale' ? 2 : 0 });
  }
  return String(Math.round(value));
}

export function formatFiveForThreePlanned(metric: FiveForThreeMetricKey, value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return formatFiveForThreeActual(metric, value);
}

export function fiveForThreeWeekKeyFromLabel(label: string, fallbackIndex = 0): string {
  const m = label.match(/^Week\s+(\d+)/i);
  return m ? `w${m[1]}` : `w${fallbackIndex + 1}`;
}

export function applyPlannedMapToFiveForThree(
  result: FiveForThreeBuildResult,
  planned: SalesPerformancePlannedMap
): FiveForThreeBuildResult {
  const months = result.months.map((month) => ({
    ...month,
    weeks: month.weeks.map((week, wi) => {
      const weekKey = fiveForThreeWeekKeyFromLabel(week.label, wi);
      let sumLeads = 0;
      let sumMeetings = 0;
      let hasLeads = false;
      let hasMeetings = false;

      const rows = week.rows.map((row) => {
        if (row.isTotal) return row;
        const key = plannedCellKey(weekKey, row.salesperson);
        const p = planned[key];
        const leadsPlanned = p?.leads ?? null;
        const meetingsPlanned = p?.meetings ?? null;
        if (leadsPlanned != null) {
          sumLeads += leadsPlanned;
          hasLeads = true;
        }
        if (meetingsPlanned != null) {
          sumMeetings += meetingsPlanned;
          hasMeetings = true;
        }
        return {
          ...row,
          metrics: {
            ...row.metrics,
            leads: { ...row.metrics.leads, planned: leadsPlanned },
            unique_meetings: { ...row.metrics.unique_meetings, planned: meetingsPlanned },
          },
        };
      });

      const totalIdx = rows.findIndex((r) => r.isTotal);
      if (totalIdx >= 0) {
        const total = rows[totalIdx];
        rows[totalIdx] = {
          ...total,
          metrics: {
            ...total.metrics,
            leads: { ...total.metrics.leads, planned: hasLeads ? sumLeads : null },
            unique_meetings: {
              ...total.metrics.unique_meetings,
              planned: hasMeetings ? sumMeetings : null,
            },
          },
        };
      }

      return { ...week, rows };
    }),
  }));

  return { months };
}