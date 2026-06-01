import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import {
    getExportFMSData,
    createExportFMSData,
    updateExportFMSData,
    deleteExportFMSData
} from '@/lib/sheets';

export async function GET() {
    try {
        const data = await getExportFMSData();
        return NextResponse.json({ data });
    } catch (error: any) {
        console.error('Error fetching Export FMS data:', error);
        return NextResponse.json({ error: 'Failed to fetch data', details: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const exports = Array.isArray(body) ? body : [body];

        if (exports.length === 0) {
            return NextResponse.json({ error: 'At least one record is required' }, { status: 400 });
        }

        const validExports = exports.filter(exp => exp.piNumber?.trim());
        if (validExports.length === 0) {
            return NextResponse.json({ error: 'PI Number is required for all records' }, { status: 400 });
        }

        const result = await createExportFMSData(validExports);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error adding Export FMS records:', error);
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

        const result = await updateExportFMSData(id, body);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error updating Export FMS record:', error);
        return NextResponse.json({ error: 'Failed to update record', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const result = await deleteExportFMSData(id);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error deleting Export FMS record:', error);
        return NextResponse.json({ error: 'Failed to delete record', details: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const { id, cancelled } = await request.json();
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const result = await updateExportFMSData(id, { Cancelled: cancelled ? 'Yes' : '' });
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error cancelling Export FMS record:', error);
        return NextResponse.json({ error: 'Failed to cancel record', details: error.message }, { status: 500 });
    }
}
