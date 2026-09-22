import { NextResponse } from 'next/server';
import { getIMSItemNames, createIMSMasterItem } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

function parseKind(value: any): 'rm' | 'fg' | null {
    const kind = String(value || '').trim().toLowerCase();
    if (kind === 'rm' || kind === 'fg') return kind;
    return null;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const kind = parseKind(searchParams.get('type'));
        if (!kind) {
            return NextResponse.json({ error: 'type must be rm or fg' }, { status: 400 });
        }
        const names = await getIMSItemNames(kind);
        return NextResponse.json({ names });
    } catch (error: any) {
        console.error('Error fetching IMS item names:', error);
        return NextResponse.json({ error: 'Failed to fetch item names', details: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const kind = parseKind(body.type);
        const itemName = String(body.item_name || body.name || '').trim();
        if (!kind) {
            return NextResponse.json({ error: 'type must be rm or fg' }, { status: 400 });
        }
        if (!itemName) {
            return NextResponse.json({ error: 'item_name is required' }, { status: 400 });
        }
        const result = await createIMSMasterItem(kind, itemName);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error creating IMS item:', error);
        return NextResponse.json({ error: 'Failed to add item', details: error.message }, { status: 500 });
    }
}
