import { NextResponse } from 'next/server';
import {
    getSalesExportPurchaseEnquiryFMSData,
    createSalesExportPurchaseEnquiryFMSData,
    updateSalesExportPurchaseEnquiryFMSData,
    deleteSalesExportPurchaseEnquiryFMSData
} from '@/lib/sheets';

export async function GET() {
    try {
        const data = await getSalesExportPurchaseEnquiryFMSData();
        return NextResponse.json({ data });
    } catch (error: any) {
        console.error('Error fetching Sales Export Purchase Enquiry FMS data:', error);
        return NextResponse.json({ error: 'Failed to fetch data', details: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const items = Array.isArray(body) ? body : [body];

        if (items.length === 0) {
            return NextResponse.json({ error: 'At least one record is required' }, { status: 400 });
        }

        const result = await createSalesExportPurchaseEnquiryFMSData(items);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error adding Sales Export Purchase Enquiry FMS records:', error);
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

        const result = await updateSalesExportPurchaseEnquiryFMSData(id, body);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error updating Sales Export Purchase Enquiry FMS record:', error);
        return NextResponse.json({ error: 'Failed to update record', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const result = await deleteSalesExportPurchaseEnquiryFMSData(id);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error deleting Sales Export Purchase Enquiry FMS record:', error);
        return NextResponse.json({ error: 'Failed to delete record', details: error.message }, { status: 500 });
    }
}
