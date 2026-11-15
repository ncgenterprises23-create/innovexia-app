import { NextRequest, NextResponse } from 'next/server';
import {
  getCrmPipelines,
  getCrmPipelineDashboardData,
  getCrmActivitiesForPipelines,
  isSheetsQuotaError,
} from '@/lib/crmPipelineSheets';
import { buildCrmPipelineFiveForThree } from '@/lib/crmPipelineFiveForThree';
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
    const report = reportRaw === 'fivefor3' || reportRaw === 'five_for_3' ? 'fiveFor3' : 'fiveFor5';

    const granularity =
      report === 'fiveFor3' ? 'month' : parseGranularity(searchParams.get('granularity'));
    const presetCount =
      report === 'fiveFor3' ? 1 : parsePresetCount(searchParams.get('presetCount') || searchParams.get('presetMonths'));
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
      const fiveForThree = buildCrmPipelineFiveForThree({
        opportunities,
        activities,
        wonDatesByOppId,
        from,
        to,
      });
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