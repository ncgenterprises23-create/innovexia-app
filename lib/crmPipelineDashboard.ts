import { parseSheetDate } from '@/lib/dateUtils';

export type DashboardGranularity = 'month' | 'quarter' | 'year';
export type DashboardSectionKey = 'nbd' | 'crr' | 'total';

export type DashboardMetricKey =
  | 'unique_clients'
  | 'conversion_ratio'
  | 'avg_sale'
  | 'transactions'
  | 'revenue'
  | 'margin'
  | 'profit';

export const DASHBOARD_METRIC_LABELS: Record<DashboardMetricKey, string> = {
  unique_clients: 'No. of Unique Clients',
  conversion_ratio: 'Conversion Ratio',
  avg_sale: 'Average RS Sale',
  transactions: 'No of Transaction',
  revenue: 'Revenue',
  margin: 'Margin',
  profit: 'Profit',
};

export const DASHBOARD_METRIC_ORDER: DashboardMetricKey[] = [
  'unique_clients',
  'conversion_ratio',
  'avg_sale',
  'transactions',
  'revenue',
  'margin',
  'profit',
];

export type TimeColumn = { key: string; label: string };

export type DashboardTableRow = {
  metric: DashboardMetricKey;
  metricLabel: string;
  tag: string;
  isSectionTotal: boolean;
  values: Record<string, number | null>;
};

export type DashboardSectionResult = {
  key: DashboardSectionKey;
  title: string;
  rows: DashboardTableRow[];
};

export type DashboardComparisonRow = {
  metric: DashboardMetricKey;
  metricLabel: string;
  values: Record<string, number | null>;
};

export type BuildDashboardParams = {
  opportunities: any[];
  wonDatesByOppId: Record<string, string>;
  from: Date;
  to: Date;
  granularity: DashboardGranularity;
  marginPct: number;
  profitPct: number;
  includeQAvg?: boolean;
};

export type DashboardBuildResult = {
  columns: TimeColumn[];
  sections: DashboardSectionResult[];
};

const UNTAGGED = '(Untagged)';
const ALL_TAG = 'All';
/** Shown in Category / Tags for the pipeline-wide total row (not double-counted by tag). */
export const DASHBOARD_SECTION_TOTAL_LABEL = 'Total';

