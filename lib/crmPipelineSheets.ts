import { SPREADSHEET_IDS, getGoogleSheetsClient, rowToObject, objectToRow } from '@/lib/sheets';
import { formatToSheetDate, parseSheetDate } from '@/lib/dateUtils';
import { sheetColLetter, sheetNewId } from '@/lib/sheetColLetter';
import { compareBySequenceThenId } from '@/lib/crmPipelineStageSort';
import {
  normalizePlannedYearMonth,
  pickPlannedSheetField,
  salesPerformancePlannedRowId,
} from '@/lib/crmPipelineSalesPerformancePlanned';
import { salespersonLabel } from '@/lib/crmPipelineFiveForThree';
import {
  parsePipelineAccessUsernames,
  pipelineAccessUsernamesToSheet,
  userCanAccessCrmPipeline,
  userCanManageCrmPipeline,
} from '@/lib/crmPipelineAccess';

export {
  parsePipelineAccessUsernames,
  pipelineAccessUsernamesToSheet,
  userCanAccessCrmPipeline,
  userCanManageCrmPipeline,
} from '@/lib/crmPipelineAccess';

export const CRM_PIPELINE_SHEETS = {
  PIPELINES: 'CRM Pipelines',
  STAGES: 'CRM Pipeline Stages',
  OPPORTUNITIES: 'CRM Opportunities',
  ACTIVITY_LOG: 'CRM Activity Log',
  SALES_PERFORMANCE_PLANNED: 'Sales Performance Planned',
} as const;

export const SALES_PERFORMANCE_PLANNED_HEADERS = [
  'id',
  'pipeline_id',
  'year_month',
  'week_key',
  'salesperson',
  'planned_leads',
  'planned_meetings',
  'planned_revenue',
  'updated_at',
  'updated_by',
];

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
/** Must match CRM Opportunities sheet row 1 (manual edits use City/State/Country). */
export const OPPORTUNITY_HEADERS = [
  'id',
  'pipeline_id',
  'stage_id',
  'name',
  'contact_name',
  'email',
  'phone',
  'company',
  'expected_revenue',
  'revenue',
  'costing',
  'costing_items',
  'priority',
  'tags',
  'salesperson',
  'expected_closing',
  'notes',
  'outcome',
  'created_at',
  'updated_at',
  'created_by',
  'City',
  'State',
  'Country',
  'card_color',
] as const;
const ACTIVITY_HEADERS = [
  'id', 'opportunity_id', 'pipeline_id', 'event_type', 'summary', 'body', 'activity_type',
  'due_date', 'assigned_to', 'is_done', 'done_at', 'field_name', 'old_value', 'new_value',
  'user_id', 'user_name', 'created_at',
];

const ensuredKey = 'crm_pipeline_sheets_v2';
const ensuredCoreKey = 'crm_pipeline_core_v1';
const spreadsheetMetaKey = 'crm_pipeline_spreadsheet_meta_v1';

type SheetDef = { title: string; headers: string[] };

const CRM_SHEET_DEFS: SheetDef[] = [
  { title: CRM_PIPELINE_SHEETS.PIPELINES, headers: PIPELINE_HEADERS },
  { title: CRM_PIPELINE_SHEETS.STAGES, headers: STAGE_HEADERS },
  { title: CRM_PIPELINE_SHEETS.OPPORTUNITIES, headers: [...OPPORTUNITY_HEADERS] },
  { title: CRM_PIPELINE_SHEETS.ACTIVITY_LOG, headers: ACTIVITY_HEADERS },
  { title: CRM_PIPELINE_SHEETS.SALES_PERFORMANCE_PLANNED, headers: SALES_PERFORMANCE_PLANNED_HEADERS },
];

let ensureInFlight: Promise<void> | null = null;
let ensureCoreInFlight: Promise<void> | null = null;

const PIPELINES_CACHE_MS = 60_000;
let pipelinesCache: { at: number; data: any[] } | null = null;

