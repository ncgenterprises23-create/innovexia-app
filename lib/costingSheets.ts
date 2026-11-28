import { SPREADSHEET_IDS, getGoogleSheetsClient, objectToRow, rowToObject } from '@/lib/sheets';
import { formatToSheetDate } from '@/lib/dateUtils';
import { sheetColLetter, sheetNewId } from '@/lib/sheetColLetter';
import { COSTING_HEADERS, COSTING_SHEET } from '@/lib/costingConstants';

export { COSTING_HEADERS, COSTING_SHEET } from '@/lib/costingConstants';

const SPREADSHEET_ID = SPREADSHEET_IDS.CRM_PIPELINE;

let ensureInFlight: Promise<void> | null = null;
const ensuredKey = 'costing_sheet_v1';

export type CostingRecord = {
  id: string;
  item_name: string;
  item_code: string;
  ims_type: string;
  cost_price: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
};

async function getSheetId(sheets: any, title: string): Promise<number | null> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets?.find((s: any) => s.properties?.title === title);
  return sheet?.properties?.sheetId ?? null;
}

export async function ensureCostingSheet(): Promise<void> {
  if ((global as any)[ensuredKey]) return;
  if (ensureInFlight) return ensureInFlight;
  ensureInFlight = (async () => {
    const sheets = await getGoogleSheetsClient();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const titles = new Set((meta.data.sheets ?? []).map((s: any) => s.properties?.title as string));
    if (!titles.has(COSTING_SHEET)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: COSTING_SHEET },
              },
            },
          ],
        },
      });
    }
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${COSTING_SHEET}'!A1:ZZ1`,
    });
    const row0 = headerRes.data.values?.[0] as string[] | undefined;
    const hasHeaders = row0?.some((h) => String(h || '').trim() !== '');
    if (!hasHeaders) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${COSTING_SHEET}'!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [[...COSTING_HEADERS]] },
      });
    }
    (global as any)[ensuredKey] = true;
  })().finally(() => {
    ensureInFlight = null;
  });
  return ensureInFlight;
}

function normalizeCostingRow(row: Record<string, any>): CostingRecord {
  const price = Number(row.cost_price);
  return {
    id: String(row.id || ''),
    item_name: String(row.item_name || '').trim(),
    item_code: String(row.item_code || '').trim(),
    ims_type: String(row.ims_type || '').trim(),
    cost_price: Number.isFinite(price) ? price : 0,
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
    created_by: row.created_by ? String(row.created_by) : undefined,
    updated_by: row.updated_by ? String(row.updated_by) : undefined,
  };
}

export async function listCostingRecords(): Promise<CostingRecord[]> {
  await ensureCostingSheet();
  const sheets = await getGoogleSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${COSTING_SHEET}'!A:ZZ`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const all = res.data.values ?? [];
  if (all.length < 2) return [];
  const headers = all[0] as string[];
  return all
    .slice(1)
    .map((row) => normalizeCostingRow(rowToObject(headers, row)))
    .filter((r) => r.id && r.item_name);
}

async function appendCostingRow(obj: Record<string, any>): Promise<void> {
  const sheets = await getGoogleSheetsClient();
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${COSTING_SHEET}'!A:A`,
  });
  const startRow = (existing.data.values?.length ?? 0) + 1;
  const rowValues = objectToRow([...COSTING_HEADERS], obj);
  const endCol = sheetColLetter(COSTING_HEADERS.length - 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${COSTING_SHEET}'!A${startRow}:${endCol}${startRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowValues] },
  });
}

