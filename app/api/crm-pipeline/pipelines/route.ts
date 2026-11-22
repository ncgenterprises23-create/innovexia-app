import { NextRequest, NextResponse } from 'next/server';
import {
  getCrmPipelines,
  createCrmPipeline,
  updateCrmPipeline,
  filterCrmPipelinesForUser,
  parsePipelineAccessUsernames,
  pipelineAccessUsernamesToSheet,
  userCanManageCrmPipeline,
  isSheetsQuotaError,
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
    if (isSheetsQuotaError(error)) {
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
    const { name, user, withDefaultStages, owner_username, access_usernames } = body;
    const role = String(user?.role_name || user?.role || '').trim().toLowerCase();
    if (!isPipelineAdmin(role)) {
      return NextResponse.json({ error: 'Only admins can create pipelines' }, { status: 403 });
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Pipeline name is required' }, { status: 400 });
    }
    let accessList: string[] = [];
    if (Array.isArray(access_usernames)) {
      accessList = access_usernames.map((u: unknown) => String(u).trim()).filter(Boolean);
    } else if (access_usernames != null && String(access_usernames).trim()) {
      accessList = String(access_usernames)
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);
    }
    const owner = String(owner_username || '').trim();
    if (owner && !accessList.some((u) => u.toLowerCase() === owner.toLowerCase())) {
      accessList.unshift(owner);
    }
    if (accessList.length === 0 && owner) accessList = [owner];
    if (accessList.length === 0) {
      return NextResponse.json({ error: 'At least one user with access is required' }, { status: 400 });
    }
    const pipeline = await createCrmPipeline(
      name.trim(),
      user,
      withDefaultStages !== false,
      accessList
    );
    return NextResponse.json({ pipeline });
  } catch (error) {
    console.error('CRM pipeline POST pipeline:', error);
    return NextResponse.json({ error: 'Failed to create pipeline' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, access_usernames, user } = body;
    if (!id) {
      return NextResponse.json({ error: 'Pipeline id is required' }, { status: 400 });
    }
    const role = String(user?.role_name || user?.role || '').trim().toLowerCase();
    const isAdmin = isPipelineAdmin(role);
    const username = String(user?.username || '').trim();
    const all = await getCrmPipelines({ forceRefresh: true });
    const existing = all.find((p) => String(p.id) === String(id));
    if (!existing) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }
    if (!userCanManageCrmPipeline(existing, username, isAdmin)) {
      return NextResponse.json({ error: 'You cannot edit this pipeline' }, { status: 403 });
    }

    const updates: { name?: string; owner_username?: string } = {};
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) {
        return NextResponse.json({ error: 'Pipeline name is required' }, { status: 400 });
      }
      updates.name = trimmed;
    }
    if (access_usernames !== undefined) {
      let accessList: string[] = [];
      if (Array.isArray(access_usernames)) {
        accessList = access_usernames.map((u: unknown) => String(u).trim()).filter(Boolean);
      } else {
        accessList = String(access_usernames)
          .split(',')
          .map((u) => u.trim())
          .filter(Boolean);
      }
      const sheetValue = pipelineAccessUsernamesToSheet(accessList);
      if (!parsePipelineAccessUsernames({ owner_username: sheetValue }).length) {
        return NextResponse.json({ error: 'At least one user with access is required' }, { status: 400 });
      }
      if (!isAdmin && !parsePipelineAccessUsernames({ owner_username: sheetValue }).some(
        (u) => u.toLowerCase() === username.toLowerCase()
      )) {
        return NextResponse.json(
          { error: 'You cannot remove your own access from this pipeline' },
          { status: 400 }
        );
      }
      updates.owner_username = sheetValue;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const pipeline = await updateCrmPipeline(String(id), updates);
    return NextResponse.json({ pipeline });
  } catch (error) {
    console.error('CRM pipeline PATCH pipeline:', error);
    return NextResponse.json({ error: 'Failed to update pipeline' }, { status: 500 });
  }
}
