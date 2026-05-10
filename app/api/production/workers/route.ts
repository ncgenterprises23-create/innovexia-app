import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/oauth';

const SHEET_ID = '1ML6ZOBSEqz58aozo_lyUsRdKjDmkzS-qW5B8Ej5dcXQ';
const SHEET_NAME = 'Worker Information';
const RANGE = `'Worker Information'!A:G`; // ID, Worker Name, Department, Salary, Incentive, Gender, OT Rate

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
      range: `'Worker Information'!A1:G1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['ID', 'Worker Name', 'Department', 'Salary', 'Incentive', 'Male/Female', 'OT Amt/Hour']],
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
      id: row[0] || crypto.randomUUID(), 
      workerName: row[1] || '',
      department: row[2] || '',
      salary: row[3] || '',
      incentive: row[4] || 'No',
      gender: row[5] || 'Male',
      otRate: row[6] || '40',
      rowIndex: index + 2, 
    })).filter(w => w.workerName); 

    return NextResponse.json({ workers });
  } catch (error: any) {
    console.error('Error fetching workers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workerName, department, salary, incentive, gender, otRate } = await req.json();
    const sheets = await getGoogleSheetsClient();
    await ensureHeaders(sheets);

    const newId = crypto.randomUUID();
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: RANGE,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[newId, workerName, department, salary, incentive || 'No', gender || 'Male', otRate || '40']],
      },
    });

    return NextResponse.json({ id: newId, workerName, department, salary, incentive: incentive || 'No', gender, otRate }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating worker:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, workerName, department, salary, incentive, gender, otRate, rowIndex } = await req.json();
    
    if (!rowIndex) {
      return NextResponse.json({ error: 'Missing rowIndex for update' }, { status: 400 });
    }

    const sheets = await getGoogleSheetsClient();
    await ensureHeaders(sheets);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'Worker Information'!A${rowIndex}:G${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[id, workerName, department, salary, incentive || 'No', gender || 'Male', otRate || '40']],
      },
    });

    return NextResponse.json({ id, workerName, department, salary, incentive: incentive || 'No', gender, otRate, rowIndex });
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
