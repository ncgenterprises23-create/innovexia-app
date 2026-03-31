import { NextResponse } from 'next/server';
import { getGoogleSheetsClient, rowToObject, objectToRow } from '@/lib/sheets';

const COLLECTION_SPREADSHEET_ID = '1aouY4Y9J8haBehMHvmwRFNDhx4ugR2X0Ohrhnre7MXI';
const MAIN_SHEET_NAME = 'Party Collection';
const FOLLOWUP_SHEET_NAME = 'Collection Follow Up';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const collectionId = searchParams.get('id');
        const sheets = await getGoogleSheetsClient();

        if (collectionId) {
            // Fetch history for a specific ID
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: COLLECTION_SPREADSHEET_ID,
                range: `${FOLLOWUP_SHEET_NAME}!A:Z`,
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                return NextResponse.json({ data: [] });
            }

            const headers = rows[0].map((h: string) => h.trim());
            const idIndex = headers.indexOf('collection_id');
            if (idIndex === -1) return NextResponse.json({ data: [] });

            const history = rows.slice(1)
                .filter(row => (row[idIndex] || '').toString().trim() === collectionId.toString().trim())
                .map(row => rowToObject(headers, row));

            return NextResponse.json({ data: history });
        } else {
            // Fetch main collection data
            const [mainResponse, followupResponse] = await Promise.all([
                sheets.spreadsheets.values.get({
                    spreadsheetId: COLLECTION_SPREADSHEET_ID,
                    range: `${MAIN_SHEET_NAME}!A:Z`,
                }),
                sheets.spreadsheets.values.get({
                    spreadsheetId: COLLECTION_SPREADSHEET_ID,
                    range: `${FOLLOWUP_SHEET_NAME}!A:Z`,
                }).catch(() => ({ data: { values: [] } })) // Fallback if sheet not found
            ]);

            const mainRows = mainResponse.data.values;
            if (!mainRows || mainRows.length === 0) {
                return NextResponse.json({ data: [] });
            }

            const followupRows = followupResponse.data.values || [];
            const mainHeaders = mainRows[0].map((h: string) => h.trim());

            let followupData: any[] = [];
            if (followupRows.length > 0) {
                const followupHeaders = followupRows[0].map((h: string) => h.trim());
                followupData = followupRows.slice(1).map(row => rowToObject(followupHeaders, row));
            }

            const data = mainRows.slice(1).map(row => {
                const obj = rowToObject(mainHeaders, row);
                const history = followupData.filter(h => (h.collection_id || '').toString().trim() === (obj.Id || '').toString().trim());
                obj['Follow Up'] = history;
                return obj;
            });

            return NextResponse.json({ data });
        }
    } catch (error: any) {
        console.error('Error fetching collection data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch data', details: error.message },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const { id, followUp } = await request.json();
        if (!id || !followUp) {
            return NextResponse.json({ error: 'ID and follow-up data required' }, { status: 400 });
        }

        const sheets = await getGoogleSheetsClient();

        // 1. Ensure Follow Up sheet exists and has headers
        let headers: string[] = [];
        try {
            const headerResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: COLLECTION_SPREADSHEET_ID,
                range: `${FOLLOWUP_SHEET_NAME}!A1:Z1`,
            });
            headers = headerResponse.data.values?.[0]?.map((h: string) => h.trim()) || [];
        } catch (e) {
            console.log('Follow up sheet headers fetch failed, may need initialization');
        }

        if (headers.length === 0) {
            headers = ['id', 'collection_id', 'remark', 'next_followup', 'timestamp', 'target_due_date'];
        } else if (!headers.includes('target_due_date')) {
            // Add column if missing
            headers.push('target_due_date');
            await sheets.spreadsheets.values.update({
                spreadsheetId: COLLECTION_SPREADSHEET_ID,
                range: `${FOLLOWUP_SHEET_NAME}!A1`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [headers],
                },
            });
        }

        // 2. Prepare new entry
        const timestamp = new Date().toISOString();
        const newEntry = {
            id: Date.now().toString(),
            collection_id: id,
            remark: followUp.remark,
            next_followup: followUp.next_followup || '',
            timestamp: timestamp,
            target_due_date: followUp.target_due_date || ''
        };

        const rowData = objectToRow(headers, newEntry);

        // 3. Append to Follow Up sheet
        await sheets.spreadsheets.values.append({
            spreadsheetId: COLLECTION_SPREADSHEET_ID,
            range: `${FOLLOWUP_SHEET_NAME}!A:Z`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [rowData],
            },
        });

        return NextResponse.json({ success: true, data: newEntry });
    } catch (error: any) {
        console.error('Error adding follow-up:', error);

        // If sheet not found, it might be the reason.
        if (error.message?.includes('Range not found') || error.message?.includes('not found')) {
            return NextResponse.json(
                { error: 'Follow up sheet not found. Please create a sheet named "Collection Follow Up".' },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to add follow-up', details: error.message },
            { status: 500 }
        );
    }
}
