import { SPREADSHEET_IDS, getGoogleSheetsClient, rowToObject, objectToRow } from '@/lib/sheets';
import { formatToSheetDate } from '@/lib/dateUtils';
import { sheetColLetter, sheetNewId } from '@/lib/sheetColLetter';
import { compareBySequenceThenId } from '@/lib/crmPipelineStageSort';

export const CRM_PIPELINE_SHEETS = {
  PIPELINES: 'CRM Pipelines',
  STAGES: 'CRM Pipeline Stages',
  OPPORTUNITIES: 'CRM Opportunities',
  ACTIVITY_LOG: 'CRM Activity Log',
} as const;

const SPREADSHEET_ID = SPREADSHEET_IDS.CRM_PIPELINE;

const PIPELINE_HEADERS = [
  'id',
  'name',
  'sequence',
  'active',
  'created_at',
  'created_by',
  'owner_username',
];
const STAGE_HEADERS = ['id', 'pipeline_id', 'name', 'sequence', 'active', 'is_won', 'is_lost', 'created_at'];
const OPPORTUNITY_HEADERS = [
  'id', 'pipeline_id', 'stage_id', 'name', 'contact_name', 'email', 'phone', 'company',
  'expected_revenue', 'recurring_revenue', 'revenue_period', 'probability', 'priority', 'tags',
  'salesperson',
  'expected_closing',
  'notes',
  'extra_info',
  'city',
  'state',
  'country',
  'card_color',
  'outcome',
  'created_at',
  'updated_at',
  'created_by',
];
const ACTIVITY_HEADERS = [
  'id', 'opportunity_id', 'pipeline_id', 'event_type', 'summary', 'body', 'activity_type',
  'due_date', 'assigned_to', 'is_done', 'done_at', 'field_name', 'old_value', 'new_value',
  'user_id', 'user_name', 'created_at',
];

const ensuredKey = 'crm_pipeline_sheets_v2';
const spreadsheetMetaKey = 'crm_pipeline_spreadsheet_meta_v1';

type SheetDef = { title: string; headers: string[] };

const CRM_SHEET_DEFS: SheetDef[] = [
  { title: CRM_PIPELINE_SHEETS.PIPELINES, headers: PIPELINE_HEADERS },
  { title: CRM_PIPELINE_SHEETS.STAGES, headers: STAGE_HEADERS },
  { title: CRM_PIPELINE_SHEETS.OPPORTUNITIES, headers: OPPORTUNITY_HEADERS },
  { title: CRM_PIPELINE_SHEETS.ACTIVITY_LOG, headers: ACTIVITY_HEADERS },
];

let ensureInFlight: Promise<void> | null = null;

const PIPELINES_CACHE_MS = 20_000;
let pipelinesCache: { at: number; data: any[] } | null = null;

function invalidateCrmPipelinesCache(): void {
  pipelinesCache = null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSheetsQuotaError(error: unknown): boolean {
  const e = error as { code?: number; response?: { status?: number } };
  return e?.code === 429 || e?.response?.status === 429;
}

async function withSheetsRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (!isSheetsQuotaError(error) || i === attempts - 1) throw error;
      await sleep(600 * (i + 1));
    }
  }
  throw last;
}

async function getSpreadsheetMeta(sheets: any, refresh = false): Promise<any> {
  if (!refresh && (global as any)[spreadsheetMetaKey]) {
    return (global as any)[spreadsheetMetaKey];
  }
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  (global as any)[spreadsheetMetaKey] = spreadsheet;
  return spreadsheet;
}

function sheetIdByTitle(spreadsheet: any, title: string): number | undefined {
  const sheet = spreadsheet.data.sheets?.find((s: any) => s.properties?.title === title);
  return sheet?.properties?.sheetId;
}

function gridRowCount(spreadsheet: any, title: string): number {
  const sheet = spreadsheet.data.sheets?.find((s: any) => s.properties?.title === title);
  return sheet?.properties?.gridProperties?.rowCount ?? 1000;
}

