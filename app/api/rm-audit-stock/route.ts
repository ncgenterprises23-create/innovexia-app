import { NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/sheets';
import { formatToSheetDate } from '@/lib/dateUtils';

const SPREADSHEET_ID = '1oBzFA0jtNhFhJ7jZBz-O-HsiEcNN2mm05W1QgNTeRgg';
const SHEET_NAME = 'Audit Stock';

const getWeekNumber = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
    return weekNo;
};
export async function GET() {
  try {
    const sheets = await getGoogleSheetsClient();

    // Read header row to determine columns (robust to column order)
    const headerResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:Z1`,
    }).catch(e => {
      console.error("Error fetching headers for GET", e);
      return null;
    });

    const headers: string[] = (headerResp?.data?.values?.[0] || []).map((h: any) => String(h || '').trim());

    // Read all data rows
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:Z`,
    });

    const rows = response.data.values || [];

    // Helper to safely get by header name (case-insensitive)
    const idxOf = (name: string) => {
      const lc = name.toLowerCase();
      return headers.findIndex(h => String(h || '').toLowerCase() === lc);
    };

    const data = rows.map((row: any) => {
      const get = (name: string) => {
        const idx = idxOf(name);
        return idx >= 0 ? row[idx] : undefined;
      };

      const timestamp = get('Timestamp') || '';
      const date = get('Date') || '';
      const week = get('Week') || '';
      const month = get('Month') || '';
      const quarter = get('Quarter') || '';
      const year = get('Year') || '';
      const rawMaterial = get('Raw Materials') || get('Raw Material') || '';
      const liveStock = parseFloat(get('Live Stock') || get('Live') || 0) || 0;
      const actualStock = parseFloat(get('Actual Stock') || get('Actual') || 0) || 0;
      const diff = parseFloat(get('Diff') || 0) || 0;
      const unit = get('Unit') || '';
      const category = get('Category') || '';

      return {
        timestamp,
        date,
        week,
        month,
        quarter,
        year,
        rawMaterial,
        liveStock,
        actualStock,
        diff,
        unit,
        category
      };
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching RM Audit Stock:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch data' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { date, items } = data;

    if (!date || !items || !Array.isArray(items)) {
      return NextResponse.json({ success: false, error: 'Invalid data format' }, { status: 400 });
    }

    const sheets = await getGoogleSheetsClient();
    const dateObj = new Date(date);
    const month = dateObj.toLocaleString('default', { month: 'short' });
    const year = dateObj.getFullYear();
    const quarter = Math.ceil((dateObj.getMonth() + 1) / 3);
    const week = getWeekNumber(dateObj);

    // Ensure headers exist
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:Z1`,
    }).catch(e => {
        console.error("Error getting headers", e);
        return null;
    });

    const headers = headerResponse?.data?.values?.[0] || [];

    // If no headers exist, create sensible defaults including Category and Unit
    if (headers.length === 0) {
      const defaultHeaders = ['Timestamp', 'Date', 'Week', 'Month', 'Quarter', 'Year', 'Raw Materials', 'Category', 'Live Stock', 'Actual Stock', 'Diff', 'Unit'];
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:L1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [defaultHeaders],
        },
      });
      // refresh headers variable
      const refreshed = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAME}!A1:Z1` });
      headers.splice(0, headers.length, ...(refreshed.data.values?.[0] || []));
    }

    const timestamp = formatToSheetDate(new Date());
    const formattedDate = dateObj.toISOString().split('T')[0];

    // Build rows according to existing headers to be idempotent and robust
    const headerNames: string[] = headers.map((h: any) => String(h || '').trim());

    const rowsToAppend = items.map((item: any) => {
      const fieldValues: Record<string, any> = {
        'Timestamp': timestamp,
        'Date': formattedDate,
        'Week': `W${week}`,
        'Month': month,
        'Quarter': `Q${quarter}`,
        'Year': year,
        'Raw Materials': item.rawMaterial,
        'Raw Material': item.rawMaterial,
        'Category': item.category || 'Others',
        'Live Stock': item.liveStock || 0,
        'Live': item.liveStock || 0,
        'Actual Stock': item.actualStock || 0,
        'Actual': item.actualStock || 0,
        'Diff': item.diff || 0,
        'Unit': item.unit || ''
      };

      // Map header order to values (fallback to empty string)
      return headerNames.map(h => fieldValues[h] ?? '');
    });

    if (rowsToAppend.length > 0) {
        await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: rowsToAppend,
        },
        });
    }

    return NextResponse.json({ success: true, message: 'Data saved successfully' });
  } catch (error: any) {
    console.error('Error saving RM Audit Stock:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save data' },
      { status: 500 }
    );
  }
}
