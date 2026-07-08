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
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:J`,
    });

    const rows = response.data.values || [];
    const data = rows.map((row: any) => ({
      timestamp: row[0] || '',
      date: row[1] || '',
      week: row[2] || '',
      month: row[3] || '',
      quarter: row[4] || '',
      year: row[5] || '',
      rawMaterial: row[6] || '',
      liveStock: parseFloat(row[7]) || 0,
      actualStock: parseFloat(row[8]) || 0,
      diff: parseFloat(row[9]) || 0
    }));

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
      range: `${SHEET_NAME}!A1:J1`,
    }).catch(e => {
        console.error("Error getting headers", e);
        return null;
    });

    const headers = headerResponse?.data?.values?.[0] || [];

    if (headers.length === 0) {
      const defaultHeaders = ['Timestamp', 'Date', 'Week', 'Month', 'Quarter', 'Year', 'Raw Materials', 'Live Stock', 'Actual Stock', 'Diff'];
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:J1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [defaultHeaders],
        },
      });
    }

    const timestamp = formatToSheetDate(new Date());
    const formattedDate = dateObj.toISOString().split('T')[0];

    // Prepare rows
    const rowsToAppend = items.map((item: any) => [
      timestamp,
      formattedDate,
      `W${week}`,
      month,
      `Q${quarter}`,
      year,
      item.rawMaterial,
      item.liveStock || 0,
      item.actualStock || 0,
      item.diff || 0
    ]);

    if (rowsToAppend.length > 0) {
        await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:J`,
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