async function ensureAllCrmPipelineSheets(sheets: any): Promise<void> {
  let spreadsheet = await getSpreadsheetMeta(sheets);
  const titles = new Set(
    (spreadsheet.data.sheets ?? []).map((s: any) => s.properties?.title as string)
  );
  const missing = CRM_SHEET_DEFS.filter((d) => !titles.has(d.title));
  if (missing.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: missing.map((d) => ({ addSheet: { properties: { title: d.title } } })),
      },
    });
    spreadsheet = await getSpreadsheetMeta(sheets, true);
  }

  const headerRanges = CRM_SHEET_DEFS.map((d) => `'${d.title}'!A1:ZZ1`);
  const headerBatch = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges: headerRanges,
  });
  const valueRanges = headerBatch.data.valueRanges ?? [];

  for (let i = 0; i < CRM_SHEET_DEFS.length; i++) {
    const def = CRM_SHEET_DEFS[i];
    const existing = valueRanges[i]?.values?.[0];
    if (existing?.length && existing[0]) continue;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${def.title}'!A1:${sheetColLetter(def.headers.length - 1)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [def.headers] },
    });
  }
}

async function ensurePipelineOptionalColumns(sheets: any): Promise<void> {
  if ((global as any).crm_pipeline_pl_extra_cols) return;
  const title = CRM_PIPELINE_SHEETS.PIPELINES;
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${title}'!A1:ZZ1`,
  });
  let headers = (headerRes.data.values?.[0] || []) as string[];
  if (!headers.includes('owner_username')) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${title}'!${sheetColLetter(headers.length)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [['owner_username']] },
    });
    headers = [...headers, 'owner_username'];
  }
  (global as any).crm_pipeline_pl_extra_cols = true;
}

async function ensureOpportunityOptionalColumns(sheets: any): Promise<void> {
  if ((global as any).crm_pipeline_opp_extra_cols_v3) return;
  const title = CRM_PIPELINE_SHEETS.OPPORTUNITIES;
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${title}'!A1:ZZ1`,
  });
  let headers = (headerRes.data.values?.[0] || []) as string[];
  const extra = ['card_color', 'extra_info', 'city', 'state', 'country'] as const;
  for (const colName of extra) {
    if (sheetHeaderColumnIndex(headers, colName) >= 0) continue;
    const col = headers.length;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${title}'!${sheetColLetter(col)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [[colName]] },
    });
    headers = [...headers, colName];
  }
  (global as any).crm_pipeline_opp_extra_cols_v3 = true;
}

async function seedDefaultPipelineIfEmpty(sheets: any): Promise<void> {
  const { rows: pipelines } = await readSheetRowsWithClient(sheets, CRM_PIPELINE_SHEETS.PIPELINES);
  if (pipelines.length > 0) return;

  const now = formatToSheetDate(new Date());
  const pipelineId = sheetNewId('pl');
  await appendRowWithClient(sheets, CRM_PIPELINE_SHEETS.PIPELINES, PIPELINE_HEADERS, {
    id: pipelineId,
    name: 'Main',
    sequence: 1,
    active: 'Y',
    created_at: now,
    created_by: 'system',
  });
  const defaultStages = ['Qualified', 'LinkedIn New', 'Super Qualified', 'Discussion'];
  for (let i = 0; i < defaultStages.length; i++) {
    await appendRowWithClient(sheets, CRM_PIPELINE_SHEETS.STAGES, STAGE_HEADERS, {
      id: sheetNewId('st'),
      pipeline_id: pipelineId,
      name: defaultStages[i],
      sequence: i + 1,
      active: 'Y',
      is_won: 'N',
      is_lost: 'N',
      created_at: now,
    });
  }
}

async function runEnsureCrmPipelineSheetsInitialized(): Promise<void> {
  const sheets = await getGoogleSheetsClient();
  await ensureAllCrmPipelineSheets(sheets);
  await ensurePipelineOptionalColumns(sheets);
  await ensureOpportunityOptionalColumns(sheets);
  await seedDefaultPipelineIfEmpty(sheets);
  (global as any)[ensuredKey] = true;
}

