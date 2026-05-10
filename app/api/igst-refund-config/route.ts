import { NextResponse } from 'next/server';
import { getIgstRefundConfig, updateIgstRefundConfig } from '@/lib/sheets';

export async function GET() {
    try {
        const config = await getIgstRefundConfig();
        return NextResponse.json({ config });
    } catch (error: any) {
        console.error('Error fetching IGST Refund config:', error);
        return NextResponse.json({ error: 'Failed to fetch config', details: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { config } = body;

        if (!config || !Array.isArray(config)) {
            return NextResponse.json({ error: 'Invalid config format' }, { status: 400 });
        }

        const result = await updateIgstRefundConfig(config);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error updating IGST Refund config:', error);
        return NextResponse.json({ error: 'Failed to update config', details: error.message }, { status: 500 });
    }
}
