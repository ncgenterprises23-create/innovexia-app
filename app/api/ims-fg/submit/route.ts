import { NextResponse } from 'next/server';
import { submitIMSFGPartyDetails } from '@/lib/sheets';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const result = await submitIMSFGPartyDetails(body);
        return NextResponse.json(result);
    } catch (error) {
        console.error('API Error in ims-fg/submit:', error);
        return NextResponse.json({ error: 'Failed to submit party details' }, { status: 500 });
    }
}