export async function ensureCrmPipelineSheetsInitialized(): Promise<void> {
  if ((global as any)[ensuredKey]) {
    return;
  }
  if (!ensureInFlight) {
    ensureInFlight = runEnsureCrmPipelineSheetsInitialized().finally(() => {
      ensureInFlight = null;
    });
  }
  await ensureInFlight;
}

export type CrmPipelineUser = { id?: number | string; username?: string; full_name?: string };

function userLabel(user?: CrmPipelineUser | null): string {
  if (!user) return 'System';
  return String(user.full_name || user.username || 'User');
}

async function readSheetRowsWithClient(
  sheets: any,
  sheetName: string
): Promise<{ headers: string[]; rows: any[] }> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A:ZZ`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const all = response.data.values ?? [];
  if (all.length === 0) return { headers: [], rows: [] };
  const headers = all[0] as string[];
  const rows = all.slice(1).map((row: any[]) => rowToObject(headers, row)).filter((r: { id?: unknown }) => r.id);
  return { headers, rows };
}

async function readSheetRows(sheetName: string): Promise<{ headers: string[]; rows: any[] }> {
  const sheets = await getGoogleSheetsClient();
  return withSheetsRetry(() => readSheetRowsWithClient(sheets, sheetName));
}

async function appendRowWithClient(
  sheets: any,
  sheetName: string,
  headers: string[],
  obj: Record<string, any>
): Promise<void> {
  const spreadsheet = await getSpreadsheetMeta(sheets);
  const sheetId = sheetIdByTitle(spreadsheet, sheetName);
  const maxRows = gridRowCount(spreadsheet, sheetName);

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A:A`,
  });
  const startRow = (existing.data.values?.length ?? 0) + 1;
  const endRow = startRow;
  const endCol = sheetColLetter(headers.length - 1);

  if (sheetId != null && endRow > maxRows) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          appendDimension: { sheetId, dimension: 'ROWS', length: endRow - maxRows + 50 },
        }],
      },
    });
    await getSpreadsheetMeta(sheets, true);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A${startRow}:${endCol}${endRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [objectToRow(headers, obj)] },
  });
}

async function appendRow(sheetName: string, headers: string[], obj: Record<string, any>): Promise<void> {
  const sheets = await getGoogleSheetsClient();
  await appendRowWithClient(sheets, sheetName, headers, obj);
}

function sheetHeaderColumnIndex(headers: string[], fieldKey: string): number {
  const exact = headers.indexOf(fieldKey);
  if (exact >= 0) return exact;
  const lower = fieldKey.toLowerCase();
  return headers.findIndex((h) => String(h || '').toLowerCase() === lower);
}

function normalizeCrmOpportunityRow(row: Record<string, any>): Record<string, any> {
  const pick = (canonical: string, variants: string[]) => {
    for (const k of variants) {
      const v = row[k];
      if (v != null && String(v).trim() !== '') return String(v);
    }
    return '';
  };
  return {
    ...row,
    city: pick('city', ['city', 'City']),
    state: pick('state', ['state', 'State']),
    country: pick('country', ['country', 'Country']),
  };
}

async function updateRowById(
  sheetName: string,
  id: string,
  updates: Record<string, any>
): Promise<void> {
  const sheets = await getGoogleSheetsClient();
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A1:ZZ1`,
  });
  const headers = headerRes.data.values?.[0] as string[];
  if (!headers?.length) throw new Error('Headers not found');

  const idCol = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A:A`,
  });
  const rows = idCol.data.values ?? [];
  const rowIndex = rows.findIndex((r) => String(r[0]) === String(id));
  if (rowIndex === -1) throw new Error('Record not found');
  const actualRow = rowIndex + 1;

  // Skip undefined so PATCH payloads like `{ name: "x" }` do not erase other columns
  // (JSON omits absent keys → undefined; we must not write '' into those cells).
  const data = Object.entries(updates)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      const colIndex = sheetHeaderColumnIndex(headers, key);
      if (colIndex === -1) return null;
      return {
        range: `'${sheetName}'!${sheetColLetter(colIndex)}${actualRow}`,
        values: [[value ?? '']],
      };
    })
    .filter(Boolean);

  if (data.length === 0) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: data as any[] },
  });
}

