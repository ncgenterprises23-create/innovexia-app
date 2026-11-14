import { NextRequest, NextResponse } from 'next/server';
import {
  getCrmBoardBundle,
  createCrmOpportunity,
  updateCrmOpportunity,
  batchUpdateCrmOpportunityFields,
  isSheetsQuotaError,
} from '@/lib/crmPipelineSheets';

const SHEETS_RATE_LIMIT_MSG =
  'Google Sheets rate limit reached. Wait about a minute, then refresh the page.';

export async function GET(request: NextRequest) {
  try {
    const pipelineId = request.nextUrl.searchParams.get('pipelineId');
    if (!pipelineId) {
      return NextResponse.json({ error: 'pipelineId is required' }, { status: 400 });
    }
    const mine = request.nextUrl.searchParams.get('mine') || undefined;
    const outcome = request.nextUrl.searchParams.get('outcome') || 'open';
    const { opportunities, openActivitiesByOpp } = await getCrmBoardBundle(pipelineId, {
      outcome,
      mine,
    });
    return NextResponse.json({ opportunities, openActivities: openActivitiesByOpp });
  } catch (error) {
    console.error('CRM pipeline GET opportunities:', error);
    if (isSheetsQuotaError(error)) {
      return NextResponse.json({ error: SHEETS_RATE_LIMIT_MSG }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user, ...data } = body;
    if (!data.pipeline_id || !data.stage_id) {
      return NextResponse.json({ error: 'pipeline_id and stage_id are required' }, { status: 400 });
    }
    const opportunity = await createCrmOpportunity(data, user);
    return NextResponse.json({ opportunity });
  } catch (error) {
    console.error('CRM pipeline POST opportunity:', error);
    return NextResponse.json({ error: 'Failed to create opportunity' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user, batchSubmit, ...updates } = body;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    const result = batchSubmit
      ? await batchUpdateCrmOpportunityFields(id, updates, user)
      : await updateCrmOpportunity(id, updates, user);
    return NextResponse.json({ opportunity: result });
  } catch (error: any) {
    console.error('CRM pipeline PATCH opportunity:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update opportunity' },
      { status: 500 }
    );
  }
}
