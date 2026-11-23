import { NextRequest, NextResponse } from 'next/server';
import {
  getCrmPipelines,
  getCrmPipelineDashboardData,
  getCrmActivitiesForPipelines,
  isSheetsQuotaError,
} from '@/lib/crmPipelineSheets';
import type { SalesPerformanceStatusFilter } from '@/lib/crmPipelineSalesPerformance';
import { buildSalesPerformanceInspect } from '@/lib/crmPipelineSalesPerformanceInspect';

const SHEETS_RATE_LIMIT_MSG =
  'Google Sheets rate limit reached. Wait about a minute, then refresh the page.';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pipelineIdsParam = searchParams.get('pipelineIds') || searchParams.get('pipelineId') || 'all';
    const yearMonth = String(searchParams.get('yearMonth') || '').trim();
    const weekKey = String(searchParams.get('weekKey') || '').trim();
    const salesperson = String(searchParams.get('salesperson') || '').trim();
    const metric = String(searchParams.get('metric') || '').trim();
    const isTotal = searchParams.get('isTotal') === '1' || searchParams.get('isTotal') === 'true';
    const mine = searchParams.get('mine') || undefined;

    if (!yearMonth || !weekKey || !salesperson || !metric) {
      return NextResponse.json({ error: 'yearMonth, weekKey, salesperson, and metric are required' }, { status: 400 });
    }

    const allowed = ['leads', 'meetings', 'conversion_ratio', 'revenue', 'costing', 'profit'];
    if (!allowed.includes(metric)) {
      return NextResponse.json({ error: 'Invalid metric' }, { status: 400 });
    }

    const statusRaw = String(searchParams.get('status') || 'all').toLowerCase();
    const statusFilter: SalesPerformanceStatusFilter =
      statusRaw === 'open' || statusRaw === 'won' || statusRaw === 'lost' ? statusRaw : 'all';

    const clipFrom = String(searchParams.get('clipFrom') || '').trim();
    const clipTo = String(searchParams.get('clipTo') || '').trim();
    const clipLabel = String(searchParams.get('clipLabel') || '').trim();
    let clipRange: { startMs: number; endMs: number; label?: string } | undefined;
    if (clipFrom && clipTo) {
      const startMs = Date.parse(clipFrom);
      const endMs = Date.parse(clipTo);
      if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
        clipRange = { startMs, endMs, label: clipLabel || undefined };
      }
    }

    const allPipelines = await getCrmPipelines();
    let ids = pipelineIdsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 1 && ids[0].toLowerCase() === 'all') {
      ids = allPipelines.map((p) => String(p.id));
    }
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No pipelines available' }, { status: 400 });
    }

    const opportunities: any[] = [];
    const wonDatesByOppId: Record<string, string> = {};
    for (const pipelineId of ids) {
      const bundle = await getCrmPipelineDashboardData(pipelineId, { mine });
      opportunities.push(...bundle.opportunities);
      Object.assign(wonDatesByOppId, bundle.wonDatesByOppId);
    }
    const activities = await getCrmActivitiesForPipelines(ids);

    const inspect = buildSalesPerformanceInspect({
      opportunities,
      activities,
      wonDatesByOppId,
      yearMonth,
      weekKey,
      salesperson,
      isTotalRow: isTotal,
      metric: metric as any,
      statusFilter,
      clipRange,
    });

    if (!inspect) {
      return NextResponse.json({ error: 'Could not resolve week for inspect' }, { status: 404 });
    }

    return NextResponse.json({ inspect });
  } catch (e) {
    console.error('sales-performance-inspect', e);
    if (isSheetsQuotaError(e)) {
      return NextResponse.json({ error: SHEETS_RATE_LIMIT_MSG }, { status: 503 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load inspect details' },
      { status: 500 }
    );
  }
}