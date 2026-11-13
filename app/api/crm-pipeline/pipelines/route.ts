import { NextRequest, NextResponse } from 'next/server';
import {
  getCrmPipelines,
  createCrmPipeline,
  filterCrmPipelinesForUser,
} from '@/lib/crmPipelineSheets';

function isPipelineAdmin(role?: string): boolean {
  return String(role || '').trim().toLowerCase() === 'admin';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username') || '';
    const role = searchParams.get('role') || '';
    const all = await getCrmPipelines();
    const pipelines = filterCrmPipelinesForUser(all, username, isPipelineAdmin(role));
    return NextResponse.json({ pipelines });
  } catch (error: unknown) {
    console.error('CRM pipeline GET pipelines:', error);
    const err = error as { code?: number; response?: { status?: number }; message?: string };
    if (err?.code === 429 || err?.response?.status === 429) {
      return NextResponse.json(
        {
          error:
            'Google Sheets rate limit reached. Wait about a minute, then refresh the page.',
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Failed to fetch pipelines' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, user, withDefaultStages, owner_username } = body;
    const role = String(user?.role_name || user?.role || '').trim().toLowerCase();
    if (!isPipelineAdmin(role)) {
      return NextResponse.json({ error: 'Only admins can create pipelines' }, { status: 403 });
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Pipeline name is required' }, { status: 400 });
    }
    const owner = String(owner_username || '').trim();
    if (!owner) {
      return NextResponse.json({ error: 'Assigned user is required' }, { status: 400 });
    }
    const pipeline = await createCrmPipeline(
      name.trim(),
      user,
      withDefaultStages !== false,
      owner
    );
    return NextResponse.json({ pipeline });
  } catch (error) {
    console.error('CRM pipeline POST pipeline:', error);
    return NextResponse.json({ error: 'Failed to create pipeline' }, { status: 500 });
  }
}
