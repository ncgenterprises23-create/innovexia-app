import { NextResponse } from 'next/server';
import {
  getDealerKitMonthlyFrequency,
  createDealerKitMonthlyFrequency,
  updateDealerKitMonthlyFrequency,
  deleteDealerKitMonthlyFrequency,
} from '@/lib/sheets';

export async function GET() {
  try {
    const data = await getDealerKitMonthlyFrequency();
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching Dealer_Kit monthly frequency:', error);
    return NextResponse.json({ error: 'Failed to fetch monthly frequency', details: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createDealerKitMonthlyFrequency(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error creating Dealer_Kit monthly frequency:', error);
    return NextResponse.json({ error: 'Failed to create monthly plan item', details: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    
    // Support batch update
    const updates = Array.isArray(body) ? body : [body];
    const results = [];
    
    for (const update of updates) {
      const contentId = update.contentId || update['Content ID'] || update.id;
      if (!contentId) {
        return NextResponse.json({ error: 'contentId is required for all updates' }, { status: 400 });
      }
      
      const result = await updateDealerKitMonthlyFrequency(String(contentId), update);
      results.push(result);
    }

    return NextResponse.json(results.length === 1 ? results[0] : results);
  } catch (error: any) {
    console.error('Error updating Dealer_Kit monthly frequency:', error);
    return NextResponse.json({ error: 'Failed to update monthly plan item', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const contentId = body.contentId || body['Content ID'] || body.id;

    if (!contentId) {
      return NextResponse.json({ error: 'contentId is required' }, { status: 400 });
    }

    const result = await deleteDealerKitMonthlyFrequency(String(contentId));
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error deleting Dealer_Kit monthly frequency:', error);
    return NextResponse.json({ error: 'Failed to delete monthly plan item', details: error.message }, { status: 500 });
  }
}
