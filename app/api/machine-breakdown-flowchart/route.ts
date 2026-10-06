import { NextResponse } from 'next/server';
import { downloadFile, getFileMetadata } from '@/lib/drive';

export const dynamic = 'force-dynamic';

const FLOW_CHART_FILE_ID = '1sf6X2CHjPQmU4pgg6Tb3tGvE_bGNl1Lk';

export async function GET() {
    try {
        const meta = await getFileMetadata(FLOW_CHART_FILE_ID);
        const buffer = await downloadFile(FLOW_CHART_FILE_ID);
        const contentType = String(meta?.mimeType || 'image/jpeg');
        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                'Content-Type': contentType.startsWith('image/') ? contentType : 'image/jpeg',
                'Cache-Control': 'private, max-age=3600',
            },
        });
    } catch (error: any) {
        console.error('Error loading Machine Breakdown flow chart:', error);
        return NextResponse.json({ error: 'Failed to load flow chart', details: error.message }, { status: 500 });
    }
}