export async function appendCrmPipelineLog(entry: Record<string, any>): Promise<any> {
  await ensureCrmPipelineSheetsInitialized();
  const log = {
    id: sheetNewId('log'),
    opportunity_id: entry.opportunity_id ?? '',
    pipeline_id: entry.pipeline_id ?? '',
    event_type: entry.event_type ?? 'note',
    summary: entry.summary ?? '',
    body: entry.body ?? '',
    activity_type: entry.activity_type ?? '',
    due_date: entry.due_date ?? '',
    assigned_to: entry.assigned_to ?? '',
    is_done: entry.is_done ?? '',
    done_at: entry.done_at ?? '',
    field_name: entry.field_name ?? '',
    old_value: entry.old_value ?? '',
    new_value: entry.new_value ?? '',
    user_id: entry.user_id ?? '',
    user_name: entry.user_name ?? '',
    created_at: formatToSheetDate(new Date()),
  };
  await appendRow(CRM_PIPELINE_SHEETS.ACTIVITY_LOG, ACTIVITY_HEADERS, log);
  return log;
}

export async function getCrmPipelines(options?: { forceRefresh?: boolean }): Promise<any[]> {
  await ensureCrmPipelineSheetsInitialized();
  const now = Date.now();
  if (!options?.forceRefresh && pipelinesCache && now - pipelinesCache.at < PIPELINES_CACHE_MS) {
    return pipelinesCache.data;
  }
  const { rows } = await readSheetRows(CRM_PIPELINE_SHEETS.PIPELINES);
  const data = rows
    .filter((p) => String(p.active || 'Y').toUpperCase() === 'Y')
    .map((p) => ({ ...p, id: String(p.id) }))
    .sort(compareBySequenceThenId);
  pipelinesCache = { at: now, data };
  return data;
}

export function filterCrmPipelinesForUser(
  pipelines: any[],
  username: string,
  isAdmin: boolean
): any[] {
  if (isAdmin) return pipelines;
  const mine = String(username || '').trim().toLowerCase();
  if (!mine) return [];
  return pipelines.filter((p) => {
    const owner = String(p.owner_username || p.created_by || '').trim().toLowerCase();
    return owner === mine;
  });
}

export async function createCrmPipeline(
  name: string,
  user?: CrmPipelineUser,
  withDefaultStages = true,
  ownerUsername?: string
): Promise<any> {
  await ensureCrmPipelineSheetsInitialized();
  const { rows } = await readSheetRows(CRM_PIPELINE_SHEETS.PIPELINES);
  const now = formatToSheetDate(new Date());
  const id = sheetNewId('pl');
  const owner =
    String(ownerUsername || '').trim() || String(user?.username || '').trim() || 'user';
  const pipeline = {
    id,
    name,
    sequence: rows.length + 1,
    active: 'Y',
    created_at: now,
    created_by: user?.username || 'user',
    owner_username: owner,
  };
  await appendRow(CRM_PIPELINE_SHEETS.PIPELINES, PIPELINE_HEADERS, pipeline);
  invalidateCrmPipelinesCache();

  if (withDefaultStages) {
    const defaults = ['New', 'Qualified', 'Discussion'];
    for (let i = 0; i < defaults.length; i++) {
      await appendRow(CRM_PIPELINE_SHEETS.STAGES, STAGE_HEADERS, {
        id: sheetNewId('st'),
        pipeline_id: id,
        name: defaults[i],
        sequence: i + 1,
        active: 'Y',
        is_won: 'N',
        is_lost: 'N',
        created_at: now,
      });
    }
  }
  return pipeline;
}

export async function getCrmPipelineStages(pipelineId: string): Promise<any[]> {
  await ensureCrmPipelineSheetsInitialized();
  const { rows } = await readSheetRows(CRM_PIPELINE_SHEETS.STAGES);
  return rows
    .filter(
      (s) =>
        String(s.pipeline_id) === String(pipelineId) &&
        String(s.active || 'Y').toUpperCase() === 'Y'
    )
    .map((s) => ({ ...s, id: String(s.id), pipeline_id: String(s.pipeline_id) }))
    .sort(compareBySequenceThenId);
}

