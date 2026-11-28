import { NextRequest, NextResponse } from 'next/server';
import { COSTING_HEADERS } from '@/lib/costingConstants';
import {
  createCostingRecord,
  deleteCostingRecord,
  listCostingRecords,
  updateCostingRecord,
} from '@/lib/costingSheets';
import { getIMSFGItemCatalog } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('catalog') === '1') {
      const catalog = await getIMSFGItemCatalog();
      return NextResponse.json({ catalog });
    }
    if (searchParams.get('headers') === '1') {
      return NextResponse.json({ headers: COSTING_HEADERS });
    }
    const records = await listCostingRecords();
    return NextResponse.json({ records });
  } catch (e) {
    console.error('GET /api/costing', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load costing data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const record = await createCostingRecord({
      item_name: body.item_name,
      item_code: body.item_code,
      ims_type: body.ims_type,
      cost_price: body.cost_price,
      user: body.user || body.username,
    });
    return NextResponse.json({ record });
  } catch (e) {
    console.error('POST /api/costing', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to save costing' },
      { status: 400 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = String(body.id || '').trim();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const record = await updateCostingRecord(id, {
      item_name: body.item_name,
      item_code: body.item_code,
      ims_type: body.ims_type,
      cost_price: body.cost_price,
      user: body.user || body.username,
    });
    return NextResponse.json({ record });
  } catch (e) {
    console.error('PUT /api/costing', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update costing' },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = String(searchParams.get('id') || '').trim();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    await deleteCostingRecord(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/costing', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to delete costing' },
      { status: 400 }
    );
  }
}