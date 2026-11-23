import { parseSheetDate } from '@/lib/dateUtils';
import {
  DASHBOARD_SECTION_TOTAL_LABEL,
  crmClientKey,
  crmCreatedIso,
  crmInRange,
  crmRevenueOf,
  crmWonIso,
} from '@/lib/crmPipelineDashboard';
import { buildMonthWeekBuckets, salespersonLabel } from '@/lib/crmPipelineFiveForThree';
import {
  crmCostingOf,
  filterOpportunitiesByStatus,
  type SalesPerformanceClipRange,
  type SalesPerformanceMetricKey,
  type SalesPerformanceStatusFilter,
} from '@/lib/crmPipelineSalesPerformance';

export type SalesPerformanceInspectMetric = Exclude<
  SalesPerformanceMetricKey,
  'conversion_ratio'
> | 'conversion_ratio';

export type SalesPerformanceInspectOppContact = {
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  salesperson: string;
};

export type SalesPerformanceInspectLeadItem = SalesPerformanceInspectOppContact & {
  kind: 'lead';
  opportunityId: string;
  createdAt: string | null;
  createdAtDisplay: string;
  stage: string;
  outcome: string;
};

export type SalesPerformanceInspectMeetingItem = SalesPerformanceInspectOppContact & {
  kind: 'meeting';
  activityId: string;
  opportunityId: string;
  activityType: string;
  doneAt: string | null;
  doneAtDisplay: string;
};

export type SalesPerformanceInspectWonItem = SalesPerformanceInspectOppContact & {
  kind: 'won';
  opportunityId: string;
  wonAt: string | null;
  wonAtDisplay: string;
  revenue: number;
  costing: number;
  profit: number;
};

export type SalesPerformanceInspectItem =
  | SalesPerformanceInspectLeadItem
  | SalesPerformanceInspectMeetingItem
  | SalesPerformanceInspectWonItem;

export type SalesPerformanceInspectResult = {
  metric: SalesPerformanceInspectMetric;
  weekKey: string;
  weekLabel: string;
  salesperson: string;
  isTotalRow: boolean;
  statusFilter: SalesPerformanceStatusFilter;
  clipLabel: string | null;
  effectiveRangeDisplay: string;
  dateSourceField: string;
  dateSourceHelp: string;
  totalAmount: number | null;
  items: SalesPerformanceInspectItem[];
  conversionMeetings?: SalesPerformanceInspectMeetingItem[];
  conversionWonClients?: SalesPerformanceInspectWonItem[];
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

function oppMatchesStatus(opp: any, status: SalesPerformanceStatusFilter): boolean {
  if (status === 'all') return true;
  const o = String(opp.outcome || 'open').toLowerCase();
  return o === status;
}

function bucketRangeForClip(
  bucketStart: number,
  bucketEnd: number,
  clip?: SalesPerformanceClipRange
): { start: number; end: number } | null {
  if (!clip) return { start: bucketStart, end: bucketEnd };
  const start = Math.max(bucketStart, clip.startMs);
  const end = Math.min(bucketEnd, clip.endMs);
  if (end < start) return null;
  return { start, end };
}

function crmInEffectiveRange(iso: string | null | undefined, range: { start: number; end: number }): boolean {
  return crmInRange(iso ?? null, range.start, range.end);
}

function formatDisplayIso(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso);
  if (!Number.isFinite(t.getTime())) return '—';
  return t.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

function formatRangeMs(start: number, end: number): string {
  const endInclusive = end - 1;
  const a = new Date(start).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
  const b = new Date(endInclusive).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
  return `${a} → ${b}`;
}

function weekDefForKey(yearMonth: string, weekKey: string) {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m) return null;
  const defs = buildMonthWeekBuckets(y, m - 1);
  const num = weekKey.replace(/^w/i, '');
  const byIndex = Number(num);
  if (byIndex >= 1 && byIndex <= defs.length) return defs[byIndex - 1];
  return defs.find((d) => {
    const wm = d.label.match(/^Week\s+(\d+)/i);
    return wm && wm[1] === num;
  });
}

function oppContactFromOpp(opp: any, salesperson: string): SalesPerformanceInspectOppContact {
  const dealName = String(opp.name || '').trim();
  const company = String(opp.company || '').trim();
  return {
    name: dealName || company || '—',
    contact_name: String(opp.contact_name || '').trim() || '—',
    email: String(opp.email || '').trim() || '—',
    phone: String(opp.phone || '').trim() || '—',
    salesperson,
  };
}