const STAGES_CACHE_MS = 60_000;
const stagesCache = new Map<string, { at: number; stages: any[] }>();

const BOARD_CACHE_MS = 60_000;
type BoardCacheEntry = {
  at: number;
  opportunities: any[];
  openActivitiesByOpp: Record<string, any>;
};
const boardCache = new Map<string, BoardCacheEntry>();

const DASHBOARD_CACHE_MS = 60_000;
type DashboardCacheEntry = {
  at: number;
  opportunities: any[];
  wonDatesByOppId: Record<string, string>;
};
const dashboardCache = new Map<string, DashboardCacheEntry>();

const ACTIVITY_LOG_CACHE_MS = 60_000;
let activityLogCache: { at: number; rows: any[] } | null = null;

function invalidateCrmPipelinesCache(): void {
  pipelinesCache = null;
}

export function invalidateCrmStagesCache(pipelineId?: string): void {
  if (!pipelineId) {
    stagesCache.clear();
    return;
  }
  stagesCache.delete(String(pipelineId));
}

export function invalidateCrmBoardCache(pipelineId?: string): void {
  if (!pipelineId) {
    boardCache.clear();
    dashboardCache.clear();
    activityLogCache = null;
    return;
  }
  activityLogCache = null;
  const prefix = `${String(pipelineId)}|`;
  for (const key of boardCache.keys()) {
    if (key.startsWith(prefix)) boardCache.delete(key);
  }
  for (const key of dashboardCache.keys()) {
    if (key.startsWith(prefix)) dashboardCache.delete(key);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isSheetsQuotaError(error: unknown): boolean {
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

function gridColumnCount(spreadsheet: any, title: string): number {
  const sheet = spreadsheet.data.sheets?.find((s: any) => s.properties?.title === title);
  return sheet?.properties?.gridProperties?.columnCount ?? 26;
}

async function ensureSheetHasColumnCapacity(
  sheets: any,
  sheetTitle: string,
  minColumns: number
): Promise<void> {
  let spreadsheet = await getSpreadsheetMeta(sheets);
  const current = gridColumnCount(spreadsheet, sheetTitle);
  if (minColumns <= current) return;
  const sheetId = sheetIdByTitle(spreadsheet, sheetTitle);
  if (sheetId == null) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          appendDimension: {
            sheetId,
            dimension: 'COLUMNS',
            length: minColumns - current,
          },
        },
      ],
    },
  });
  await getSpreadsheetMeta(sheets, true);
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
        requests: missing.map((d) => ({
          addSheet: {
            properties: {
              title: d.title,
              gridProperties: {
                rowCount: 1000,
                columnCount: Math.max(32, d.headers.length + 4),
              },
            },
          },
        })),
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
  const title = CRM_PIPELINE_SHEETS.PIPELINES;
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${title}'!A1:ZZ1`,
  });
  let headers = (headerRes.data.values?.[0] || []) as string[];
  const hasCol = (name: string) =>
    headers.some((h) => String(h || '').toLowerCase() === name.toLowerCase());
  if (!hasCol('owner_username')) {
    const colIndex = headers.length;
    await ensureSheetHasColumnCapacity(sheets, title, colIndex + 1);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${title}'!${sheetColLetter(colIndex)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [['owner_username']] },
    });
    headers = [...headers, 'owner_username'];
  }
}

async function ensureOpportunityOptionalColumns(sheets: any): Promise<void> {
  if ((global as any).crm_pipeline_opp_extra_cols_v6) return;
  const title = CRM_PIPELINE_SHEETS.OPPORTUNITIES;
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${title}'!A1:ZZ1`,
  });
  let headers = (headerRes.data.values?.[0] || []) as string[];
  const extra = [
    'outcome',
    'City',
    'State',
    'Country',
    'card_color',
    'costing',
    'costing_items',
    'revenue',
  ] as const;
  for (const colName of extra) {
    if (sheetHeaderColumnIndex(headers, colName) >= 0) continue;
    const col = headers.length;
    await ensureSheetHasColumnCapacity(sheets, title, col + 1);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${title}'!${sheetColLetter(col)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [[colName]] },
    });
    headers = [...headers, colName];
  }
  (global as any).crm_pipeline_opp_extra_cols_v6 = true;
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

