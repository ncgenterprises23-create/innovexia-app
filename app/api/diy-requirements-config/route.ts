import { NextResponse } from 'next/server';
import { getDiyRequirementConfig, updateDiyRequirementConfig } from '@/lib/sheets';

export async function GET() {
    try {
        const config = await getDiyRequirementConfig();
        return NextResponse.json(config);
    } catch (error) {
        console.error('Error fetching Diy Requirement step config:', error);
        return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const { config } = await request.json();
        
        if (!config || !Array.isArray(config)) {
            return NextResponse.json({ error: 'Valid config array is required' }, { status: 400 });
        }

        const result = await updateDiyRequirementConfig(config);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error updating Diy Requirement step config:', error);
        return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
    }
}
