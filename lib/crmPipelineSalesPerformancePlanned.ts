import type { SalesPerformanceBuildResult, SalesPerformanceWeek } from '@/lib/crmPipelineSalesPerformance';
import { salespersonLabel } from '@/lib/crmPipelineFiveForThree';

export type SalesPerformancePlannedContext = {
  pipelineId: string;
  yearMonth: string;
};

export type SalesPerformancePlannedEdit = {
  weekKey: string;
  salesperson: string;
  plannedLeads: number | null;
  plannedMeetings: number | null;
};

export function plannedCellKey(weekKey: string, salesperson: string): string {
  return `${normalizeSalesPerformanceWeekKey(weekKey)}|${salespersonLabel(salesperson)}`;
}

export function pickPlannedSheetField(row: Record<string, unknown>, name: string): unknown {
  const direct = row[name];
  if (direct !== undefined && direct !== null && String(direct).trim() !== '') return direct;
  const key = Object.keys(row).find((k) => k.trim().toLowerCase() === name.toLowerCase());
  return key != null ? row[key] : undefined;
}

/** Match sheet `year_month` whether stored as 2026-11, a date serial, or a date string. */
export function normalizePlannedYearMonth(raw: unknown): string {
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  const ym = s.match(/^(\d{4})[-/](\d{1,2})$/);
  if (ym) return `${ym[1]}-${String(Number(ym[2])).padStart(2, '0')}`;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 20000 && n < 100000) {
    const utcMs = (n - 25569) * 86400 * 1000;
    const d = new Date(utcMs);
    if (!Number.isNaN(d.getTime())) return yearMonthFromDate(d);
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return yearMonthFromDate(d);
  return s;
}

export function yearMonthFromDate(to: Date): string {
  return `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}`;
}

export function salesPerformancePlannedRowId(
  pipelineId: string,
  yearMonth: string,
  weekKey: string,
  salesperson: string
): string {
  const safeSp = salesperson.trim().replace(/[^\w.-]+/g, '_').slice(0, 48);
  return `spp_${pipelineId}_${yearMonth}_${weekKey}_${safeSp}`.slice(0, 120);
}

function parsePlannedNum(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export type SalesPerformancePlannedMap = Record<
  string,
  { leads: number | null; meetings: number | null }
>;

/** Legacy sheet rows used 0-based week index (w0 = UI “Week 1”). */
export function normalizeSalesPerformanceWeekKey(weekKey: string): string {
  const k = String(weekKey || '').trim();
  if (/^w0$/i.test(k)) return 'w1';
  return k;
}

export function rowToPlannedMapEntry(row: Record<string, unknown>): {
  weekKey: string;
  salesperson: string;
  leads: number | null;
  meetings: number | null;
} | null {
  const weekRaw = pickPlannedSheetField(row, 'week_key');
  const spRaw = pickPlannedSheetField(row, 'salesperson');
  const weekKey = normalizeSalesPerformanceWeekKey(String(weekRaw ?? '').trim());
  const salesperson = salespersonLabel(spRaw);
  if (!weekKey || !salesperson) return null;
  return {
    weekKey,
    salesperson,
    leads: parsePlannedNum(pickPlannedSheetField(row, 'planned_leads')),
    meetings: parsePlannedNum(pickPlannedSheetField(row, 'planned_meetings')),
  };
}

export function plannedRowsToMap(rows: any[]): SalesPerformancePlannedMap {
  const map: SalesPerformancePlannedMap = {};
  for (const r of rows) {
    const entry = rowToPlannedMapEntry(r as Record<string, unknown>);
    if (!entry) continue;
    const key = plannedCellKey(entry.weekKey, entry.salesperson);
    map[key] = {
      leads: entry.leads,
      meetings: entry.meetings,
    };
  }
  return map;
}

export function extractPlannedEditsFromWeeks(weeks: SalesPerformanceWeek[]): Record<
  string,
  { plannedLeads: number | null; plannedMeetings: number | null }
> {
  const out: Record<string, { plannedLeads: number | null; plannedMeetings: number | null }> = {};
  for (const week of weeks) {
    for (const row of week.rows) {
      if (row.isTotal) continue;
      out[plannedCellKey(week.weekKey, row.salesperson)] = {
        plannedLeads: row.metrics.leads.planned,
        plannedMeetings: row.metrics.meetings.planned,
      };
    }
  }
  return out;
}

export function applyPlannedMapToSalesPerformance(
  result: SalesPerformanceBuildResult,
  planned: SalesPerformancePlannedMap
): SalesPerformanceBuildResult {
  const weeks = result.weeks.map((week) => {
    let sumLeads = 0;
    let sumMeetings = 0;
    let hasLeads = false;
    let hasMeetings = false;

    const rows = week.rows.map((row) => {
      if (row.isTotal) return row;
      const p = planned[plannedCellKey(week.weekKey, row.salesperson)] ?? planned[plannedCellKey(week.weekKey, salespersonLabel(row.salesperson))];
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
          meetings: { ...row.metrics.meetings, planned: meetingsPlanned },
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
          meetings: { ...total.metrics.meetings, planned: hasMeetings ? sumMeetings : null },
        },
      };
    }

    return { ...week, rows };
  });

  return {
    ...result,
    weeks,
    flatRows: weeks.flatMap((w) => w.rows),
  };
}

export function applyPlannedEditsToWeeks(
  weeks: SalesPerformanceWeek[],
  edits: Record<string, { plannedLeads?: number | null; plannedMeetings?: number | null }>
): SalesPerformanceWeek[] {
  const map: SalesPerformancePlannedMap = {};
  for (const week of weeks) {
    for (const row of week.rows) {
      if (row.isTotal) continue;
      const key = plannedCellKey(week.weekKey, row.salesperson);
      const edit = edits[key];
      map[key] = {
        leads: edit?.plannedLeads !== undefined ? edit.plannedLeads : row.metrics.leads.planned,
        meetings:
          edit?.plannedMeetings !== undefined ? edit.plannedMeetings : row.metrics.meetings.planned,
      };
    }
  }
  const merged = applyPlannedMapToSalesPerformance(
    {
      monthLabel: '',
      weeks,
      flatRows: [],
      salespeople: [],
      weekOptions: [],
      kpiSummary: {
        leads: 0,
        meetings: 0,
        conversion_ratio: 0,
        revenue: 0,
        costing: 0,
        profit: 0,
      },
      chartSeries: [],
    },
    map
  );
  return merged.weeks;
}

export function formatSalesPerformancePlanned(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return String(Math.round(value));
}