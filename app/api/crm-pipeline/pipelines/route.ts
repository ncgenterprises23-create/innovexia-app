import { NextRequest, NextResponse } from 'next/server';
import {
  getCrmPipelines,
  createCrmPipeline,
} from '@/lib/crmPipelineSheets';

export async function GET() {
  try {
    const pipelines = await getCrmPipelines();
    return NextResponse.json({ pipelines });
  } catch (error) {
    console.error('CRM pipeline GET pipelines:', error);
    return NextResponse.json({ error: 'Failed to fetch pipelines' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, user, withDefaultStages } = body;
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Pipeline name is required' }, { status: 400 });
    }
    const pipeline = await createCrmPipeline(name.trim(), user, withDefaultStages !== false);
    return NextResponse.json({ pipeline });
  } catch (error) {
    console.error('CRM pipeline POST pipeline:', error);
    return NextResponse.json({ error: 'Failed to create pipeline' }, { status: 500 });
  }
}
