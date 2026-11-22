export type CrmOppFilterField =
  | 'salesperson'
  | 'stage'
  | 'company'
  | 'city'
  | 'state'
  | 'country'
  | 'tags'
  | 'contact_name'
  | 'priority'
  | 'expected_closing';

export type CrmBoardGroupBy = 'none' | 'salesperson' | 'stage' | 'company' | 'expected_closing';

export const CRM_OPP_FILTER_FIELDS: { key: CrmOppFilterField; label: string }[] = [
  { key: 'salesperson', label: 'Salesperson' },
  { key: 'stage', label: 'Stage' },
  { key: 'company', label: 'Company' },
  { key: 'contact_name', label: 'Contact' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'country', label: 'Country' },
  { key: 'tags', label: 'Tags' },
  { key: 'priority', label: 'Priority' },
  { key: 'expected_closing', label: 'Expected closing' },
];

export const CRM_BOARD_GROUP_BY: { key: CrmBoardGroupBy; label: string }[] = [
  { key: 'none', label: 'None (newest first)' },
  { key: 'salesperson', label: 'Salesperson' },
  { key: 'stage', label: 'Stage' },
  { key: 'company', label: 'Company' },
  { key: 'expected_closing', label: 'Expected closing' },
];

function parseTagList(tags?: string): string[] {
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

export function getOppFilterFieldValues(
  opp: Record<string, unknown>,
  field: CrmOppFilterField
): string[] {
  const str = (k: string) => String(opp[k] ?? '').trim();
  switch (field) {
    case 'salesperson':
      return [str('salesperson') || '(Unassigned)'];
    case 'stage':
      return [String(opp.stage_id ?? '')];
    case 'company':
      return [str('company') || '(No company)'];
    case 'contact_name':
      return [str('contact_name') || '(No contact)'];
    case 'city':
      return [str('city') || '(No city)'];
    case 'state':
      return [str('state') || '(No state)'];
    case 'country':
      return [str('country') || '(No country)'];
    case 'priority':
      return [str('priority') || '(No priority)'];
    case 'expected_closing':
      return [str('expected_closing') || '(No date)'];
    case 'tags': {
      const tags = parseTagList(str('tags'));
      return tags.length ? tags : ['(Untagged)'];
    }
    default:
      return [];
  }
}

export function displayValueForFilterField(
  field: CrmOppFilterField,
  raw: string,
  stageNameById: Record<string, string>
): string {
  if (field === 'stage') {
    return stageNameById[raw] || raw || '(Unknown stage)';
  }
  return raw || '—';
}

export function collectDistinctFilterValues(
  opps: Record<string, unknown>[],
  field: CrmOppFilterField,
  stageNameById: Record<string, string>
): { value: string; label: string }[] {
  const map = new Map<string, string>();
  for (const o of opps) {
    for (const v of getOppFilterFieldValues(o, field)) {
      const key = field === 'tags' ? v.toLowerCase() : v;
      if (!map.has(key)) {
        map.set(key, displayValueForFilterField(field, v, stageNameById));
      }
    }
  }
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}

export function opportunityMatchesFieldFilters(
  opp: Record<string, unknown>,
  filters: Partial<Record<CrmOppFilterField, string[]>>
): boolean {
  for (const field of CRM_OPP_FILTER_FIELDS) {
    const selected = filters[field.key];
    if (!selected?.length) continue;
    const want = new Set(selected.map((s) => s.toLowerCase()));
    const values = getOppFilterFieldValues(opp, field.key);
    const hit = values.some((v) => {
      if (field.key === 'stage') return selected.includes(String(v));
      return want.has(v.toLowerCase());
    });
    if (!hit) return false;
  }
  return true;
}

export function groupByLabelForOpp(
  opp: Record<string, unknown>,
  groupBy: CrmBoardGroupBy,
  stageNameById: Record<string, string>
): string {
  if (groupBy === 'none') return '';
  if (groupBy === 'stage') {
    return stageNameById[String(opp.stage_id)] || 'Stage';
  }
  if (groupBy === 'salesperson') {
    return String(opp.salesperson || '').trim() || '(Unassigned)';
  }
  if (groupBy === 'company') {
    return String(opp.company || '').trim() || '(No company)';
  }
  if (groupBy === 'expected_closing') {
    const d = String(opp.expected_closing || '').trim();
    if (!d) return '(No closing date)';
    return d.length >= 7 ? d.slice(0, 7) : d;
  }
  return '';
}

export function sortOppsForGroupBy<T extends Record<string, unknown>>(
  opps: T[],
  groupBy: CrmBoardGroupBy,
  stageNameById: Record<string, string>
): T[] {
  if (groupBy === 'none' || groupBy === 'stage') return opps;
  const copy = [...opps];
  copy.sort((a, b) => {
    const ga = groupByLabelForOpp(a, groupBy, stageNameById);
    const gb = groupByLabelForOpp(b, groupBy, stageNameById);
    const c = ga.localeCompare(gb, undefined, { sensitivity: 'base' });
    if (c !== 0) return c;
    const ta = new Date(String(a.updated_at || a.created_at || 0)).getTime();
    const tb = new Date(String(b.updated_at || b.created_at || 0)).getTime();
    return tb - ta;
  });
  return copy;
}

export type GroupedBoardRow<T> =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'opp'; key: string; opp: T };

export function buildGroupedBoardRows<T extends Record<string, unknown>>(
  opps: T[],
  groupBy: CrmBoardGroupBy,
  stageNameById: Record<string, string>
): GroupedBoardRow<T>[] {
  const effective = groupBy === 'stage' ? 'none' : groupBy;
  if (effective === 'none') {
    return opps.map((o) => ({ kind: 'opp', key: String(o.id), opp: o }));
  }
  const sorted = sortOppsForGroupBy(opps, effective, stageNameById);
  const rows: GroupedBoardRow<T>[] = [];
  let last = '';
  for (const o of sorted) {
    const label = groupByLabelForOpp(o, effective, stageNameById);
    if (label && label !== last) {
      rows.push({ kind: 'header', key: `h-${label}`, label });
      last = label;
    }
    rows.push({ kind: 'opp', key: String(o.id), opp: o });
  }
  return rows;
}