async function runEnsureCrmPipelineCore(): Promise<void> {
  const sheets = await getGoogleSheetsClient();
  await ensureAllCrmPipelineSheets(sheets);
  await ensurePipelineOptionalColumns(sheets);
  (global as any)[ensuredCoreKey] = true;
}

export async function ensureCrmPipelineCore(): Promise<void> {
  if ((global as any)[ensuredCoreKey]) return;
  if (!ensureCoreInFlight) {
    ensureCoreInFlight = runEnsureCrmPipelineCore().finally(() => {
      ensureCoreInFlight = null;
    });
  }
  await ensureCoreInFlight;
}

async function runEnsureCrmPipelineSheetsInitialized(): Promise<void> {
  await ensureCrmPipelineCore();
  const sheets = await getGoogleSheetsClient();
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

  const rowValues =
    sheetName === CRM_PIPELINE_SHEETS.OPPORTUNITIES
      ? objectToRowForSheetHeaders(headers, obj)
      : objectToRow(headers, obj);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A${startRow}:${endCol}${endRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowValues] },
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

/** Map opportunity fields onto the live sheet header row (case-insensitive keys). */
function objectToRowForSheetHeaders(headers: string[], obj: Record<string, any>): any[] {
  return headers.map((header) => {
    let value = obj[header];
    if (value === undefined || value === null) {
      const lower = String(header || '').toLowerCase();
      value = obj[lower];
    }
    if (typeof value === 'object' && value !== null) return JSON.stringify(value);
    if (value === null || value === undefined) return '';
    return value;
  });
}

async function getCrmOpportunitySheetHeaders(sheets: any): Promise<string[]> {
  await ensureOpportunityOptionalColumns(sheets);
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${CRM_PIPELINE_SHEETS.OPPORTUNITIES}'!A1:ZZ1`,
  });
  const headers = (headerRes.data.values?.[0] || []) as string[];
  return headers.length ? headers : [...OPPORTUNITY_HEADERS];
}

function sheetCellScalar(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return value as string | number | boolean;
}

function normalizeCrmJsonStringField(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
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
    costing_items: normalizeCrmJsonStringField(row.costing_items),
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
        values: [[sheetCellScalar(value)]],
      };
    })
    .filter(Boolean);

  if (data.length === 0) {
    const keys = Object.keys(updates).join(', ');
    throw new Error(
      keys
        ? `No matching columns on sheet for update fields: ${keys}. Refresh and try again.`
        : 'Nothing to update'
    );
  }

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
  await ensureCrmPipelineCore();
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
  return pipelines.filter((p) => userCanAccessCrmPipeline(p, username, false));
}

