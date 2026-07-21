import { NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/sheets';

const SPREADSHEET_ID = '1oBzFA0jtNhFhJ7jZBz-O-HsiEcNN2mm05W1QgNTeRgg';
const CATEGORY_SHEET = 'Category';

export async function GET() {
  try {
    const sheets = await getGoogleSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CATEGORY_SHEET}!A2:B`,
    });

    const rows = response.data.values || [];
    const mapping = rows.map((r: any) => ({
      itemName: (r[0] || '').toString().trim(),
      category: (r[1] || '').toString().trim() || 'Others'
    }));

    return NextResponse.json({ mapping });
  } catch (error: any) {
    console.error('Error fetching Category sheet:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch categories' }, { status: 500 });
  }
}

