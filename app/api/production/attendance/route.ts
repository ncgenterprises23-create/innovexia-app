import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/oauth';

const SHEET_ID = '1ML6ZOBSEqz58aozo_lyUsRdKjDmkzS-qW5B8Ej5dcXQ';
const SHEET_NAME = 'Worker Attendance';
const RANGE = `'Worker Attendance'!A:H`; // ID, Date, Worker Name, Assigned Department, Borrowed Department, Time In, Time Out, OT Hours

async function ensureHeaders(sheets: any) {
  const currentData = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: RANGE,
  });

  const rows = currentData.data.values || [];
  if (rows.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'Worker Attendance'!A1:G1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['ID', 'Date', 'Worker Name', 'Assigned Department', 'Borrowed Department', 'Time In', 'Time Out', 'OT Hours']],
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
      return NextResponse.json({ attendance: [] });
    }

    const attendance = rows.slice(1).map((row, index) => ({
      id: row[0] || crypto.randomUUID(),
      date: row[1] || '',
      workerName: row[2] || '',
      assignedDepartment: row[3] || '',
      borrowedDepartment: row[4] || '',
      timeIn: row[5] || '',
      timeOut: row[6] || '',
      otHours: row[7] || '',
      rowIndex: index + 2, 
    })).filter(a => a.workerName); 

    return NextResponse.json({ attendance });
  } catch (error: any) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const sheets = await getGoogleSheetsClient();
    await ensureHeaders(sheets);

    if (Array.isArray(payload)) {
      // Bulk insert
      const rowsToInsert = payload.map(record => {
        const newId = crypto.randomUUID();
        return [
          newId, 
          record.date, 
          record.workerName, 
          record.assignedDepartment, 
          record.borrowedDepartment || '', 
          record.timeIn || '', 
          record.timeOut || '',
          record.otHours || ''
        ];
      });

      if (rowsToInsert.length === 0) {
         return NextResponse.json({ message: 'No records to insert' }, { status: 200 });
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: RANGE,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: rowsToInsert,
        },
      });

      return NextResponse.json({ success: true, count: rowsToInsert.length }, { status: 201 });
    } else {
      // Single insert
      const { date, workerName, assignedDepartment, borrowedDepartment, timeIn, timeOut, otHours } = payload;
      const newId = crypto.randomUUID();
      
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: RANGE,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[newId, date, workerName, assignedDepartment, borrowedDepartment || '', timeIn || '', timeOut || '', otHours || '']],
        },
      });

      return NextResponse.json({ 
        id: newId, date, workerName, assignedDepartment, borrowedDepartment, timeIn, timeOut, otHours 
      }, { status: 201 });
    }
  } catch (error: any) {
    console.error('Error creating attendance:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, date, workerName, assignedDepartment, borrowedDepartment, timeIn, timeOut, otHours, rowIndex } = await req.json();
    
    if (!rowIndex) {
      return NextResponse.json({ error: 'Missing rowIndex for update' }, { status: 400 });
    }

    const sheets = await getGoogleSheetsClient();
    await ensureHeaders(sheets);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'Worker Attendance'!A${rowIndex}:H${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[id, date, workerName, assignedDepartment, borrowedDepartment || '', timeIn || '', timeOut || '', otHours || '']],
      },
    });

    return NextResponse.json({ id, date, workerName, assignedDepartment, borrowedDepartment, timeIn, timeOut, otHours, rowIndex });
  } catch (error: any) {
    console.error('Error updating attendance:', error);
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
      (s: any) => s.properties?.title === SHEET_NAME
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
    console.error('Error deleting attendance:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
