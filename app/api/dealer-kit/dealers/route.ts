import { NextResponse } from 'next/server';
import {
  getDealerKitDealers,
  createDealerKitDealer,
  updateDealerKitDealer,
  deleteDealerKitDealer,
} from '@/lib/sheets';

export async function GET() {
  try {
    const data = await getDealerKitDealers();
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching Dealer_Kit dealers:', error);
    return NextResponse.json({ error: 'Failed to fetch dealers', details: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createDealerKitDealer(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error creating Dealer_Kit dealer:', error);
    return NextResponse.json({ error: 'Failed to create dealer', details: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const dealerId = body.dealerId || body['Dealer ID'] || body.id;

    if (!dealerId) {
      return NextResponse.json({ error: 'dealerId is required' }, { status: 400 });
    }

    const result = await updateDealerKitDealer(String(dealerId), body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error updating Dealer_Kit dealer:', error);
    return NextResponse.json({ error: 'Failed to update dealer', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const dealerId = body.dealerId || body['Dealer ID'] || body.id;

    if (!dealerId) {
      return NextResponse.json({ error: 'dealerId is required' }, { status: 400 });
    }

    const result = await deleteDealerKitDealer(String(dealerId));
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error deleting Dealer_Kit dealer:', error);
    return NextResponse.json({ error: 'Failed to delete dealer', details: error.message }, { status: 500 });
  }
}