export function parseCrmLeadTags(tags?: string): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(tags).split(',')) {
    const t = part.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function crmClientKey(opp: any): string {
  const company = String(opp.company || '').trim();
  if (company) return `co:${company.toLowerCase()}`;
  const contact = String(opp.contact_name || '').trim();
  if (contact) return `cn:${contact.toLowerCase()}`;
  return `id:${String(opp.id)}`;
}

export function crmRevenueOf(opp: any): number {
  const n = Number(opp.expected_revenue);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function crmIsoTime(iso: string | null | undefined): number {
  if (!iso) return NaN;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

export function crmCreatedIso(opp: any): string | null {
  return parseSheetDate(opp.created_at);
}

export function crmWonIso(opp: any, wonMap: Record<string, string>): string | null {
  const id = String(opp.id);
  if (wonMap[id]) return wonMap[id];
  if (String(opp.outcome || '').toLowerCase() === 'won') {
    return parseSheetDate(opp.updated_at) || parseSheetDate(opp.created_at);
  }
  return null;
}

export function crmInRange(iso: string | null, start: number, end: number): boolean {
  const t = crmIsoTime(iso);
  if (!Number.isFinite(t)) return false;
  return t >= start && t < end;
}

function startOfQuarter(d: Date): Date {
  const x = new Date(d);
  const q = Math.floor(x.getMonth() / 3);
  x.setMonth(q * 3, 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function presetRangeLabel(
  granularity: DashboardGranularity,
  presetCount: number
): string {
  const n = presetCount === 1 ? 1 : presetCount === 6 ? 6 : 3;
  const unit =
    granularity === 'month' ? 'month' : granularity === 'quarter' ? 'quarter' : 'year';
  const plural = n === 1 ? unit : `${unit}s`;
  return `Last ${n} ${plural}`;
}

export function parseDashboardRange(
  fromParam?: string | null,
  toParam?: string | null,
  presetCount = 3,
  granularity: DashboardGranularity = 'month'
): { from: Date; to: Date } {
  const to = toParam ? new Date(toParam) : new Date();
  if (Number.isNaN(to.getTime())) to.setTime(Date.now());
  let from: Date;
  if (fromParam) {
    from = new Date(fromParam);
    if (Number.isNaN(from.getTime())) {
      from = new Date(to);
      from.setMonth(from.getMonth() - presetCount);
    }
  } else {
    const count = presetCount === 1 || presetCount === 6 ? presetCount : 3;
    if (granularity === 'quarter') {
      from = startOfQuarter(to);
      from.setMonth(from.getMonth() - (count - 1) * 3);
    } else if (granularity === 'year') {
      from = new Date(to.getFullYear() - count + 1, 0, 1);
    } else {
      from = new Date(to);
      from.setMonth(from.getMonth() - count);
      from.setDate(1);
    }
  }
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function monthLabel(d: Date): string {
  const mon = d.toLocaleString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' });
  const yr = d.toLocaleString('en-IN', { year: '2-digit', timeZone: 'Asia/Kolkata' });
  return `${mon} ${yr}`;
}

function quarterLabel(d: Date): string {
  const m = d.getMonth();
  const q = Math.floor(m / 3) + 1;
  const yr = d.getFullYear() % 100;
  return `Q${q} ${String(yr).padStart(2, '0')}`;
}

function yearLabel(d: Date): string {
  return String(d.getFullYear());
}

export function buildTimeColumns(
  from: Date,
  to: Date,
  granularity: DashboardGranularity,
  includeQAvg: boolean
): { columns: TimeColumn[]; bucketMeta: Record<string, { start: number; end: number }> } {
  const columns: TimeColumn[] = [];
  const bucketMeta: Record<string, { start: number; end: number }> = {};

  const start = new Date(from);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  if (granularity === 'month') {
    const cursor = new Date(start);
    while (cursor.getTime() <= to.getTime()) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const bucketStart = new Date(y, m, 1).getTime();
      const bucketEnd = new Date(y, m + 1, 1).getTime();
      columns.push({ key, label: monthLabel(cursor) });
      bucketMeta[key] = { start: bucketStart, end: bucketEnd };
      cursor.setMonth(cursor.getMonth() + 1);
    }
    if (includeQAvg && columns.length >= 2) {
      columns.push({ key: 'q_avg', label: 'Q Avg' });
    }
    return { columns, bucketMeta };
  }

  if (granularity === 'quarter') {
    const cursor = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1);
    while (cursor.getTime() <= to.getTime()) {
      const y = cursor.getFullYear();
      const q = Math.floor(cursor.getMonth() / 3);
      const key = `${y}-Q${q + 1}`;
      const bucketStart = new Date(y, q * 3, 1).getTime();
      const bucketEnd = new Date(y, q * 3 + 3, 1).getTime();
      columns.push({ key, label: quarterLabel(cursor) });
      bucketMeta[key] = { start: bucketStart, end: bucketEnd };
      cursor.setMonth(cursor.getMonth() + 3);
    }
    return { columns, bucketMeta };
  }

  const cursor = new Date(start.getFullYear(), 0, 1);
  while (cursor.getFullYear() <= to.getFullYear()) {
    const y = cursor.getFullYear();
    const key = `${y}`;
    const bucketStart = new Date(y, 0, 1).getTime();
    const bucketEnd = new Date(y + 1, 0, 1).getTime();
    columns.push({ key, label: yearLabel(cursor) });
    bucketMeta[key] = { start: bucketStart, end: bucketEnd };
    cursor.setFullYear(cursor.getFullYear() + 1);
  }
  return { columns, bucketMeta };
}

function sectionQualifies(opp: any, section: DashboardSectionKey): boolean {
  const tags = parseCrmLeadTags(opp.tags).map((t) => t.toLowerCase());
  if (section === 'nbd') {
    return tags.some((t) => t === 'nbd' || t === 'nbd incoming');
  }
  if (section === 'crr') {
    return tags.includes('crr');
  }
  return true;
}

function collectTagLabels(opps: any[]): string[] {
  const set = new Set<string>();
  let untagged = false;
  for (const o of opps) {
    const tags = parseCrmLeadTags(o.tags);
    if (tags.length === 0) untagged = true;
    else tags.forEach((t) => set.add(t));
  }
  const list = [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  if (untagged) list.push(UNTAGGED);
  return list;
}

function oppMatchesTag(opp: any, tag: string): boolean {
  if (tag === ALL_TAG) return true;
  if (tag === UNTAGGED) return parseCrmLeadTags(opp.tags).length === 0;
  const want = tag.toLowerCase();
  return parseCrmLeadTags(opp.tags).some((t) => t.toLowerCase() === want);
}

function filterOpps(opps: any[], section: DashboardSectionKey, tag: string): any[] {
  return opps.filter((o) => sectionQualifies(o, section) && oppMatchesTag(o, tag));
}

type BucketNums = {
  uniqueClients: number;
  leadsCreated: number;
  wins: number;
  transactions: number;
  revenue: number;
};

function computeBucketMetrics(
  opps: any[],
  wonMap: Record<string, string>,
  bucketStart: number,
  bucketEnd: number
): BucketNums {
  const clients = new Set<string>();
  let leadsCreated = 0;
  let wins = 0;
  let transactions = 0;
  let revenue = 0;

  for (const o of opps) {
    const created = crmCreatedIso(o);
    if (crmInRange(created, bucketStart, bucketEnd)) {
      leadsCreated += 1;
      clients.add(crmClientKey(o));
    }
    const won = crmWonIso(o, wonMap);
    if (String(o.outcome || '').toLowerCase() === 'won' && crmInRange(won, bucketStart, bucketEnd)) {
      wins += 1;
      transactions += 1;
      revenue += crmRevenueOf(o);
    }
  }

  return {
    uniqueClients: clients.size,
    leadsCreated,
    wins,
    transactions,
    revenue,
  };
}

function metricValue(
  metric: DashboardMetricKey,
  m: BucketNums,
  marginPct: number,
  profitPct: number
): number | null {
  switch (metric) {
    case 'unique_clients':
      return m.uniqueClients;
    case 'transactions':
      return m.transactions;
    case 'revenue':
      return m.revenue;
    case 'margin':
      return (m.revenue * marginPct) / 100;
    case 'profit':
      return (m.revenue * profitPct) / 100;
    case 'avg_sale':
      return m.transactions > 0 ? m.revenue / m.transactions : 0;
    case 'conversion_ratio':
      return m.leadsCreated > 0 ? (m.wins / m.leadsCreated) * 100 : 0;
    default:
      return null;
  }
}

function averageMetricAcrossKeys(
  values: Record<string, number | null>,
  keys: string[],
  metric: DashboardMetricKey
): number | null {
  const nums = keys.map((k) => values[k]).filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return null;
  if (metric === 'conversion_ratio' || metric === 'avg_sale') {
    const sum = nums.reduce((a, b) => a + b, 0);
    return sum / nums.length;
  }
  const sum = nums.reduce((a, b) => a + b, 0);
  return sum / nums.length;
}

function buildSection(
  section: DashboardSectionKey,
  title: string,
  allOpps: any[],
  wonMap: Record<string, string>,
  columns: TimeColumn[],
  bucketMeta: Record<string, { start: number; end: number }>,
  marginPct: number,
  profitPct: number
): DashboardSectionResult {
  const sectionOpps = allOpps.filter((o) => sectionQualifies(o, section));
  const tagLabels = collectTagLabels(sectionOpps);
  const tagDimension = [ALL_TAG, ...tagLabels];
  const rows: DashboardTableRow[] = [];

  const monthKeys = columns.filter((c) => c.key !== 'q_avg').map((c) => c.key);

  for (const metric of DASHBOARD_METRIC_ORDER) {
    for (const tag of tagDimension) {
      const subset = filterOpps(allOpps, section, tag);
      const values: Record<string, number | null> = {};
      for (const col of columns) {
        if (col.key === 'q_avg') continue;
        const meta = bucketMeta[col.key];
        if (!meta) {
          values[col.key] = null;
          continue;
        }
        const bucket = computeBucketMetrics(subset, wonMap, meta.start, meta.end);
        values[col.key] = metricValue(metric, bucket, marginPct, profitPct);
      }
      if (columns.some((c) => c.key === 'q_avg')) {
        values.q_avg = averageMetricAcrossKeys(values, monthKeys, metric);
      }
      const isSectionTotal = tag === ALL_TAG;
      rows.push({
        metric,
        metricLabel: DASHBOARD_METRIC_LABELS[metric],
        tag: isSectionTotal ? DASHBOARD_SECTION_TOTAL_LABEL : tag,
        isSectionTotal,
        values,
      });
    }
  }

  return { key: section, title, rows };
}

export function buildCrmPipelineDashboard(params: BuildDashboardParams): DashboardBuildResult {
  const {
    opportunities,
    wonDatesByOppId,
    from,
    to,
    granularity,
    marginPct,
    profitPct,
    includeQAvg = granularity === 'month',
  } = params;

  const { columns, bucketMeta } = buildTimeColumns(from, to, granularity, includeQAvg);

  const sections: DashboardSectionResult[] = [
    buildSection('total', 'CRM Pipeline', opportunities, wonDatesByOppId, columns, bucketMeta, marginPct, profitPct),
  ];

  return { columns, sections };
}

export type PipelineComparisonResult = {
  pipelines: { id: string; name: string }[];
  rows: DashboardComparisonRow[];
};

/** One metric value per pipeline across the full selected date range (TOTAL / All). */
export function buildPipelineComparison(
  pipelines: { id: string; name: string; opportunities: any[]; wonDatesByOppId: Record<string, string> }[],
  rangeStart: number,
  rangeEnd: number,
  marginPct: number,
  profitPct: number
): PipelineComparisonResult {
  const rows: DashboardComparisonRow[] = [];
  const list = pipelines.map((p) => ({ id: p.id, name: p.name }));

  for (const metric of DASHBOARD_METRIC_ORDER) {
    const values: Record<string, number | null> = {};
    for (const p of pipelines) {
      const subset = p.opportunities;
      const bucket = computeBucketMetrics(subset, p.wonDatesByOppId, rangeStart, rangeEnd);
      values[p.id] = metricValue(metric, bucket, marginPct, profitPct);
    }
    rows.push({
      metric,
      metricLabel: DASHBOARD_METRIC_LABELS[metric],
      values,
    });
  }

  return { pipelines: list, rows };
}

export function formatDashboardCell(
  metric: DashboardMetricKey,
  value: number | null | undefined
): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (metric === 'conversion_ratio') return `${value.toFixed(1)}%`;
  if (metric === 'unique_clients' || metric === 'transactions') return String(Math.round(value));
  if (metric === 'revenue' || metric === 'margin' || metric === 'profit' || metric === 'avg_sale') {
    return value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }
  return String(value);
}