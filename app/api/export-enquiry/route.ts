import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import {
    getExportEnquiryData,
    createExportEnquiryData,
    updateExportEnquiryData,
    deleteExportEnquiryData,
} from '@/lib/sheets';

export async function GET() {
    try {
        const result = await getExportEnquiryData();
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error fetching Export Enquiry data:', error);
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

        const result = await createExportEnquiryData(records);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error adding Export Enquiry records:', error);
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

        const result = await updateExportEnquiryData(id, body);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error updating Export Enquiry record:', error);
        return NextResponse.json({ error: error.message || 'Failed to update record', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const result = await deleteExportEnquiryData(id);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error deleting Export Enquiry record:', error);
        return NextResponse.json({ error: 'Failed to delete record', details: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const { id, cancelled, cancelledReason } = await request.json();
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const result = await updateExportEnquiryData(id, {
            Cancelled: cancelled ? 'Yes' : '',
            'Cancelled Reason': cancelled ? String(cancelledReason || '').trim() : '',
        });
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error cancelling Export Enquiry record:', error);
        return NextResponse.json({ error: 'Failed to cancel record', details: error.message }, { status: 500 });
    }
}