export async function createCrmPipeline(
  name: string,
  user?: CrmPipelineUser,
  withDefaultStages = true,
  accessUsernames?: string[]
): Promise<any> {
  await ensureCrmPipelineSheetsInitialized();
  const { rows } = await readSheetRows(CRM_PIPELINE_SHEETS.PIPELINES);
  const now = formatToSheetDate(new Date());
  const id = sheetNewId('pl');
  const accessList =
    accessUsernames?.map((u) => String(u).trim()).filter(Boolean) ||
    [];
  const fallback = String(user?.username || '').trim() || 'user';
  const resolvedAccess =
    accessList.length > 0 ? parsePipelineAccessUsernames({ owner_username: accessList.join(',') }) : [fallback];
  const owner_username = pipelineAccessUsernamesToSheet(resolvedAccess);
  const pipeline = {
    id,
    name,
    sequence: rows.length + 1,
    active: 'Y',
    created_at: now,
    created_by: user?.username || 'user',
    owner_username,
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

export async function updateCrmPipeline(
  pipelineId: string,
  updates: { name?: string; owner_username?: string }
): Promise<any> {
  await ensureCrmPipelineSheetsInitialized();
  const sheets = await getGoogleSheetsClient();
  await ensurePipelineOptionalColumns(sheets);
  const { rows } = await readSheetRows(CRM_PIPELINE_SHEETS.PIPELINES);
  const existing = rows.find((r) => String(r.id) === String(pipelineId));
  if (!existing) throw new Error('Pipeline not found');
  const patch: Record<string, string> = {};
  if (updates.name !== undefined) patch.name = String(updates.name).trim();
  if (updates.owner_username !== undefined) {
    const accessSheet = pipelineAccessUsernamesToSheet(
      parsePipelineAccessUsernames({ owner_username: updates.owner_username })
    );
    if (!accessSheet) throw new Error('At least one user with access is required');
    patch.owner_username = accessSheet;
  }
  await updateRowById(CRM_PIPELINE_SHEETS.PIPELINES, pipelineId, patch);
  invalidateCrmPipelinesCache();
  return { ...existing, ...patch, id: String(existing.id) };
}

export async function getCrmPipelineStages(
  pipelineId: string,
  options?: { forceRefresh?: boolean }
): Promise<any[]> {
  await ensureCrmPipelineCore();
  const pid = String(pipelineId);
  const now = Date.now();
  if (!options?.forceRefresh) {
    const hit = stagesCache.get(pid);
    if (hit && now - hit.at < STAGES_CACHE_MS) return hit.stages;
  }
  const { rows } = await readSheetRows(CRM_PIPELINE_SHEETS.STAGES);
  const stages = rows
    .filter(
      (s) =>
        String(s.pipeline_id) === pid && String(s.active || 'Y').toUpperCase() === 'Y'
    )
    .map((s) => ({ ...s, id: String(s.id), pipeline_id: String(s.pipeline_id) }))
    .sort(compareBySequenceThenId);
  stagesCache.set(pid, { at: now, stages });
  return stages;
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
  invalidateCrmStagesCache(pipelineId);
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
  invalidateCrmStagesCache(String(existing.pipeline_id));
  return { ...existing, id: String(stageId), ...patch };
}

export async function deleteCrmPipelineStage(stageId: string, pipelineId: string): Promise<void> {
  const opps = await getCrmOpportunities(pipelineId, { outcome: 'open' });
  const inStage = opps.filter((o) => String(o.stage_id) === String(stageId));
  if (inStage.length > 0) {
    throw new Error('Move or close opportunities in this stage before deleting');
  }
  await updateCrmPipelineStage(stageId, { active: 'N' });
  invalidateCrmStagesCache(pipelineId);
}

export async function getCrmBoardBundle(
  pipelineId: string,
  options?: { outcome?: string; mine?: string },
  opts?: { forceRefresh?: boolean }
): Promise<{ opportunities: any[]; openActivitiesByOpp: Record<string, any> }> {
  const outcome = options?.outcome ?? 'open';
  const mineKey = options?.mine?.trim() ? String(options.mine).trim() : '';
  const key = `${String(pipelineId)}|${outcome}|${mineKey}`;
  const now = Date.now();
  if (!opts?.forceRefresh) {
    const hit = boardCache.get(key);
    if (hit && now - hit.at < BOARD_CACHE_MS) {
      return {
        opportunities: hit.opportunities,
        openActivitiesByOpp: hit.openActivitiesByOpp,
      };
    }
  }
  const [opportunities, openRows] = await Promise.all([
    getCrmOpportunities(pipelineId, { outcome, mine: mineKey || undefined }),
    getOpenActivitiesForPipeline(pipelineId),
  ]);
  const openActivitiesByOpp: Record<string, any> = {};
  const parseActTime = (a: { created_at?: string }) =>
    new Date(String(a.created_at || 0)).getTime() || 0;
  for (const act of openRows) {
    const oid = String(act.opportunity_id);
    const prev = openActivitiesByOpp[oid];
    if (!prev || parseActTime(act) >= parseActTime(prev)) openActivitiesByOpp[oid] = act;
  }
  boardCache.set(key, { at: now, opportunities, openActivitiesByOpp });
  return { opportunities, openActivitiesByOpp };
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
  'revenue',
  'costing',
  'costing_items',
  'priority',
  'tags',
  'salesperson',
  'expected_closing',
  'notes',
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
    revenue: data.revenue ?? '',
    costing: data.costing ?? '',
    costing_items: data.costing_items ?? '',
    priority: data.priority ?? 0,
    tags: data.tags || '',
    salesperson: data.salesperson || userLabel(user),
    expected_closing: data.expected_closing || '',
    notes: data.notes || '',
    card_color: data.card_color || '',
    outcome: 'open',
    created_at: now,
    updated_at: now,
    created_by: user?.username || '',
  };
  const sheets = await getGoogleSheetsClient();
  const sheetHeaders = await getCrmOpportunitySheetHeaders(sheets);
  await appendRowWithClient(sheets, CRM_PIPELINE_SHEETS.OPPORTUNITIES, sheetHeaders, opp);
  await appendCrmPipelineLog({
    opportunity_id: id,
    pipeline_id: data.pipeline_id,
    event_type: 'create',
    summary: 'Lead/Opportunity created',
    body: opp.name,
    user_id: user?.id ?? '',
    user_name: userLabel(user),
  });
  invalidateCrmBoardCache(String(data.pipeline_id));
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
  invalidateCrmBoardCache(String(existing.pipeline_id));
  return normalizeCrmOpportunityRow({ id, ...merged, ...updates });
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
  const patch: Record<string, unknown> = { updated_at: merged.updated_at };
  for (const field of Object.keys(changed)) {
    patch[field] = merged[field];
  }
  await updateRowById(CRM_PIPELINE_SHEETS.OPPORTUNITIES, id, patch);

  await appendCrmPipelineLog({
    opportunity_id: id,
    pipeline_id: existing.pipeline_id,
    event_type: 'lead_update',
    summary: 'Lead updated',
    body: JSON.stringify({ kind: 'lead_fields', changes: changed }),
    user_id: user?.id ?? '',
    user_name: userLabel(user),
  });

  invalidateCrmBoardCache(String(existing.pipeline_id));
  return normalizeCrmOpportunityRow({ id, ...merged });
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
  const row = await appendCrmPipelineLog({
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
  invalidateCrmBoardCache(String(opp.pipeline_id));
  return row;
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

  invalidateCrmBoardCache(String(activity.pipeline_id));

  return {
    id: activityId,
    activity_type: activityType,
    summary,
    due_date: dueDate,
    body: JSON.stringify(payload),
    user_name: userLabel(user),
  };
}

export async function markCrmActivityDone(
  activityId: string,
  user?: CrmPipelineUser,
  options?: { remark?: string }
): Promise<any> {
  await ensureCrmPipelineSheetsInitialized();
  const { rows } = await readSheetRows(CRM_PIPELINE_SHEETS.ACTIVITY_LOG);
  const activity = rows.find((r) => String(r.id) === String(activityId));
  if (!activity) throw new Error('Activity not found');
  const doneAt = formatToSheetDate(new Date());
  const remark = String(options?.remark || '').trim();
  await updateRowById(CRM_PIPELINE_SHEETS.ACTIVITY_LOG, activityId, {
    is_done: 'Y',
    done_at: doneAt,
  });
  const doneBody = remark
    ? JSON.stringify({
        kind: 'activity_done',
        remark,
        activity_body: activity.body || '',
      })
    : String(activity.body || '');
  const baseSummary = activity.summary || activity.activity_type || 'activity';
  await appendCrmPipelineLog({
    opportunity_id: activity.opportunity_id,
    pipeline_id: activity.pipeline_id,
    event_type: 'activity_done',
    summary: remark ? `Done: ${baseSummary}` : `Done: ${baseSummary}`,
    body: doneBody,
    user_id: user?.id ?? '',
    user_name: userLabel(user),
  });
  invalidateCrmBoardCache(String(activity.pipeline_id));
  return { id: activityId, is_done: 'Y', done_at: doneAt, remark };
}

export async function getCrmActivityLogRows(options?: { forceRefresh?: boolean }): Promise<any[]> {
  await ensureCrmPipelineSheetsInitialized();
  const now = Date.now();
  if (!options?.forceRefresh && activityLogCache && now - activityLogCache.at < ACTIVITY_LOG_CACHE_MS) {
    return activityLogCache.rows;
  }
  const { rows } = await readSheetRows(CRM_PIPELINE_SHEETS.ACTIVITY_LOG);
  activityLogCache = { at: now, rows };
  return rows;
}

export async function getCrmActivitiesForPipelines(
  pipelineIds: string[],
  options?: { forceRefresh?: boolean }
): Promise<any[]> {
  const rows = await getCrmActivityLogRows(options);
  if (pipelineIds.length === 0) return [];
  const idSet = new Set(pipelineIds.map((id) => String(id)));
  return rows.filter((r) => idSet.has(String(r.pipeline_id)));
}

export async function getOpenActivitiesForPipeline(pipelineId: string): Promise<any[]> {
  const rows = await getCrmActivityLogRows();
  return rows.filter(
    (r) =>
      String(r.pipeline_id) === String(pipelineId) &&
      r.event_type === 'activity' &&
      String(r.is_done || 'N').toUpperCase() !== 'Y'
  );
}

export async function getCrmOpportunitiesForDashboard(
  pipelineId: string,
  options?: { mine?: string }
): Promise<any[]> {
  return getCrmOpportunities(pipelineId, { mine: options?.mine });
}

async function buildCrmWonDatesByOpportunityId(
  pipelineId: string,
  opportunities: any[]
): Promise<Record<string, string>> {
  await ensureCrmPipelineSheetsInitialized();
  const { rows } = await readSheetRows(CRM_PIPELINE_SHEETS.ACTIVITY_LOG);
  const map: Record<string, string> = {};
  const parseActTime = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
  for (const r of rows) {
    if (String(r.pipeline_id) !== String(pipelineId)) continue;
    if (String(r.event_type).toLowerCase() !== 'won') continue;
    const oid = String(r.opportunity_id);
    const at = parseSheetDate(r.created_at);
    if (!at) continue;
    const prev = map[oid];
    if (!prev || parseActTime(at) >= parseActTime(prev)) map[oid] = at;
  }
  for (const o of opportunities) {
    if (String(o.outcome || '').toLowerCase() !== 'won') continue;
    const oid = String(o.id);
    if (map[oid]) continue;
    const fb = parseSheetDate(o.updated_at) || parseSheetDate(o.created_at);
    if (fb) map[oid] = fb;
  }
  return map;
}

export async function getCrmPipelineDashboardData(
  pipelineId: string,
  options?: { mine?: string; forceRefresh?: boolean }
): Promise<{ opportunities: any[]; wonDatesByOppId: Record<string, string> }> {
  const mineKey = options?.mine?.trim() ? String(options.mine).trim() : '';
  const key = `${String(pipelineId)}|dash|${mineKey}`;
  const now = Date.now();
  if (!options?.forceRefresh) {
    const hit = dashboardCache.get(key);
    if (hit && now - hit.at < DASHBOARD_CACHE_MS) {
      return {
        opportunities: hit.opportunities,
        wonDatesByOppId: hit.wonDatesByOppId,
      };
    }
  }
  const opportunities = await getCrmOpportunitiesForDashboard(pipelineId, { mine: options?.mine });
  const wonDatesByOppId = await buildCrmWonDatesByOpportunityId(pipelineId, opportunities);
  dashboardCache.set(key, { at: now, opportunities, wonDatesByOppId });
  return { opportunities, wonDatesByOppId };
}

export async function getSalesPerformancePlannedRows(
  pipelineId: string,
  yearMonth: string
): Promise<any[]> {
  await ensureCrmPipelineSheetsInitialized();
  const rows = await readSalesPerformancePlannedSheetRows();
  const pid = String(pipelineId).trim().toLowerCase();
  const ym = String(yearMonth).trim();
  return rows.filter((r) => {
    const rowPid = String(pickPlannedSheetField(r as Record<string, unknown>, 'pipeline_id') ?? '')
      .trim()
      .toLowerCase();
    const rowYm = normalizePlannedYearMonth(
      pickPlannedSheetField(r as Record<string, unknown>, 'year_month')
    );
    return rowPid === pid && rowYm === ym;
  });
}

async function readSalesPerformancePlannedSheetRows(): Promise<any[]> {
  const sheets = await getGoogleSheetsClient();
  const title = CRM_PIPELINE_SHEETS.SALES_PERFORMANCE_PLANNED;
  const response = await withSheetsRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${title}'!A:ZZ`,
      valueRenderOption: 'FORMATTED_VALUE',
    })
  );
  const all = response.data.values ?? [];
  if (all.length === 0) return [];
  const headers = (all[0] as string[]).map((h) => String(h || '').trim());
  return all
    .slice(1)
    .map((row: unknown[]) => rowToObject(headers, row))
    .filter((r: { id?: unknown }) => {
      const id = r?.id;
      return id != null && String(id).trim() !== '';
    });
}

