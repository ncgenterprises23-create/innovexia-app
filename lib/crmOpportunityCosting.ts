/** Line items saved on CRM opportunities (JSON in costing_items column). */

export type CrmOpportunityCostingLine = {
  item_name: string;
  item_code?: string;
  qty: number;
  unit_price: number;
};

export function parseCrmOpportunityCostingItems(raw: unknown): CrmOpportunityCostingLine[] {
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) return normalizeLines(raw);
  const s = String(raw).trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s) as unknown;
    if (Array.isArray(parsed)) return normalizeLines(parsed);
  } catch {
  }
  return [];
}

function normalizeLines(rows: unknown[]): CrmOpportunityCostingLine[] {
  const out: CrmOpportunityCostingLine[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const item_name = String(r.item_name || '').trim();
    if (!item_name) continue;
    const qty = Number(r.qty);
    const unit_price = Number(r.unit_price);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (!Number.isFinite(unit_price) || unit_price < 0) continue;
    out.push({
      item_name,
      item_code: r.item_code != null ? String(r.item_code).trim() : undefined,
      qty,
      unit_price,
    });
  }
  return out;
}

export function stringifyCrmOpportunityCostingItems(lines: CrmOpportunityCostingLine[]): string {
  if (lines.length === 0) return '';
  return JSON.stringify(lines);
}

export function totalCrmOpportunityCostingLines(lines: CrmOpportunityCostingLine[]): number {
  return lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
}

function formatInrTimeline(n: number): string {
  if (!Number.isFinite(n)) return '₹ 0';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

/** Human-readable costing lines for CRM timeline / activity log. */
export function formatCrmCostingItemsForTimeline(raw: unknown): string[] {
  const items = parseCrmOpportunityCostingItems(raw);
  if (items.length === 0) {
    const s = String(raw ?? '').trim();
    return s ? ['(no items)'] : ['(none)'];
  }
  const rows = items.map((l) => {
    const qty = l.qty > 1 ? ` × ${l.qty}` : '';
    return `• ${l.item_name} — ${formatInrTimeline(l.unit_price)}${qty}`;
  });
  const total = totalCrmOpportunityCostingLines(items);
  rows.push(`Total: ${formatInrTimeline(total)}`);
  return rows;
}

export function formatCrmCostingTotalTimeline(raw: unknown): string {
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return formatInrTimeline(n);
  return '—';
}

export function crmOpportunityCostingTotal(opp: { costing?: unknown; costing_items?: unknown }): number {
  const fromLines = totalCrmOpportunityCostingLines(parseCrmOpportunityCostingItems(opp.costing_items));
  if (fromLines > 0) return fromLines;
  const n = Number(opp.costing);
  return Number.isFinite(n) && n > 0 ? n : 0;
}