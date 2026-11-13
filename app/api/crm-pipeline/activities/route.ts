import { NextRequest, NextResponse } from 'next/server';
import {
  getCrmActivities,
  createCrmPipelineNote,
  createCrmScheduledActivity,
  markCrmActivityDone,
  updateCrmScheduledActivity,
} from '@/lib/crmPipelineSheets';

export async function GET(request: NextRequest) {
  try {
    const opportunityId = request.nextUrl.searchParams.get('opportunityId');
    if (!opportunityId) {
      return NextResponse.json({ error: 'opportunityId is required' }, { status: 400 });
    }
    const activities = await getCrmActivities(opportunityId);
    return NextResponse.json({ activities });
  } catch (error) {
    console.error('CRM pipeline GET activities:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { opportunityId, user, type, ...rest } = body;
    if (!opportunityId) {
      return NextResponse.json({ error: 'opportunityId is required' }, { status: 400 });
    }
    if (type === 'note') {
      const text = typeof rest.payload?.text === 'string' ? rest.payload.text : rest.body || '';
      const entry = await createCrmPipelineNote(opportunityId, text, user);
      return NextResponse.json({ activity: entry });
    }
    if (type === 'activity') {
      const payload = rest.payload || rest;
      const entry = await createCrmScheduledActivity(
        opportunityId,
        {
          activity_type: payload.activity_type,
          summary: payload.summary,
          body: payload.body,
          due_date: payload.due_date,
          assigned_to: payload.assigned_to,
        },
        user
      );
      return NextResponse.json({ activity: entry });
    }
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('CRM pipeline POST activity:', error);
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { activityId, user, action, updates } = body;
    if (!activityId) {
      return NextResponse.json({ error: 'activityId is required' }, { status: 400 });
    }
    if (action === 'update') {
      if (!updates || typeof updates !== 'object') {
        return NextResponse.json({ error: 'updates is required' }, { status: 400 });
      }
      const activityType = updates.activity_type;
      const summary =
        updates.summary ||
        (activityType
          ? String(activityType).charAt(0).toUpperCase() + String(activityType).slice(1)
          : undefined);
      const result = await updateCrmScheduledActivity(
        activityId,
        {
          due_date: updates.due_date,
          body: updates.body,
          activity_type: updates.activity_type,
          summary,
        },
        user
      );
      return NextResponse.json({ activity: result });
    }
    const result = await markCrmActivityDone(activityId, user);
    return NextResponse.json({ activity: result });
  } catch (error: any) {
    console.error('CRM pipeline PATCH activity:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update activity' },
      { status: 500 }
    );
  }
}
