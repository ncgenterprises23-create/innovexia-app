import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/oauth';

const SHEET_ID = '1ML6ZOBSEqz58aozo_lyUsRdKjDmkzS-qW5B8Ej5dcXQ';
const SHEET_NAME = 'Worker Information';
const RANGE = `'Worker Information'!A:D`; // ID, Worker Name, Department, Salary

// Helper to wrap initialization
async function ensureHeaders(sheets: any) {
  const currentData = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: RANGE,
  });

  const rows = currentData.data.values || [];
  if (rows.length === 0) {
    // Write headers
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'Worker Information'!A1:D1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['ID', 'Worker Name', 'Department', 'Salary']],
      },
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    const sheets = await getGoogleSheetsClient();
    await ensureHeaders(sheets);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RANGE,
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return NextResponse.json({ workers: [] });
    }

    // Map starting from index 1 (skipping header)
    const workers = rows.slice(1).map((row, index) => ({
      id: row[0] || crypto.randomUUID(), // Fallback if missing
      workerName: row[1] || '',
      department: row[2] || '',
      salary: row[3] || '',
      rowIndex: index + 2, // 1-based, plus 1 for header
    })).filter(w => w.workerName); // exclude empty rows

    return NextResponse.json({ workers });
  } catch (error: any) {
    console.error('Error fetching workers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workerName, department, salary } = await req.json();
    const sheets = await getGoogleSheetsClient();
    await ensureHeaders(sheets);

    const newId = crypto.randomUUID();
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: RANGE,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[newId, workerName, department, salary]],
      },
    });

    return NextResponse.json({ id: newId, workerName, department, salary }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating worker:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, workerName, department, salary, rowIndex } = await req.json();
    
    if (!rowIndex) {
      return NextResponse.json({ error: 'Missing rowIndex for update' }, { status: 400 });
    }

    const sheets = await getGoogleSheetsClient();
    await ensureHeaders(sheets);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'Worker Information'!A${rowIndex}:D${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[id, workerName, department, salary]],
      },
    });

    return NextResponse.json({ id, workerName, department, salary, rowIndex });
  } catch (error: any) {
    console.error('Error updating worker:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rowIndex = searchParams.get('rowIndex');

    if (!rowIndex) {
      return NextResponse.json({ error: 'Row index is required' }, { status: 400 });
    }

    const sheets = await getGoogleSheetsClient();

    // To delete a row properly, we need the sheet ID (gid) of "Worker Information".
    // First, get the sheet details to find the sheetId.
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
    });
    
    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === SHEET_NAME
    );

    if (!sheet || sheet.properties?.sheetId === undefined) {
      return NextResponse.json({ error: 'Could not find sheet properties' }, { status: 500 });
    }

    const sheetId = sheet.properties.sheetId;
    const zeroBasedRowIndex = parseInt(rowIndex, 10) - 1;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: zeroBasedRowIndex,
                endIndex: zeroBasedRowIndex + 1,
              },
            },
          },
        ],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting worker:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
