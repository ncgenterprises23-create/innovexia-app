import { NextResponse } from 'next/server';
import {
    getIgstRefundData,
    createIgstRefundData,
    updateIgstRefundData,
    deleteIgstRefundData
} from '@/lib/sheets';

export async function GET() {
    try {
        const data = await getIgstRefundData();
        return NextResponse.json({ data });
    } catch (error: any) {
        console.error('Error fetching IGST Refund data:', error);
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

        const validRecords = records.filter(rec => rec.Shipping_Bill_No?.trim());
        if (validRecords.length === 0) {
            return NextResponse.json({ error: 'Shipping_Bill_No is required for all records' }, { status: 400 });
        }

        const result = await createIgstRefundData(validRecords);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error adding IGST Refund records:', error);
        return NextResponse.json({ error: 'Failed to add records', details: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { Id } = body; // Note: Use 'Id' to match the sheet header or just handle it below. Wait, let me check. Actually the DB usually expects 'id'. We map 'Id' or 'id'. Let's use 'id' because the UI often uses lower case.
        // Wait, the page.tsx sends 'id'.
        const targetId = body.id || body.Id;

        if (!targetId) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const result = await updateIgstRefundData(targetId, body);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error updating IGST Refund record:', error);
        return NextResponse.json({ error: 'Failed to update record', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { id, Id } = await request.json();
        const targetId = id || Id;
        if (!targetId) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const result = await deleteIgstRefundData(targetId);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error deleting IGST Refund record:', error);
        return NextResponse.json({ error: 'Failed to delete record', details: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const { id, Id, cancelled } = await request.json();
        const targetId = id || Id;
        if (!targetId) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const result = await updateIgstRefundData(targetId, { Cancelled: cancelled ? 'Yes' : '' });
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error cancelling IGST Refund record:', error);
        return NextResponse.json({ error: 'Failed to cancel record', details: error.message }, { status: 500 });
    }
}