function salespersonMatches(label: string, filter: string, isTotalRow: boolean): boolean {
  if (isTotalRow || filter === DASHBOARD_SECTION_TOTAL_LABEL) return true;
  return label === filter;
}

export type BuildSalesPerformanceInspectParams = {
  opportunities: any[];
  activities: any[];
  wonDatesByOppId: Record<string, string>;
  yearMonth: string;
  weekKey: string;
  salesperson: string;
  isTotalRow: boolean;
  metric: SalesPerformanceInspectMetric;
  statusFilter?: SalesPerformanceStatusFilter;
  clipRange?: SalesPerformanceClipRange;
};

export function buildSalesPerformanceInspect(
  params: BuildSalesPerformanceInspectParams
): SalesPerformanceInspectResult | null {
  const statusFilter = params.statusFilter ?? 'all';
  const opportunities = filterOpportunitiesByStatus(params.opportunities, statusFilter);
  const { activities, wonDatesByOppId, yearMonth, weekKey, salesperson, isTotalRow, metric, clipRange } =
    params;

  const weekDef = weekDefForKey(yearMonth, weekKey);
  if (!weekDef) return null;

  const effective = bucketRangeForClip(weekDef.start, weekDef.end, clipRange);
  if (!effective) {
    return {
      metric,
      weekKey,
      weekLabel: weekDef.label,
      salesperson,
      isTotalRow,
      statusFilter,
      clipLabel: clipRange?.label ?? null,
      effectiveRangeDisplay: 'No overlap with selected quick range',
      dateSourceField: '—',
      dateSourceHelp: 'This week does not overlap the active date filter.',
      totalAmount: metric === 'revenue' || metric === 'costing' || metric === 'profit' ? 0 : null,
      items: [],
    };
  }

  const oppById = new Map<string, any>();
  for (const o of opportunities) oppById.set(String(o.id), o);

  const rangeDisplay = clipRange
    ? `${clipRange.label ?? 'Custom range'} · ${formatRangeMs(effective.start, effective.end)}`
    : formatRangeMs(effective.start, effective.end);

  const base = {
    weekKey,
    weekLabel: weekDef.label,
    salesperson,
    isTotalRow,
    statusFilter,
    clipLabel: clipRange?.label ?? null,
    effectiveRangeDisplay: rangeDisplay,
  };

  if (metric === 'leads') {
    const items: SalesPerformanceInspectLeadItem[] = [];
    for (const o of opportunities) {
      const sp = salespersonLabel(o.salesperson);
      if (!salespersonMatches(sp, salesperson, isTotalRow)) continue;
      const created = crmCreatedIso(o);
      if (!crmInEffectiveRange(created, effective)) continue;
      items.push({
        kind: 'lead',
        ...oppContactFromOpp(o, sp),
        opportunityId: String(o.id),
        createdAt: created,
        createdAtDisplay: formatDisplayIso(created),
        stage: String(o.stage || '').trim() || '—',
        outcome: String(o.outcome || 'open').trim(),
      });
    }
    items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return {
      ...base,
      metric,
      dateSourceField: 'Opportunity created_at',
      dateSourceHelp: 'Each row is counted when created_at falls inside the filtered window and CRM week bucket.',
      totalAmount: items.length,
      items,
    };
  }

  if (metric === 'meetings') {
    const items: SalesPerformanceInspectMeetingItem[] = [];
    const seen = new Set<string>();
    for (const act of activities) {
      if (!isCompletedFollowUp(act)) continue;
      const at = activityDoneAt(act);
      if (!crmInEffectiveRange(at, effective)) continue;
      const opp = oppById.get(String(act.opportunity_id));
      if (!opp) continue;
      if (!oppMatchesStatus(opp, statusFilter)) continue;
      const sp = salespersonLabel(opp.salesperson);
      if (!salespersonMatches(sp, salesperson, isTotalRow)) continue;
      const partyKey = `${sp}|${crmClientKey(opp)}`;
      if (seen.has(partyKey)) continue;
      seen.add(partyKey);
      items.push({
        kind: 'meeting',
        ...oppContactFromOpp(opp, sp),
        activityId: String(act.id),
        opportunityId: String(opp.id),
        activityType: String(act.activity_type || '').trim() || 'activity',
        doneAt: at,
        doneAtDisplay: formatDisplayIso(at),
      });
    }
    items.sort((a, b) => String(b.doneAt || '').localeCompare(String(a.doneAt || '')));
    return {
      ...base,
      metric,
      dateSourceField: 'Activity done_at',
      dateSourceHelp:
        'Unique meetings = one count per salesperson + client (company or contact). Completed todo / email / call / meeting activities only.',
      totalAmount: items.length,
      items,
    };
  }

  const wonItems: SalesPerformanceInspectWonItem[] = [];
  const uniqueClientWon: SalesPerformanceInspectWonItem[] = [];
  const clientKeys = new Set<string>();
  for (const o of opportunities) {
    const sp = salespersonLabel(o.salesperson);
    if (!salespersonMatches(sp, salesperson, isTotalRow)) continue;
    const won = crmWonIso(o, wonDatesByOppId);
    if (String(o.outcome || '').toLowerCase() !== 'won' || !crmInEffectiveRange(won, effective)) continue;
    const key = crmClientKey(o);
    const revenue = crmRevenueOf(o);
    const costing = crmCostingOf(o);
    const row: SalesPerformanceInspectWonItem = {
      kind: 'won',
      ...oppContactFromOpp(o, sp),
      opportunityId: String(o.id),
      wonAt: won,
      wonAtDisplay: formatDisplayIso(won),
      revenue,
      costing,
      profit: revenue - costing,
    };
    wonItems.push(row);
    if (!clientKeys.has(key)) {
      clientKeys.add(key);
      uniqueClientWon.push(row);
    }
  }
  wonItems.sort((a, b) => String(b.wonAt || '').localeCompare(String(a.wonAt || '')));
  uniqueClientWon.sort((a, b) => String(b.wonAt || '').localeCompare(String(a.wonAt || '')));

  if (metric === 'revenue' || metric === 'costing' || metric === 'profit') {
    const total =
      metric === 'revenue'
        ? wonItems.reduce((s, i) => s + i.revenue, 0)
        : metric === 'costing'
          ? wonItems.reduce((s, i) => s + i.costing, 0)
          : wonItems.reduce((s, i) => s + i.profit, 0);
    const help =
      metric === 'revenue'
        ? 'Sum of expected_revenue on won opportunities in the window.'
        : metric === 'costing'
          ? 'Sum of costing field on the same won opportunities.'
          : 'Revenue minus costing for each won row (totals match the table).';
    return {
      ...base,
      metric,
      dateSourceField: 'Won date (outcome history or updated_at)',
      dateSourceHelp: help,
      totalAmount: total,
      items: wonItems,
    };
  }

  if (metric === 'conversion_ratio') {
    const meetingItems: SalesPerformanceInspectMeetingItem[] = [];
    const meetSeen = new Set<string>();
    for (const act of activities) {
      if (!isCompletedFollowUp(act)) continue;
      const at = activityDoneAt(act);
      if (!crmInEffectiveRange(at, effective)) continue;
      const opp = oppById.get(String(act.opportunity_id));
      if (!opp) continue;
      if (!oppMatchesStatus(opp, statusFilter)) continue;
      const sp = salespersonLabel(opp.salesperson);
      if (!salespersonMatches(sp, salesperson, isTotalRow)) continue;
      const partyKey = `${sp}|${crmClientKey(opp)}`;
      if (meetSeen.has(partyKey)) continue;
      meetSeen.add(partyKey);
      meetingItems.push({
        kind: 'meeting',
        ...oppContactFromOpp(opp, sp),
        activityId: String(act.id),
        opportunityId: String(opp.id),
        activityType: String(act.activity_type || '').trim() || 'activity',
        doneAt: at,
        doneAtDisplay: formatDisplayIso(at),
      });
    }
    const meetings = meetingItems.length;
    const clients = uniqueClientWon.length;
    const ratio = meetings > 0 ? (clients / meetings) * 100 : 0;
    return {
      ...base,
      metric,
      dateSourceField: 'Meetings: done_at · Clients won: won date',
      dateSourceHelp: `Conversion = unique clients won ÷ unique meetings = ${clients} ÷ ${meetings} = ${ratio.toFixed(1)}%.`,
      totalAmount: ratio,
      items: [],
      conversionMeetings: meetingItems,
      conversionWonClients: uniqueClientWon,
    };
  }

  return null;
}

export const SALES_PERFORMANCE_INSPECT_METRIC_LABELS: Record<SalesPerformanceInspectMetric, string> = {
  leads: 'Leads (actual)',
  meetings: 'Meetings (actual)',
  conversion_ratio: 'Conversion ratio',
  revenue: 'Revenue',
  costing: 'Costing',
  profit: 'Profit',
};