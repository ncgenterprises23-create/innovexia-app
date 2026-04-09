import { NextRequest, NextResponse } from 'next/server';
import { getExportFMSConfig, updateExportFMSConfig } from '@/lib/sheets';

export async function GET(request: NextRequest) {
    try {
        const config = await getExportFMSConfig();
        return NextResponse.json({ config });
    } catch (error) {
        console.error('Error fetching config:', error);
        return NextResponse.json({ error: 'Failed to fetch configuration', details: String(error) }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const { config } = await request.json();

        if (!Array.isArray(config)) {
            return NextResponse.json({ error: 'Config must be an array', details: 'Invalid config format' }, { status: 400 });
        }

        const result = await updateExportFMSConfig(config);
        return NextResponse.json({ success: true, message: 'Configuration updated', result });
    } catch (error) {
        console.error('Error saving config:', error);
        return NextResponse.json({ error: 'Failed to save configuration', details: String(error) }, { status: 500 });
    }
}
