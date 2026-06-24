import { NextResponse } from 'next/server';
import {
  getDealerKitFestivals,
  createDealerKitFestival,
  updateDealerKitFestival,
  deleteDealerKitFestival,
} from '@/lib/sheets';

export async function GET() {
  try {
    const data = await getDealerKitFestivals();
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching Dealer_Kit festivals:', error);
    return NextResponse.json({ error: 'Failed to fetch festivals', details: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createDealerKitFestival(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error creating Dealer_Kit festival:', error);
    return NextResponse.json({ error: 'Failed to create festival', details: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const id = body.id;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const result = await updateDealerKitFestival(String(id), body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error updating Dealer_Kit festival:', error);
    return NextResponse.json({ error: 'Failed to update festival', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const id = body.id;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const result = await deleteDealerKitFestival(String(id));
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error deleting Dealer_Kit festival:', error);
    return NextResponse.json({ error: 'Failed to delete festival', details: error.message }, { status: 500 });
  }
}