export async function createCrmPipelineStage(
  pipelineId: string,
  name: string,
  sequence?: number
): Promise<any> {
  await ensureCrmPipelineSheetsInitialized();
  const existing = await getCrmPipelineStages(pipelineId);
  const seq = sequence ?? existing.length + 1;
  const stage = {
    id: sheetNewId('st'),
    pipeline_id: pipelineId,
    name,
    sequence: seq,
    active: 'Y',
    is_won: 'N',
    is_lost: 'N',
    created_at: formatToSheetDate(new Date()),
  };
  await appendRow(CRM_PIPELINE_SHEETS.STAGES, STAGE_HEADERS, stage);
  return stage;
}

export async function updateCrmPipelineStage(
  stageId: string,
  updates: { name?: string; sequence?: number; active?: string }
): Promise<any> {
  await ensureCrmPipelineSheetsInitialized();
  const { rows } = await readSheetRows(CRM_PIPELINE_SHEETS.STAGES);
  const existing = rows.find((r) => String(r.id) === String(stageId));
  if (!existing) throw new Error('Stage not found');

  const patch: Record<string, any> = { ...updates };
  const seqFromSheet = Number(existing.sequence);
  const hasValidSeq = Number.isFinite(seqFromSheet) && seqFromSheet > 0;

  if (!hasValidSeq && patch.sequence === undefined) {
    const siblings = rows.filter(
      (s) =>
        String(s.pipeline_id) === String(existing.pipeline_id) &&
        String(s.active || 'Y').toUpperCase() === 'Y' &&
        String(s.id) !== String(stageId)
    );
    const maxSeq = siblings.reduce((m, s) => {
      const n = Number(s.sequence);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    patch.sequence = maxSeq + 1;
  }

  await updateRowById(CRM_PIPELINE_SHEETS.STAGES, stageId, patch);
  return { ...existing, id: String(stageId), ...patch };
}

export async function deleteCrmPipelineStage(stageId: string, pipelineId: string): Promise<void> {
  const opps = await getCrmOpportunities(pipelineId, { outcome: 'open' });
  const inStage = opps.filter((o) => String(o.stage_id) === String(stageId));
  if (inStage.length > 0) {
    throw new Error('Move or close opportunities in this stage before deleting');
  }
  await updateCrmPipelineStage(stageId, { active: 'N' });
}

export async function getCrmOpportunities(
  pipelineId: string,
  options?: { outcome?: string; mine?: string }
): Promise<any[]> {
  await ensureCrmPipelineSheetsInitialized();
  const sheets = await getGoogleSheetsClient();
  await ensureOpportunityOptionalColumns(sheets);
  const { rows } = await readSheetRows(CRM_PIPELINE_SHEETS.OPPORTUNITIES);
  return rows
    .filter((o) => String(o.pipeline_id) === String(pipelineId))
    .filter((o) => {
      if (options?.outcome) return String(o.outcome || 'open') === options.outcome;
      return true;
    })
    .filter((o) => {
      if (!options?.mine) return true;
      const sp = String(o.salesperson || '').toLowerCase();
      const mine = options.mine.toLowerCase();
      return sp === mine || sp.includes(mine);
    })
    .map((o) => normalizeCrmOpportunityRow({ ...o, id: String(o.id) }));
}

export async function getCrmOpportunityById(id: string): Promise<any | null> {
  await ensureCrmPipelineSheetsInitialized();
  const { rows } = await readSheetRows(CRM_PIPELINE_SHEETS.OPPORTUNITIES);
  const row = rows.find((o) => String(o.id) === String(id));
  return row ? normalizeCrmOpportunityRow(row) : null;
}

const LOGGABLE_FIELDS = [
  'name',
  'contact_name',
  'email',
  'phone',
  'company',
  'city',
  'state',
  'country',
  'expected_revenue',
  'recurring_revenue',
  'revenue_period',
  'probability',
  'priority',
  'tags',
  'salesperson',
  'expected_closing',
  'notes',
  'extra_info',
];

export async function createCrmOpportunity(
  data: Record<string, any>,
  user?: CrmPipelineUser
): Promise<any> {
  await ensureCrmPipelineSheetsInitialized();
  const now = formatToSheetDate(new Date());
  const id = sheetNewId('opp');
  const opp = {
    id,
    pipeline_id: data.pipeline_id,
    stage_id: data.stage_id,
    name: data.name || `${data.contact_name || 'Lead'}'s opportunity`,
    contact_name: data.contact_name || '',
    email: data.email || '',
    phone: data.phone || '',
    company: data.company || '',
    city: data.city || '',
    state: data.state || '',
    country: data.country || '',
    expected_revenue: data.expected_revenue ?? '',
    recurring_revenue: data.recurring_revenue ?? '',
    revenue_period: data.revenue_period || '',
    probability: data.probability ?? '',
    priority: data.priority ?? 0,
    tags: data.tags || '',
    salesperson: data.salesperson || userLabel(user),
    expected_closing: data.expected_closing || '',
    notes: data.notes || '',
    extra_info: String(data.extra_info ?? ''),
    card_color: data.card_color || '',
    outcome: 'open',
    created_at: now,
    updated_at: now,
    created_by: user?.username || '',
  };
  await appendRow(CRM_PIPELINE_SHEETS.OPPORTUNITIES, OPPORTUNITY_HEADERS, opp);
  await appendCrmPipelineLog({
    opportunity_id: id,
    pipeline_id: data.pipeline_id,
    event_type: 'create',
    summary: 'Lead/Opportunity created',
    body: opp.name,
    user_id: user?.id ?? '',
    user_name: userLabel(user),
  });
  return opp;
}

export type UpdateCrmOpportunityOptions = {
  /** When true, do not append one Activity Log row per changed field (use batch log from caller instead). */
  skipPerFieldActivityLog?: boolean;
};

export async function updateCrmOpportunity(
  id: string,
  updates: Record<string, any>,
  user?: CrmPipelineUser,
  options?: UpdateCrmOpportunityOptions
): Promise<any> {
  await ensureCrmPipelineSheetsInitialized();
  const existing = await getCrmOpportunityById(id);
  if (!existing) throw new Error('Opportunity not found');

  const now = formatToSheetDate(new Date());
  const merged: Record<string, any> = { ...updates, updated_at: now };
  const skipFieldLog = options?.skipPerFieldActivityLog === true;

  if (updates.stage_id && String(updates.stage_id) !== String(existing.stage_id)) {
    const stages = await getCrmPipelineStages(String(existing.pipeline_id));
    const oldStage = stages.find((s) => String(s.id) === String(existing.stage_id));
    const newStage = stages.find((s) => String(s.id) === String(updates.stage_id));
    await appendCrmPipelineLog({
      opportunity_id: id,
      pipeline_id: existing.pipeline_id,
      event_type: 'stage_change',
      summary: 'Stage changed',
      body: JSON.stringify({
        kind: 'stage_change',
        from_stage_id: String(existing.stage_id),
        to_stage_id: String(updates.stage_id),
        from_label: oldStage?.name || String(existing.stage_id),
        to_label: newStage?.name || String(updates.stage_id),
      }),
      old_value: oldStage?.name || String(existing.stage_id),
      new_value: newStage?.name || String(updates.stage_id),
      field_name: 'stage_id',
      user_id: user?.id ?? '',
      user_name: userLabel(user),
    });
    if (newStage && String(newStage.is_won).toUpperCase() === 'Y') merged.outcome = 'won';
    if (newStage && String(newStage.is_lost).toUpperCase() === 'Y') merged.outcome = 'lost';
  }

  if (updates.outcome === 'won' || updates.outcome === 'lost') {
    await appendCrmPipelineLog({
      opportunity_id: id,
      pipeline_id: existing.pipeline_id,
      event_type: updates.outcome,
      summary: updates.outcome === 'won' ? 'Marked as Won' : 'Marked as Lost',
      body: '',
      user_id: user?.id ?? '',
      user_name: userLabel(user),
    });
  }

  if (!skipFieldLog) {
    for (const field of LOGGABLE_FIELDS) {
      if (updates[field] === undefined) continue;
      const oldVal = existing[field];
      const newVal = updates[field];
      if (String(oldVal ?? '') === String(newVal ?? '')) continue;
      await appendCrmPipelineLog({
        opportunity_id: id,
        pipeline_id: existing.pipeline_id,
        event_type: 'field_change',
        summary: `${field} updated`,
        field_name: field,
        old_value: String(oldVal ?? ''),
        new_value: String(newVal ?? ''),
        user_id: user?.id ?? '',
        user_name: userLabel(user),
      });
    }
  }

  await updateRowById(CRM_PIPELINE_SHEETS.OPPORTUNITIES, id, merged);
  return { id, ...merged };
}

/** One sheet row + one activity log row for all changed lead fields (JSON payload in log body). */
export async function batchUpdateCrmOpportunityFields(
  id: string,
  updates: Record<string, any>,
  user?: CrmPipelineUser
): Promise<any> {
  await ensureCrmPipelineSheetsInitialized();
  const existing = await getCrmOpportunityById(id);
  if (!existing) throw new Error('Opportunity not found');

  const changed: Record<string, { from: string; to: string }> = {};
  const merged: Record<string, any> = { ...existing };

  for (const field of LOGGABLE_FIELDS) {
    if (updates[field] === undefined) continue;
    const newVal = updates[field];
    const oldVal = existing[field];
    if (String(oldVal ?? '') === String(newVal ?? '')) continue;
    changed[field] = { from: String(oldVal ?? ''), to: String(newVal ?? '') };
    merged[field] = newVal;
  }

  if (Object.keys(changed).length === 0) {
    return existing;
  }

  merged.updated_at = formatToSheetDate(new Date());
  await updateRowById(CRM_PIPELINE_SHEETS.OPPORTUNITIES, id, merged);

  await appendCrmPipelineLog({
    opportunity_id: id,
    pipeline_id: existing.pipeline_id,
    event_type: 'lead_update',
    summary: 'Lead updated',
    body: JSON.stringify({ kind: 'lead_fields', changes: changed }),
    user_id: user?.id ?? '',
    user_name: userLabel(user),
  });

  return merged;
}

export async function getCrmActivities(opportunityId: string): Promise<any[]> {
  await ensureCrmPipelineSheetsInitialized();
  const { rows } = await readSheetRows(CRM_PIPELINE_SHEETS.ACTIVITY_LOG);
  return rows
    .filter((r) => String(r.opportunity_id) === String(opportunityId))
    .sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return tb - ta;
    });
}

