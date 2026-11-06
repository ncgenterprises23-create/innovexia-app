import { NextRequest, NextResponse } from 'next/server';
import {
  getCrmPipelineStages,
  createCrmPipelineStage,
  updateCrmPipelineStage,
  deleteCrmPipelineStage,
} from '@/lib/crmPipelineSheets';

export async function GET(request: NextRequest) {
  try {
    const pipelineId = request.nextUrl.searchParams.get('pipelineId');
    if (!pipelineId) {
      return NextResponse.json({ error: 'pipelineId is required' }, { status: 400 });
    }
    const stages = await getCrmPipelineStages(pipelineId);
    return NextResponse.json({ stages });
  } catch (error) {
    console.error('CRM pipeline GET stages:', error);
    return NextResponse.json({ error: 'Failed to fetch stages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { pipelineId, name, sequence } = await request.json();
    if (!pipelineId || !name?.trim()) {
      return NextResponse.json({ error: 'pipelineId and name are required' }, { status: 400 });
    }
    const stage = await createCrmPipelineStage(pipelineId, name.trim(), sequence);
    return NextResponse.json({ stage });
  } catch (error: any) {
    console.error('CRM pipeline POST stage:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create stage' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { stageId, pipelineId, action, name, sequence } = body;
    if (!stageId) {
      return NextResponse.json({ error: 'stageId is required' }, { status: 400 });
    }
    if (action === 'delete') {
      if (!pipelineId) {
        return NextResponse.json({ error: 'pipelineId is required' }, { status: 400 });
      }
      await deleteCrmPipelineStage(stageId, pipelineId);
      return NextResponse.json({ ok: true });
    }
    const updates: { name?: string; sequence?: number } = {};
    if (name !== undefined && name !== null && String(name).trim() !== '') {
      updates.name = String(name).trim();
    }
    if (sequence !== undefined && sequence !== null && Number.isFinite(Number(sequence))) {
      updates.sequence = Number(sequence);
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }
    const stage = await updateCrmPipelineStage(stageId, updates);
    return NextResponse.json({ stage });
  } catch (error: any) {
    console.error('CRM pipeline PATCH stage:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update stage' },
      { status: 500 }
    );
  }
}
