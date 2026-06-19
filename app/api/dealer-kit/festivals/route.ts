import { NextResponse } from 'next/server';
import { getDealerKitFestivals } from '@/lib/sheets';

export async function GET() {
  try {
    const data = await getDealerKitFestivals();
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching Dealer_Kit festivals:', error);
    return NextResponse.json({ error: 'Failed to fetch festivals', details: error.message }, { status: 500 });
  }
}
