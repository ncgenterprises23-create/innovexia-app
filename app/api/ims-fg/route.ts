import { NextResponse } from 'next/server';
import { getIMSFGData } from '@/lib/sheets';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sheetName = searchParams.get('sheetName');

        if (!sheetName) {
            return NextResponse.json({ error: 'sheetName is required' }, { status: 400 });
        }

        const data = await getIMSFGData(sheetName);
        return NextResponse.json(data);
    } catch (error) {
        console.error('API Error in ims-fg:', error);
        return NextResponse.json({ error: 'Failed to fetch IMS FG data' }, { status: 500 });
    }
}