export async function createCrmPipelineNote(
  opportunityId: string,
  body: string,
  user?: CrmPipelineUser
): Promise<any> {
  const opp = await getCrmOpportunityById(opportunityId);
  if (!opp) throw new Error('Opportunity not found');
  const payload = { kind: 'note' as const, text: body };
  return appendCrmPipelineLog({
    opportunity_id: opportunityId,
    pipeline_id: opp.pipeline_id,
    event_type: 'note',
    summary: 'Note',
    body: JSON.stringify(payload),
    user_id: user?.id ?? '',
    user_name: userLabel(user),
  });
}

export async function createCrmScheduledActivity(
  opportunityId: string,
  data: {
    activity_type: string;
    summary: string;
    body?: string;
    due_date?: string;
    assigned_to?: string;
  },
  user?: CrmPipelineUser
): Promise<any> {
  const opp = await getCrmOpportunityById(opportunityId);
  if (!opp) throw new Error('Opportunity not found');
  const payload = {
    kind: 'scheduled_activity' as const,
    activity_type: data.activity_type,
    summary: data.summary,
    body: data.body ?? '',
    due_date: data.due_date ?? '',
    assigned_to: data.assigned_to ?? userLabel(user),
  };
  return appendCrmPipelineLog({
    opportunity_id: opportunityId,
    pipeline_id: opp.pipeline_id,
    event_type: 'activity',
    summary: data.summary || data.activity_type,
    body: JSON.stringify(payload),
    activity_type: data.activity_type,
    due_date: data.due_date || '',
    assigned_to: data.assigned_to || userLabel(user),
    is_done: 'N',
    user_id: user?.id ?? '',
    user_name: userLabel(user),
  });
}

