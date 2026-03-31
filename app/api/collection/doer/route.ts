import { NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/sheets';

const COLLECTION_SPREADSHEET_ID = '1aouY4Y9J8haBehMHvmwRFNDhx4ugR2X0Ohrhnre7MXI';
const DOER_SHEET_NAME = 'Doer';

export async function GET() {
    try {
        const sheets = await getGoogleSheetsClient();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: COLLECTION_SPREADSHEET_ID,
            range: `${DOER_SHEET_NAME}!A1`,
        });

        const value = response.data.values?.[0]?.[0] || '';
        return NextResponse.json({ doer: value });
    } catch (error: any) {
        console.error('Error fetching doer:', error);
        return NextResponse.json({ doer: '' }); // Return empty if sheet doesn't exist yet
    }
}

export async function POST(request: Request) {
    try {
        const { doer } = await request.json();
        if (!doer) {
            return NextResponse.json({ error: 'Doer name is required' }, { status: 400 });
        }

        const sheets = await getGoogleSheetsClient();

        // Ensure sheet exists by trying to update A1
        try {
            await sheets.spreadsheets.values.update({
                spreadsheetId: COLLECTION_SPREADSHEET_ID,
                range: `${DOER_SHEET_NAME}!A1`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [[doer]],
                },
            });
        } catch (error: any) {
             // If sheet doesn't exist, we might need to create it.
             // However, values.update usually works if the sheet name is valid in the range.
             // If it fails with "range not found", we should ideally create the sheet.
             if (error.message?.includes('Range not found')) {
                 // Create the sheet first
                 await sheets.spreadsheets.batchUpdate({
                     spreadsheetId: COLLECTION_SPREADSHEET_ID,
                     requestBody: {
                         requests: [{ addSheet: { properties: { title: DOER_SHEET_NAME } } }]
                     }
                 });
                 // Then update
                 await sheets.spreadsheets.values.update({
                     spreadsheetId: COLLECTION_SPREADSHEET_ID,
                     range: `${DOER_SHEET_NAME}!A1`,
                     valueInputOption: 'RAW',
                     requestBody: {
                         values: [[doer]],
                     },
                 });
             } else {
                 throw error;
             }
        }

        return NextResponse.json({ success: true, doer });
    } catch (error: any) {
        console.error('Error updating doer:', error);
        return NextResponse.json(
            { error: 'Failed to update doer', details: error.message },
            { status: 500 }
        );
    }
}
