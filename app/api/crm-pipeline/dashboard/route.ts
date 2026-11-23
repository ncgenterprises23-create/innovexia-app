import { NextRequest, NextResponse } from 'next/server';
import {
  getCrmPipelines,
  getCrmPipelineDashboardData,
  getCrmActivitiesForPipelines,
  isSheetsQuotaError,
} from '@/lib/crmPipelineSheets';
import { applyPlannedMapToFiveForThree, buildCrmPipelineFiveForThree } from '@/lib/crmPipelineFiveForThree';
import {
  buildCrmPipelineSalesPerformance,
  type SalesPerformanceStatusFilter,
} from '@/lib/crmPipelineSalesPerformance';
import {
  applyPlannedMapToSalesPerformance,
  plannedRowsToMap,
  yearMonthFromDate,
} from '@/lib/crmPipelineSalesPerformancePlanned';
import { getSalesPerformancePlannedRows } from '@/lib/crmPipelineSheets';
import {
  buildCrmPipelineDashboard,
  buildPipelineComparison,
  buildTimeColumns,
  parseDashboardRange,
  type DashboardGranularity,
} from '@/lib/crmPipelineDashboard';

const SHEETS_RATE_LIMIT_MSG =
  'Google Sheets rate limit reached. Wait about a minute, then refresh the page.';

function parseGranularity(raw: string | null): DashboardGranularity {
  const g = String(raw || 'month').toLowerCase();
  if (g === 'quarter' || g === 'year') return g;
  return 'month';
}

function parsePresetCount(raw: string | null): number {
  const n = Number(raw);
  if (n === 1 || n === 3 || n === 6) return n;
  return 3;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pipelineIdsParam = searchParams.get('pipelineIds') || searchParams.get('pipelineId') || 'all';
    const mine = searchParams.get('mine') || undefined;
    const reportRaw = String(searchParams.get('report') || 'fiveFor5').toLowerCase();
    const report =
      reportRaw === 'fivefor3' || reportRaw === 'five_for_3'
        ? 'fiveFor3'
        : reportRaw === 'salesperformance' ||
            reportRaw === 'sales_performance' ||
            reportRaw === 'performance'
          ? 'salesPerformance'
          : 'fiveFor5';

    const granularity =
      report === 'fiveFor3' || report === 'salesPerformance'
        ? 'month'
        : parseGranularity(searchParams.get('granularity'));
    const presetCount =
      report === 'fiveFor3' || report === 'salesPerformance'
        ? 1
        : parsePresetCount(searchParams.get('presetCount') || searchParams.get('presetMonths'));
    const { from, to } = parseDashboardRange(
      searchParams.get('from'),
      searchParams.get('to'),
      presetCount,
      granularity
    );

    const marginPct = 30;
    const profitPct = 15;
    const compare =
      report === 'fiveFor5' &&
      (searchParams.get('compare') === '1' || searchParams.get('compare') === 'true');

    const allPipelines = await getCrmPipelines();
    const nameById = new Map(allPipelines.map((p) => [String(p.id), String(p.name || p.id)]));

    let ids = pipelineIdsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 1 && ids[0].toLowerCase() === 'all') {
      ids = allPipelines.map((p) => String(p.id));
    }
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No pipelines available for dashboard' }, { status: 400 });
    }

    const opportunities: any[] = [];
    const wonDatesByOppId: Record<string, string> = {};
    for (const pipelineId of ids) {
      const bundle = await getCrmPipelineDashboardData(pipelineId, { mine });
      opportunities.push(...bundle.opportunities);
      Object.assign(wonDatesByOppId, bundle.wonDatesByOppId);
    }

    const scopeAll = pipelineIdsParam.trim().toLowerCase() === 'all' && !compare;
    const primaryId = scopeAll ? 'all' : ids[0];

    if (report === 'fiveFor3') {
      const effectiveGranularity = 'month' as const;
      const activities = await getCrmActivitiesForPipelines(ids);
      let fiveForThree = buildCrmPipelineFiveForThree({
        opportunities,
        activities,
        wonDatesByOppId,
        from,
        to,
      });
      const yearMonthParam53 = String(searchParams.get('yearMonth') || '').trim();
      const yearMonth53 = yearMonthParam53 || yearMonthFromDate(to);
      const plannedRows53 = await getSalesPerformancePlannedRows(primaryId, yearMonth53);
      fiveForThree = applyPlannedMapToFiveForThree(fiveForThree, plannedRowsToMap(plannedRows53));
      return NextResponse.json({
        report: 'fiveFor3',
        pipelineId: primaryId,
        pipelineName: scopeAll ? 'All pipelines' : nameById.get(primaryId) || primaryId,
        scopeAll,
        from: from.toISOString(),
        to: to.toISOString(),
        granularity: effectiveGranularity,
        months: fiveForThree.months,
      });
    }

    if (report === 'salesPerformance') {
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
      const buildTo = clipRange ? new Date(clipRange.endMs) : to;
      const activities = await getCrmActivitiesForPipelines(ids);
      let performance = buildCrmPipelineSalesPerformance({
        opportunities,
        activities,
        wonDatesByOppId,
        to: buildTo,
        statusFilter,
        clipRange,
      });
      const yearMonthParam = String(searchParams.get('yearMonth') || '').trim();
      const yearMonth = yearMonthParam || yearMonthFromDate(to);
      const plannedRows = await getSalesPerformancePlannedRows(primaryId, yearMonth);
      performance = applyPlannedMapToSalesPerformance(performance, plannedRowsToMap(plannedRows));
      performance = {
        ...performance,
        plannedContext: { pipelineId: primaryId, yearMonth },
      };
      return NextResponse.json({
        report: 'salesPerformance',
        pipelineId: primaryId,
        pipelineName: scopeAll ? 'All pipelines' : nameById.get(primaryId) || primaryId,
        scopeAll,
        from: from.toISOString(),
        to: to.toISOString(),
        granularity: 'month' as const,
        statusFilter,
        salesPerformance: performance,
      });
    }

    const dashboard = buildCrmPipelineDashboard({
      opportunities,
      wonDatesByOppId,
      from,
      to,
      granularity,
      marginPct,
      profitPct,
      includeQAvg: granularity === 'month',
    });

    let comparison: ReturnType<typeof buildPipelineComparison> | undefined;
    if (compare && ids.length > 1) {
      const pipelineBundles = await Promise.all(
        ids.map(async (id) => {
          const data = await getCrmPipelineDashboardData(id, { mine });
          return {
            id,
            name: nameById.get(id) || id,
            opportunities: data.opportunities,
            wonDatesByOppId: data.wonDatesByOppId,
          };
        })
      );
      comparison = buildPipelineComparison(
        pipelineBundles,
        from.getTime(),
        to.getTime() + 1,
        marginPct,
        profitPct
      );
    }

    const { bucketMeta } = buildTimeColumns(from, to, granularity, granularity === 'month');

    return NextResponse.json({
      report: 'fiveFor5',
      pipelineId: primaryId,
      pipelineName: scopeAll ? 'All pipelines' : nameById.get(primaryId) || primaryId,
      scopeAll,
      from: from.toISOString(),
      to: to.toISOString(),
      granularity,
      marginPct,
      profitPct,
      columns: dashboard.columns,
      sections: dashboard.sections,
      comparison,
      bucketMetaKeys: Object.keys(bucketMeta),
    });
  } catch (error) {
    console.error('CRM pipeline GET dashboard:', error);
    if (isSheetsQuotaError(error)) {
      return NextResponse.json({ error: SHEETS_RATE_LIMIT_MSG }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to build pipeline dashboard' }, { status: 500 });
  }
}