export async function updateCrmScheduledActivity(
  activityId: string,
  updates: {
    due_date?: string;
    body?: string;
    activity_type?: string;
    summary?: string;
  },
  user?: CrmPipelineUser
): Promise<any> {
  await ensureCrmPipelineSheetsInitialized();
  const { rows } = await readSheetRows(CRM_PIPELINE_SHEETS.ACTIVITY_LOG);
  const activity = rows.find((r) => String(r.id) === String(activityId));
  if (!activity) throw new Error('Activity not found');
  if (String(activity.event_type) !== 'activity') {
    throw new Error('Only scheduled activities can be edited');
  }
  if (String(activity.is_done || 'N').toUpperCase() === 'Y') {
    throw new Error('Activity is already completed');
  }

  let payload: Record<string, any> = { kind: 'scheduled_activity' };
  const rawBody = String(activity.body || '');
  if (rawBody.trim()) {
    try {
      const parsed = JSON.parse(rawBody);
      if (parsed && typeof parsed === 'object') payload = { ...parsed };
    } catch {
      payload.body = rawBody;
    }
  }
  payload.kind = 'scheduled_activity';

  if (updates.activity_type !== undefined) {
    payload.activity_type = updates.activity_type;
    payload.summary = updates.summary || updates.activity_type;
  }
  if (updates.body !== undefined) payload.body = updates.body;
  if (updates.due_date !== undefined) payload.due_date = updates.due_date;

  const activityType = String(payload.activity_type || activity.activity_type || 'call');
  const summary =
    updates.summary ||
    String(payload.summary || activity.summary || activityType);
  const dueDate =
    updates.due_date !== undefined ? updates.due_date : String(activity.due_date || payload.due_date || '');

  await updateRowById(CRM_PIPELINE_SHEETS.ACTIVITY_LOG, activityId, {
    activity_type: activityType,
    summary,
    due_date: dueDate,
    body: JSON.stringify(payload),
  });

  return {
    id: activityId,
    activity_type: activityType,
    summary,
    due_date: dueDate,
    body: JSON.stringify(payload),
    user_name: userLabel(user),
  };
}

