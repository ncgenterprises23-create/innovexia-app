import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import {
    getProductFMSData,
    createProductFMSData,
    updateProductFMSData,
    deleteProductFMSData
} from '@/lib/sheets';

export async function GET() {
    try {
        const result = await getProductFMSData();
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error fetching Product FMS data:', error);
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

        const result = await createProductFMSData(records);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error adding Product FMS records:', error);
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

        const result = await updateProductFMSData(id, body);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error updating Product FMS record:', error);
        return NextResponse.json({ error: 'Failed to update record', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const result = await deleteProductFMSData(id);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error deleting Product FMS record:', error);
        return NextResponse.json({ error: 'Failed to delete record', details: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const { id, cancelled } = await request.json();
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const result = await updateProductFMSData(id, { Cancelled: cancelled ? 'Yes' : '' });
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error cancelling Product FMS record:', error);
        return NextResponse.json({ error: 'Failed to cancel record', details: error.message }, { status: 500 });
    }
}
