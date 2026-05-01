import { NextResponse } from 'next/server';
import {
    getSalesExportPurchaseEnquiryFMSConfig,
    updateSalesExportPurchaseEnquiryFMSConfig
} from '@/lib/sheets';

export async function GET() {
    try {
        const config = await getSalesExportPurchaseEnquiryFMSConfig();
        return NextResponse.json({ config });
    } catch (error: any) {
        console.error('Error fetching Sales Export Purchase Enquiry FMS config:', error);
        return NextResponse.json({ error: 'Failed to fetch config', details: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const { config } = await request.json();
        if (!config || !Array.isArray(config)) {
            return NextResponse.json({ error: 'Config array is required' }, { status: 400 });
        }

        const result = await updateSalesExportPurchaseEnquiryFMSConfig(config);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error updating Sales Export Purchase Enquiry FMS config:', error);
        return NextResponse.json({ error: 'Failed to update config', details: error.message }, { status: 500 });
    }
}