export async function markCrmActivityDone(activityId: string, user?: CrmPipelineUser): Promise<any> {
  await ensureCrmPipelineSheetsInitialized();
  const { rows } = await readSheetRows(CRM_PIPELINE_SHEETS.ACTIVITY_LOG);
  const activity = rows.find((r) => String(r.id) === String(activityId));
  if (!activity) throw new Error('Activity not found');
  const doneAt = formatToSheetDate(new Date());
  await updateRowById(CRM_PIPELINE_SHEETS.ACTIVITY_LOG, activityId, {
    is_done: 'Y',
    done_at: doneAt,
  });
  await appendCrmPipelineLog({
    opportunity_id: activity.opportunity_id,
    pipeline_id: activity.pipeline_id,
    event_type: 'activity_done',
    summary: `Done: ${activity.summary || activity.activity_type}`,
    body: activity.body || '',
    user_id: user?.id ?? '',
    user_name: userLabel(user),
  });
  return { id: activityId, is_done: 'Y', done_at: doneAt };
}

export async function getOpenActivitiesForPipeline(pipelineId: string): Promise<any[]> {
  const { rows } = await readSheetRows(CRM_PIPELINE_SHEETS.ACTIVITY_LOG);
  return rows.filter(
    (r) =>
      String(r.pipeline_id) === String(pipelineId) &&
      r.event_type === 'activity' &&
      String(r.is_done || 'N').toUpperCase() !== 'Y'
  );
}
