import {
  type SalesPerformanceInspectItem,
  type SalesPerformanceInspectMeetingItem,
  type SalesPerformanceInspectResult,
  type SalesPerformanceInspectWonItem,
} from '@/lib/crmPipelineSalesPerformanceInspect';

function csvEscape(v: string): string {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToLine(cells: string[]): string {
  return cells.map(csvEscape).join(',');
}

export function inspectItemSearchText(item: SalesPerformanceInspectItem): string {
  const base = [item.name, item.contact_name, item.email, item.phone, item.salesperson].join(' ');
  if (item.kind === 'lead') {
    return `${base} ${item.opportunityId} ${item.stage} ${item.outcome} ${item.createdAtDisplay}`;
  }
  if (item.kind === 'meeting') {
    return `${base} ${item.opportunityId} ${item.activityId} ${item.activityType} ${item.doneAtDisplay}`;
  }
  return `${base} ${item.opportunityId} ${item.wonAtDisplay} ${item.revenue} ${item.costing} ${item.profit}`;
}

export function matchesInspectSearch(item: SalesPerformanceInspectItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return inspectItemSearchText(item).toLowerCase().includes(q);
}

export function filterInspectItems(
  items: SalesPerformanceInspectItem[],
  query: string
): SalesPerformanceInspectItem[] {
  return items.filter((i) => matchesInspectSearch(i, query));
}

export function filterInspectMeetings(
  items: SalesPerformanceInspectMeetingItem[] | undefined,
  query: string
): SalesPerformanceInspectMeetingItem[] {
  if (!items) return [];
  return items.filter((i) => matchesInspectSearch(i, query));
}

export function filterInspectWon(
  items: SalesPerformanceInspectWonItem[] | undefined,
  query: string
): SalesPerformanceInspectWonItem[] {
  if (!items) return [];
  return items.filter((i) => matchesInspectSearch(i, query));
}

function slug(s: string): string {
  return s.replace(/[^\w-]+/g, '_').slice(0, 40);
}

export function downloadSalesPerformanceInspectCsv(
  data: SalesPerformanceInspectResult,
  opts: {
    items: SalesPerformanceInspectItem[];
    meetings?: SalesPerformanceInspectMeetingItem[];
    wonClients?: SalesPerformanceInspectWonItem[];
  }
): void {
  const headers = [
    'record_type',
    'opportunity_id',
    'name',
    'contact_name',
    'email',
    'phone',
    'salesperson',
    'date_at',
    'extra',
    'revenue',
    'costing',
    'profit',
  ];
  const rows: string[][] = [];

  for (const item of opts.items) {
    if (item.kind === 'lead') {
      rows.push([
        'lead',
        item.opportunityId,
        item.name,
        item.contact_name,
        item.email,
        item.phone,
        item.salesperson,
        item.createdAtDisplay,
        `${item.stage}; ${item.outcome}`,
        '',
        '',
        '',
      ]);
    } else if (item.kind === 'meeting') {
      rows.push([
        'meeting',
        item.opportunityId,
        item.name,
        item.contact_name,
        item.email,
        item.phone,
        item.salesperson,
        item.doneAtDisplay,
        item.activityType,
        '',
        '',
        '',
      ]);
    } else {
      rows.push([
        'won',
        item.opportunityId,
        item.name,
        item.contact_name,
        item.email,
        item.phone,
        item.salesperson,
        item.wonAtDisplay,
        '',
        String(item.revenue),
        String(item.costing),
        String(item.profit),
      ]);
    }
  }

  for (const m of opts.meetings ?? []) {
    rows.push([
      'meeting_conversion',
      m.opportunityId,
      m.name,
      m.contact_name,
      m.email,
      m.phone,
      m.salesperson,
      m.doneAtDisplay,
      m.activityType,
      '',
      '',
      '',
    ]);
  }
  for (const w of opts.wonClients ?? []) {
    rows.push([
      'won_client_conversion',
      w.opportunityId,
      w.name,
      w.contact_name,
      w.email,
      w.phone,
      w.salesperson,
      w.wonAtDisplay,
      '',
      String(w.revenue),
      String(w.costing),
      String(w.profit),
    ]);
  }

  const content = `\uFEFF${[rowToLine(headers), ...rows.map(rowToLine)].join('\r\n')}`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `sales_performance_${slug(data.metric)}_${slug(data.salesperson)}_${stamp}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}