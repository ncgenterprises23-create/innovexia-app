import { NextResponse } from 'next/server';
import { getDealerKitTracking, saveDealerKitTracking } from '@/lib/sheets';

export async function GET() {
  try {
    const tracking = await getDealerKitTracking();
    return NextResponse.json({ tracking });
  } catch (error: any) {
    console.error('API Error fetching Dealer Kit tracking:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch tracking data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.dealerId || !body.contentId || !body.status) {
      return NextResponse.json({ error: 'Missing required fields: dealerId, contentId, status' }, { status: 400 });
    }

    await saveDealerKitTracking({
      dealerId: body.dealerId,
      contentId: body.contentId,
      dealerName: body.dealerName,
      month: body.month,
      contentName: body.contentName,
      status: body.status,
      link: body.link,
      doneBy: body.doneBy,
      comments: body.comments,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error saving Dealer Kit tracking:', error);
    return NextResponse.json({ error: error.message || 'Failed to save tracking data' }, { status: 500 });
  }
}
