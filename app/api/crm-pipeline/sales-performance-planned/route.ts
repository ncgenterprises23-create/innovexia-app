import { NextRequest, NextResponse } from 'next/server';
import { isSheetsQuotaError, saveSalesPerformancePlannedBatch } from '@/lib/crmPipelineSheets';
import { normalizeSalesPerformanceWeekKey } from '@/lib/crmPipelineSalesPerformancePlanned';

const SHEETS_RATE_LIMIT_MSG =
  'Google Sheets rate limit reached. Wait about a minute, then try again.';

function isAdminRole(role?: string): boolean {
  return String(role || '').trim().toLowerCase() === 'admin';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pipelineId = String(body.pipelineId || '').trim();
    const yearMonth = String(body.yearMonth || '').trim();
    const records = Array.isArray(body.records) ? body.records : [];
    const user = body.user as { username?: string; role_name?: string } | undefined;

    if (!isAdminRole(user?.role_name)) {
      return NextResponse.json({ error: 'Admin access required to save planned targets' }, { status: 403 });
    }

    if (!pipelineId || !yearMonth) {
      return NextResponse.json({ error: 'pipelineId and yearMonth are required' }, { status: 400 });
    }

    if (records.length === 0) {
      return NextResponse.json({ error: 'No records to save' }, { status: 400 });
    }

    type RecordIn = {
      weekKey?: string;
      salesperson?: string;
      plannedLeads?: number | string | null;
      plannedMeetings?: number | string | null;
      plannedRevenue?: number | string | null;
    };

    const normalized = (records as RecordIn[])
      .map((r) => ({
        weekKey: normalizeSalesPerformanceWeekKey(String(r.weekKey || '').trim()),
        salesperson: String(r.salesperson || '').trim(),
        plannedLeads:
          r.plannedLeads === '' || r.plannedLeads == null
            ? null
            : Number.isFinite(Number(r.plannedLeads))
              ? Number(r.plannedLeads)
              : null,
        plannedMeetings:
          r.plannedMeetings === '' || r.plannedMeetings == null
            ? null
            : Number.isFinite(Number(r.plannedMeetings))
              ? Number(r.plannedMeetings)
              : null,
        plannedRevenue:
          r.plannedRevenue === '' || r.plannedRevenue == null
            ? null
            : Number.isFinite(Number(r.plannedRevenue))
              ? Number(r.plannedRevenue)
              : null,
      }))
      .filter((r) => r.weekKey && r.salesperson);

    await saveSalesPerformancePlannedBatch({
      pipelineId,
      yearMonth,
      records: normalized,
      updatedBy: user?.username,
    });

    return NextResponse.json({ ok: true, saved: normalized.length });
  } catch (error) {
    console.error('CRM sales performance planned POST:', error);
    if (isSheetsQuotaError(error)) {
      return NextResponse.json({ error: SHEETS_RATE_LIMIT_MSG }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to save planned targets' }, { status: 500 });
  }
}