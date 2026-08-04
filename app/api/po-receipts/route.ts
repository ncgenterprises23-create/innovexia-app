import { NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/sheets';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sheetId = searchParams.get('sheetId') || '1c51Nga9MgU1u41COK3eiEUUfZlTKhL6WjwEu4c__cb8';
    const sheetName = searchParams.get('sheetName') || 'Sheet1';

    const sheets = await getGoogleSheetsClient();
    const range = `'${sheetName}'!A:Z`;
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const rows = resp.data.values || [];
    if (!rows.length) return NextResponse.json({ mapping: {} });

    // Assume row 0 is header; but fall back to positional columns if header missing
    const headerRow = rows[0].map((h: any) => String(h || '').trim().toLowerCase());
    const mapping: Record<string, { received: number; pending: number }> = {};

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      // PO number - prefer header lookup for common names else column B (index 1)
      const poIndex =
        headerRow.indexOf('po no') >= 0
          ? headerRow.indexOf('po no')
          : headerRow.indexOf('po') >= 0
          ? headerRow.indexOf('po')
          : 1;
      const receivedIndex =
        headerRow.indexOf('received qty') >= 0
          ? headerRow.indexOf('received qty')
          : headerRow.indexOf('received') >= 0
          ? headerRow.indexOf('received')
          : 6; // G
      const pendingIndex =
        headerRow.indexOf('pending qty') >= 0
          ? headerRow.indexOf('pending qty')
          : headerRow.indexOf('pending') >= 0
          ? headerRow.indexOf('pending')
          : 7; // H

      const po = String(row[poIndex] || '').trim();
      if (!po) continue;
      const received = Number(row[receivedIndex] ?? 0) || 0;
      const pending = Number(row[pendingIndex] ?? 0) || 0;
      mapping[po] = { received, pending };
    }

    return NextResponse.json({ mapping });
  } catch (error: any) {
    console.error('Error fetching PO receipts:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch PO receipts' }, { status: 500 });
  }
}

