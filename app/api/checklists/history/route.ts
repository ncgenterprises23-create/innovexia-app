import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/sheets';
import { SPREADSHEET_IDS } from '@/lib/sheets';

// Helper function to convert array to object based on header row
function rowToObject(headers: string[], row: any[]): any {
  const obj: any = {};
  headers.forEach((header, index) => {
    obj[header] = row[index] === '' ? null : row[index];
  });
  return obj;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const checklistId = searchParams.get('checklistId');

    if (!checklistId) {
      return NextResponse.json(
        { error: 'Checklist ID is required' },
        { status: 400 }
      );
    }

    const sheets = await getGoogleSheetsClient();
    const sheetName = 'checklist_revision_history';

    // Try to read the sheet
    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_IDS.CHECKLISTS,
        range: `${sheetName}!A:Z`,
      });
    } catch (error) {
      // Sheet doesn't exist yet
      return NextResponse.json({ history: [] });
    }

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ history: [] });
    }

    const headers = rows[0].map((h: any) => String(h || '').trim());
    const dataRows = rows.slice(1);

    const history = dataRows
      .map(row => rowToObject(headers, row))
      .filter(record => {
        const expectedGroup = `chk_${checklistId}`;
        const recordGroup = String(record.group_id || '').trim();
        if (recordGroup && (recordGroup === expectedGroup || recordGroup === String(checklistId))) {
          return true;
        }
        const recordId = record.checklist_id || record.id;
        return parseInt(recordId) === parseInt(checklistId);
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ history });
  } catch (error) {
    console.error('Error fetching checklist history from Google Sheets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
