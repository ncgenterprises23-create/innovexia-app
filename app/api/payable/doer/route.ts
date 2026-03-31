import { NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/sheets';

const PAYABLE_SPREADSHEET_ID = '1z8d3C9GbwcXV4k4VCjLOUojHpLNjquUa8Fis0Wo7zro';
const DOER_SHEET_NAME = 'Doer';

export async function GET() {
    try {
        const sheets = await getGoogleSheetsClient();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: PAYABLE_SPREADSHEET_ID,
            range: `${DOER_SHEET_NAME}!A1`,
        });

        const value = response.data.values?.[0]?.[0] || '';
        return NextResponse.json({ doer: value });
    } catch (error: any) {
        console.error('Error fetching payable doer:', error);
        return NextResponse.json({ doer: '' });
    }
}

export async function POST(request: Request) {
    try {
        const { doer } = await request.json();
        if (!doer) {
            return NextResponse.json({ error: 'Doer name is required' }, { status: 400 });
        }

        const sheets = await getGoogleSheetsClient();

        try {
            await sheets.spreadsheets.values.update({
                spreadsheetId: PAYABLE_SPREADSHEET_ID,
                range: `${DOER_SHEET_NAME}!A1`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [[doer]],
                },
            });
        } catch (error: any) {
             if (error.message?.includes('Range not found')) {
                 await sheets.spreadsheets.batchUpdate({
                     spreadsheetId: PAYABLE_SPREADSHEET_ID,
                     requestBody: {
                         requests: [{ addSheet: { properties: { title: DOER_SHEET_NAME } } }]
                     }
                 });
                 await sheets.spreadsheets.values.update({
                     spreadsheetId: PAYABLE_SPREADSHEET_ID,
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
        console.error('Error updating payable doer:', error);
        return NextResponse.json(
            { error: 'Failed to update doer', details: error.message },
            { status: 500 }
        );
    }
}