export type SaveSalesPerformancePlannedInput = {
  pipelineId: string;
  yearMonth: string;
  records: {
    weekKey: string;
    salesperson: string;
    plannedLeads: number | null;
    plannedMeetings: number | null;
    plannedRevenue: number | null;
  }[];
  updatedBy?: string;
};

export async function saveSalesPerformancePlannedBatch(
  input: SaveSalesPerformancePlannedInput
): Promise<void> {
  await ensureCrmPipelineSheetsInitialized();
  const sheets = await getGoogleSheetsClient();
  const { rows } = await readSheetRows(CRM_PIPELINE_SHEETS.SALES_PERFORMANCE_PLANNED);
  const now = formatToSheetDate(new Date());
  const byUser = input.updatedBy?.trim() || '';

  const indexById = new Map<string, any>();
  for (const r of rows) {
    if (r.id) indexById.set(String(r.id), r);
  }

  for (const rec of input.records) {
    const id = salesPerformancePlannedRowId(
      input.pipelineId,
      input.yearMonth,
      rec.weekKey,
      rec.salesperson
    );
    const existing = indexById.get(id);
    const payload = {
      id,
      pipeline_id: input.pipelineId,
      year_month: input.yearMonth,
      week_key: rec.weekKey,
      salesperson: salespersonLabel(rec.salesperson),
      planned_leads: rec.plannedLeads ?? '',
      planned_meetings: rec.plannedMeetings ?? '',
      planned_revenue: rec.plannedRevenue ?? '',
      updated_at: now,
      updated_by: byUser,
    };

    if (existing) {
      await updateRowById(CRM_PIPELINE_SHEETS.SALES_PERFORMANCE_PLANNED, id, {
        planned_leads: payload.planned_leads,
        planned_meetings: payload.planned_meetings,
        planned_revenue: payload.planned_revenue,
        updated_at: payload.updated_at,
        updated_by: payload.updated_by,
      });
    } else {
      await appendRow(CRM_PIPELINE_SHEETS.SALES_PERFORMANCE_PLANNED, SALES_PERFORMANCE_PLANNED_HEADERS, payload);
      indexById.set(id, payload);
    }
  }
}