async function updateCostingRowById(id: string, updates: Record<string, any>): Promise<void> {
  const sheets = await getGoogleSheetsClient();
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${COSTING_SHEET}'!A1:ZZ1`,
  });
  const headers = (headerRes.data.values?.[0] as string[]) ?? [...COSTING_HEADERS];
  const idCol = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${COSTING_SHEET}'!A:A`,
  });
  const rows = idCol.data.values ?? [];
  const rowIndex = rows.findIndex((r) => String(r[0]) === String(id));
  if (rowIndex === -1) throw new Error('Costing record not found');
  const actualRow = rowIndex + 1;
  const data = Object.entries(updates)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      const colIndex = headers.findIndex(
        (h) => String(h || '').toLowerCase() === key.toLowerCase()
      );
      if (colIndex === -1) return null;
      return {
        range: `'${COSTING_SHEET}'!${sheetColLetter(colIndex)}${actualRow}`,
        values: [[value ?? '']],
      };
    })
    .filter(Boolean);
  if (data.length === 0) throw new Error('Nothing to update');
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: data as any[] },
  });
}

export async function createCostingRecord(input: {
  item_name: string;
  item_code?: string;
  ims_type?: string;
  cost_price: number;
  user?: string;
}): Promise<CostingRecord> {
  await ensureCostingSheet();
  const item_name = String(input.item_name || '').trim();
  if (!item_name) throw new Error('item_name is required');
  const cost_price = Number(input.cost_price);
  if (!Number.isFinite(cost_price) || cost_price < 0) throw new Error('Valid cost_price is required');

  const existing = await listCostingRecords();
  const dup = existing.find(
    (r) =>
      r.item_name.toLowerCase() === item_name.toLowerCase() &&
      String(r.item_code || '').toLowerCase() === String(input.item_code || '').toLowerCase()
  );
  if (dup) throw new Error('A cost entry for this item already exists. Edit it instead.');

  const now = formatToSheetDate(new Date());
  const record = {
    id: sheetNewId('cost'),
    item_name,
    item_code: String(input.item_code || '').trim(),
    ims_type: String(input.ims_type || '').trim(),
    cost_price,
    created_at: now,
    updated_at: now,
    created_by: input.user || '',
    updated_by: input.user || '',
  };
  await appendCostingRow(record);
  return normalizeCostingRow(record);
}

export async function updateCostingRecord(
  id: string,
  input: {
    item_name?: string;
    item_code?: string;
    ims_type?: string;
    cost_price?: number;
    user?: string;
  }
): Promise<CostingRecord> {
  await ensureCostingSheet();
  const rows = await listCostingRecords();
  const current = rows.find((r) => r.id === id);
  if (!current) throw new Error('Costing record not found');

  const item_name = input.item_name !== undefined ? String(input.item_name).trim() : current.item_name;
  const item_code = input.item_code !== undefined ? String(input.item_code).trim() : current.item_code;
  const cost_price =
    input.cost_price !== undefined ? Number(input.cost_price) : current.cost_price;
  if (!item_name) throw new Error('item_name is required');
  if (!Number.isFinite(cost_price) || cost_price < 0) throw new Error('Valid cost_price is required');

  const dup = rows.find(
    (r) =>
      r.id !== id &&
      r.item_name.toLowerCase() === item_name.toLowerCase() &&
      String(r.item_code || '').toLowerCase() === item_code.toLowerCase()
  );
  if (dup) throw new Error('Another row already uses this item name and code.');

  const now = formatToSheetDate(new Date());
  await updateCostingRowById(id, {
    item_name,
    item_code,
    ims_type: input.ims_type !== undefined ? String(input.ims_type).trim() : current.ims_type,
    cost_price,
    updated_at: now,
    updated_by: input.user || '',
  });
  return {
    ...current,
    item_name,
    item_code,
    ims_type: input.ims_type !== undefined ? String(input.ims_type).trim() : current.ims_type,
    cost_price,
    updated_at: now,
    updated_by: input.user || current.updated_by,
  };
}

export async function deleteCostingRecord(id: string): Promise<void> {
  await ensureCostingSheet();
  const sheets = await getGoogleSheetsClient();
  const idCol = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${COSTING_SHEET}'!A:A`,
  });
  const rows = idCol.data.values ?? [];
  const rowIndex = rows.findIndex((r) => String(r[0]) === String(id));
  if (rowIndex === -1) throw new Error('Costing record not found');
  const sheetId = await getSheetId(sheets, COSTING_SHEET);
  if (sheetId == null) throw new Error('Costing sheet not found');
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });
}