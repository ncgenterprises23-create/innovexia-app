import { NextResponse } from 'next/server';
import { buildCrmCostingPickerPayload } from '@/lib/crmCostingPickerData';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const payload = await buildCrmCostingPickerPayload();
    return NextResponse.json(payload);
  } catch (e) {
    console.error('GET /api/costing/crm-picker', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load costing picker' },
      { status: 500 }
    );
  }
}