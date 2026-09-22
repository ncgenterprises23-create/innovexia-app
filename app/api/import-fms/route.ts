import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import {
    getImportFMSData,
    createImportFMSData,
    updateImportFMSData,
    deleteImportFMSData
} from '@/lib/sheets';

export async function GET() {
    try {
        const data = await getImportFMSData();
        return NextResponse.json({ data });
    } catch (error: any) {
        console.error('Error fetching Import FMS data:', error);
        return NextResponse.json({ error: 'Failed to fetch data', details: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const records = Array.isArray(body) ? body : [body];

        if (records.length === 0) {
            return NextResponse.json({ error: 'At least one record is required' }, { status: 400 });
        }

        const validRecords = records.filter(rec =>
            String(rec.Item_name || rec.item_name || rec.itemName || '').trim()
        );
        if (validRecords.length === 0) {
            return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
        }

        const result = await createImportFMSData(validRecords);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error adding Import FMS records:', error);
        return NextResponse.json({ error: 'Failed to add records', details: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const result = await updateImportFMSData(id, body);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error updating Import FMS record:', error);
        return NextResponse.json({ error: 'Failed to update record', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const result = await deleteImportFMSData(id);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error deleting Import FMS record:', error);
        return NextResponse.json({ error: 'Failed to delete record', details: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const { id, cancelled } = await request.json();
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const result = await updateImportFMSData(id, { Cancelled: cancelled ? 'Yes' : '' });
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error cancelling Import FMS record:', error);
        return NextResponse.json({ error: 'Failed to cancel record', details: error.message }, { status: 500 });
    }
}
