import { NextResponse } from 'next/server';
import {
    getFMSProductSearchConfig,
    updateFMSProductSearchConfig
} from '@/lib/sheets';

export async function GET() {
    try {
        const config = await getFMSProductSearchConfig();
        return NextResponse.json({ config });
    } catch (error: any) {
        console.error('Error fetching FMS Product Search config:', error);
        return NextResponse.json({ error: 'Failed to fetch config', details: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const { config } = await request.json();
        if (!config || !Array.isArray(config)) {
            return NextResponse.json({ error: 'Config must be an array' }, { status: 400 });
        }

        const result = await updateFMSProductSearchConfig(config);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error updating FMS Product Search config:', error);
        return NextResponse.json({ error: 'Failed to update config', details: error.message }, { status: 500 });
    }
}
