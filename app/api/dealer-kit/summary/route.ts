import { NextResponse } from 'next/server';
import { getDealerKitSummary } from '@/lib/sheets';

export async function GET() {
  try {
    const data = await getDealerKitSummary();
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching Dealer_Kit summary:', error);
    return NextResponse.json({ error: 'Failed to fetch summary', details: error.message }, { status: 500 });
  }
}
