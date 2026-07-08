import { NextResponse } from 'next/server';
import { getGoogleSheetsClient, rowToObject } from '@/lib/sheets';
import { formatToSheetDate } from '@/lib/dateUtils';

const SCRAP_SALES_SPREADSHEET_ID = '1CEUQzbNoQ0rxOhpFZlHLpjnhbGPY3dGDt1MKR_UvCx8';
const SHEET_NAME = 'Scrap Sheet';

const getWeekNumber = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
    return weekNo;
};

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
      spreadsheetId: SCRAP_SALES_SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:I1`,
    }).catch(e => {
        console.error("Error getting headers", e);
        return null;
    });

    const headers = headerResponse?.data?.values?.[0] || [];

    if (headers.length === 0) {
      const defaultHeaders = ['Timestamp', 'Date', 'Week', 'Month', 'Quarter', 'Year', 'Item Description', 'Qty', 'Weight'];
      await sheets.spreadsheets.values.update({
        spreadsheetId: SCRAP_SALES_SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:I1`,
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
      item.description,
      item.qty || 0,
      item.weight || 0
    ]);

    if (rowsToAppend.length > 0) {
        await sheets.spreadsheets.values.append({
        spreadsheetId: SCRAP_SALES_SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:I`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: rowsToAppend,
        },
        });
    }

    return NextResponse.json({ success: true, message: 'Data saved successfully' });
  } catch (error: any) {
    console.error('Error saving scrap sales:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save data' },
      { status: 500 }
    );
  }
}

export async function GET() {
    try {
        const sheets = await getGoogleSheetsClient();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SCRAP_SALES_SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:I`,
            valueRenderOption: 'UNFORMATTED_VALUE',
        }).catch(e => null);

        const rows = response?.data?.values;
        
        if (!rows || rows.length <= 1) {
            return NextResponse.json({ data: [] });
        }

        const headers = rows[0];
        const dataRows = rows.slice(1);
        
        const data = dataRows.map(row => {
            const obj = rowToObject(headers, row);
            return {
                ...obj,
                qty: parseFloat(obj['Qty']) || 0,
                weight: parseFloat(obj['Weight']) || 0,
            };
        });

        return NextResponse.json({ data });
    } catch (error: any) {
        console.error('Error fetching scrap sales:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to fetch data' },
            { status: 500 }
        );
    }
}
