import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/oauth';

const SHEET_ID = '1ML6ZOBSEqz58aozo_lyUsRdKjDmkzS-qW5B8Ej5dcXQ';
const SHEET_NAME = 'Daily Production';
const RANGE = `'Daily Production'!A:F`; // ID, Date, Department, Production Name, Category, Qty

async function ensureHeaders(sheets: any) {
  try {
    const currentData = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RANGE,
    });

    const rows = currentData.data.values || [];
    if (rows.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `'Daily Production'!A1:F1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['ID', 'Date', 'Department', 'Production Name', 'Category', 'Qty']],
        },
      });
    }
  } catch (error: any) {
    if (error.message && error.message.includes('Unable to parse range')) {
       // If sheet doesn't exist, try to create it then add headers
       await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SHEET_ID,
          requestBody: {
            requests: [{ addSheet: { properties: { title: SHEET_NAME } } }]
          }
       });
       await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `'Daily Production'!A1:F1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['ID', 'Date', 'Department', 'Production Name', 'Category', 'Qty']],
        },
      });
    } else {
      throw error;
    }
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
      return NextResponse.json({ production: [] });
    }

    const production = rows.slice(1).map((row, index) => ({
      id: row[0] || crypto.randomUUID(),
      date: row[1] || '',
      department: row[2] || '',
      productionName: row[3] || '',
      category: row[4] || '',
      qty: parseInt(row[5]) || 0,
      rowIndex: index + 2, 
    })).filter((a: any) => a.productionName); 

    return NextResponse.json({ production });
  } catch (error: any) {
    console.error('Error fetching production:', error);
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
          record.department, 
          record.productionName, 
          record.category,
          record.qty
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
      // Single insert fallback
      const { date, department, productionName, category, qty } = payload;
      const newId = crypto.randomUUID();
      
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: RANGE,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[newId, date, department, productionName, category, qty]],
        },
      });

      return NextResponse.json({ 
        id: newId, date, department, productionName, category, qty 
      }, { status: 201 });
    }
  } catch (error: any) {
    console.error('Error creating production entry:', error);
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
    console.error('Error deleting production entry:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
