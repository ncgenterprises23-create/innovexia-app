'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DASHBOARD_METRIC_ORDER,
  formatDashboardCell,
  type DashboardGranularity,
  type DashboardSectionResult,
  type DashboardTableRow,
  type PipelineComparisonResult,
  type TimeColumn,
  presetRangeLabel,
} from '@/lib/crmPipelineDashboard';
import { FileDown, Info, Loader2 } from 'lucide-react';
import CrmPipelineDashboardInfoSidebar from '@/components/crm-pipeline/CrmPipelineDashboardInfoSidebar';
import { exportCrmPipelineDashboardPdf } from '@/lib/crmPipelineDashboardPdf';
import type { FiveForThreeMonth } from '@/lib/crmPipelineFiveForThree';
import { exportCrmPipelineFiveForThreePdf } from '@/lib/crmPipelineFiveForThreePdf';
import CrmPipelineFiveForThreeTable from '@/components/crm-pipeline/CrmPipelineFiveForThreeTable';

export type DashboardReportMode = 'fiveFor5' | 'fiveFor3';

const DASH_SHADOW = 'shadow-[0_2px_4px_rgba(15,23,42,0.12),0_8px_16px_-2px_rgba(15,23,42,0.22)]';
const LIGHT_SURFACE =
  'bg-[var(--theme-light)] dark:bg-[var(--theme-primary)]/15 border border-[var(--theme-primary)]/25';

export const CRM_DASHBOARD_ALL_PIPELINES = 'all';

type PipelineOption = { id: string; name: string };

type DashboardPayload = {
  report?: DashboardReportMode;
  columns: TimeColumn[];
  sections: DashboardSectionResult[];
  months?: FiveForThreeMonth[];
  comparison?: PipelineComparisonResult;
  pipelineName?: string;
};

async function fetchDash(url: string): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    last = res;
    if (res.status !== 503 || attempt === 2) return res;
    await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
  }
  return last!;
}

function SectionTable({
  section,
  columns,
}: {
  section: DashboardSectionResult;
  columns: TimeColumn[];
}) {
  const rowsByMetric = useMemo(() => {
    const map = new Map<string, DashboardTableRow[]>();
    for (const row of section.rows) {
      const list = map.get(row.metric) || [];
      list.push(row);
      map.set(row.metric, list);
    }
    return map;
  }, [section.rows]);

  return (
    <div className="flex-1 min-h-0 flex flex-col min-w-0">
      <div
        className={`flex-1 min-h-0 rounded-lg ${LIGHT_SURFACE} ${DASH_SHADOW} flex flex-col overflow-hidden`}
      >
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar crm-stage-lead-scroll max-h-[calc(100vh-10.5rem)] pb-6 scroll-pb-6">
          <table className="w-full text-xs border-collapse min-w-[720px]">
            <thead className="sticky top-0 z-30">
              <tr className="bg-amber-200/90 dark:bg-amber-900/55 border-b-2 border-amber-500/80 dark:border-amber-600 shadow-[0_1px_0_rgba(180,140,50,0.25)]">
                <th className="text-left font-bold px-3 py-2 sticky left-0 z-40 bg-amber-200/90 dark:bg-amber-900/55 min-w-[11rem] border-r border-amber-400/60 dark:border-amber-700 text-slate-900 dark:text-amber-50">
                  Metrics
                </th>
                <th className="text-left font-bold px-3 py-2 min-w-[8rem] bg-amber-200/90 dark:bg-amber-900/55 text-slate-900 dark:text-amber-50">
                  Category / Tags
                </th>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className="text-right font-bold px-3 py-2 whitespace-nowrap bg-amber-200/90 dark:bg-amber-900/55 text-slate-900 dark:text-amber-50"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DASHBOARD_METRIC_ORDER.map((metricKey) => {
                const group = rowsByMetric.get(metricKey) || [];
                return group.map((row, idx) => {
                  const totalRow = row.isSectionTotal;
                  const rowBg = totalRow
                    ? 'bg-amber-100/90 dark:bg-amber-950/35'
                    : (idx - 1) % 2 === 1
                      ? 'bg-amber-50/25 dark:bg-slate-900/30'
                      : 'bg-white dark:bg-slate-950/10';
                  return (
                  <tr
                    key={`${row.metric}-${row.tag}-${idx}`}
                    className={`border-b border-amber-300/80 dark:border-amber-700/55 ${rowBg} ${
                      totalRow ? 'border-b-2 border-amber-400 dark:border-amber-500 font-semibold' : ''
                    }`}
                  >
                    {idx === 0 ? (
                      <td
                        rowSpan={group.length}
                        className={`px-3 py-1.5 align-top font-semibold text-slate-800 dark:text-slate-100 sticky left-0 z-20 border-r border-amber-300/70 dark:border-amber-800 ${rowBg}`}
                      >
                        {row.metricLabel}
                      </td>
                    ) : null}
                    <td
                      className={`px-3 py-1.5 ${
                        totalRow
                          ? 'font-bold text-amber-950 dark:text-amber-100'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {row.tag}
                    </td>
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={`px-3 py-1.5 text-right tabular-nums ${
                          totalRow ? 'text-amber-950 dark:text-amber-50 font-bold' : 'text-slate-800 dark:text-slate-100'
                        }`}
                      >
                        {formatDashboardCell(row.metric, row.values[c.key])}
                      </td>
                    ))}
                  </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function CrmPipelineDashboard({
  pipelines,
  myOnly,
  currentUsername,
}: {
  pipelines: PipelineOption[];
  myOnly: boolean;
  currentUsername?: string;
}) {
  const [reportMode, setReportMode] = useState<DashboardReportMode>('fiveFor5');
  const [dashboardPipelineId, setDashboardPipelineId] = useState(CRM_DASHBOARD_ALL_PIPELINES);
  const [presetCount, setPresetCount] = useState<1 | 3 | 6>(3);
  const [granularity, setGranularity] = useState<DashboardGranularity>('month');
  const [compare, setCompare] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const effectiveGranularity = reportMode === 'fiveFor3' ? 'month' : granularity;

  const rangeOptions = useMemo(() => {
    const unit =
      effectiveGranularity === 'month'
        ? 'month'
        : effectiveGranularity === 'quarter'
          ? 'quarter'
          : 'year';
    return ([1, 3, 6] as const).map((n) => ({
      value: n,
      label: `Last ${n} ${n === 1 ? unit : `${unit}s`}`,
    }));
  }, [effectiveGranularity]);

  const rangeLabel = presetRangeLabel(effectiveGranularity, presetCount);
  const fiveFor3MonthLabel = data?.months?.[0]?.label;
  const dashboardTitle =
    reportMode === 'fiveFor3'
      ? `5 For 3 (${fiveFor3MonthLabel || 'This month'})`
      : `5 For 5 (${rangeLabel})`;

  const load = useCallback(async () => {
    if (pipelines.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      const ids =
        compare && compareIds.length > 1
          ? compareIds.join(',')
          : dashboardPipelineId === CRM_DASHBOARD_ALL_PIPELINES
            ? CRM_DASHBOARD_ALL_PIPELINES
            : dashboardPipelineId;
      qs.set('pipelineIds', ids);
      qs.set('presetCount', reportMode === 'fiveFor3' ? '1' : String(presetCount));
      qs.set('granularity', effectiveGranularity);
      qs.set('report', reportMode);
      if (compare && reportMode === 'fiveFor5' && compareIds.length > 1) qs.set('compare', '1');
      if (myOnly && currentUsername) qs.set('mine', currentUsername);
      const res = await fetchDash(`/api/crm-pipeline/dashboard?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load dashboard');
      const report: DashboardReportMode = json.report === 'fiveFor3' ? 'fiveFor3' : 'fiveFor5';
      setData({
        report,
        columns: json.columns || [],
        sections: json.sections || [],
        months: json.months || [],
        comparison: json.comparison,
        pipelineName: json.pipelineName,
      });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [
    pipelines.length,
    dashboardPipelineId,
    reportMode,
    presetCount,
    granularity,
    effectiveGranularity,
    compare,
    compareIds,
    myOnly,
    currentUsername,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleComparePipeline = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id].slice(0, 5);
    });
  };

  const downloadPdf = () => {
    if (!data) return;
    setPdfBusy(true);
    try {
      if (reportMode === 'fiveFor3') {
        if (!data.months?.length) return;
        exportCrmPipelineFiveForThreePdf({
          title: dashboardTitle,
          pipelineName: data.pipelineName,
          rangeLabel: fiveFor3MonthLabel || rangeLabel,
          months: data.months,
        });
      } else {
        const section = data.sections?.[0];
        if (!section || !data.columns?.length) return;
        exportCrmPipelineDashboardPdf({
          title: dashboardTitle,
          pipelineName: data.pipelineName,
          rangeLabel,
          granularity: effectiveGranularity,
          columns: data.columns,
          section,
        });
      }
    } finally {
      setPdfBusy(false);
    }
  };

  const pdfDisabled =
    reportMode === 'fiveFor3' ? !data?.months?.length : !data?.sections?.[0] || !data?.columns?.length;

  const fieldClass =
    'w-full rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-2 text-sm';

  return (
  <>
    <CrmPipelineDashboardInfoSidebar
      open={infoOpen}
      onClose={() => setInfoOpen(false)}
      activeReport={reportMode}
    />
    <div className="flex flex-1 min-h-0 gap-4 px-4 py-3 overflow-hidden">
      <aside
        className={`w-[14.5rem] shrink-0 flex flex-col gap-4 p-3 rounded-lg max-h-[calc(100vh-8.5rem)] overflow-y-auto custom-scrollbar ${LIGHT_SURFACE} ${DASH_SHADOW}`}
      >
        <div className="flex items-center justify-between gap-2 -mt-0.5">
          <div className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
            Filters
          </div>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="p-1.5 rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-100/80 dark:hover:bg-amber-950/40 border border-transparent hover:border-amber-300/60 dark:hover:border-amber-700/50 transition-colors"
            title="How dashboard numbers are calculated"
            aria-label="Open calculation details"
          >
            <Info className="w-4 h-4" aria-hidden />
          </button>
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
          Report
        </div>
        <div
          className="relative flex h-10 w-full rounded-full bg-slate-200/90 dark:bg-slate-700/80 p-1 shadow-inner border border-slate-300/50 dark:border-slate-600"
          role="group"
          aria-label="Report type"
        >
          <span
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-[var(--theme-primary)] shadow-md transition-all duration-200 ease-out ${
              reportMode === 'fiveFor5' ? 'left-1' : 'left-1/2'
            }`}
            aria-hidden
          />
          <button
            type="button"
            onClick={() => {
              setReportMode('fiveFor5');
              if (compare) setCompare(false);
            }}
            className={`relative z-10 flex-1 rounded-full text-[10px] font-bold transition-colors ${
              reportMode === 'fiveFor5' ? 'text-gray-900' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            5 For 5
          </button>
          <button
            type="button"
            onClick={() => {
              setReportMode('fiveFor3');
              setCompare(false);
            }}
            className={`relative z-10 flex-1 rounded-full text-[10px] font-bold transition-colors ${
              reportMode === 'fiveFor3' ? 'text-gray-900' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            5 For 3
          </button>
        </div>
        {reportMode === 'fiveFor5' ? (
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Granularity
            <select
              className={`${fieldClass} mt-1`}
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as DashboardGranularity)}
            >
              <option value="month">Month</option>
              <option value="quarter">Quarter</option>
              <option value="year">Year</option>
            </select>
          </label>
        ) : null}
        {reportMode === 'fiveFor5' ? (
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Range
            <select
              className={`${fieldClass} mt-1`}
              value={presetCount}
              onChange={(e) => setPresetCount(Number(e.target.value) as 1 | 3 | 6)}
            >
              {rangeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
          Pipeline
          <select
            className={`${fieldClass} mt-1`}
            value={dashboardPipelineId}
            onChange={(e) => {
              setDashboardPipelineId(e.target.value);
              if (e.target.value !== CRM_DASHBOARD_ALL_PIPELINES) setCompare(false);
            }}
          >
            <option value={CRM_DASHBOARD_ALL_PIPELINES}>All pipelines</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {reportMode === 'fiveFor5' ? (
        <label
          className={`flex items-center gap-2 text-xs font-semibold text-slate-700 ${
            dashboardPipelineId === CRM_DASHBOARD_ALL_PIPELINES ? 'opacity-50' : ''
          }`}
        >
          <input
            type="checkbox"
            checked={compare}
            disabled={dashboardPipelineId === CRM_DASHBOARD_ALL_PIPELINES}
            onChange={(e) => setCompare(e.target.checked)}
          />
          Comparison mode
        </label>
        ) : null}
        {reportMode === 'fiveFor5' && compare && (
          <div className="flex flex-col gap-1.5">
            {pipelines.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleComparePipeline(p.id)}
                className={`px-2 py-1.5 rounded-md text-left text-xs font-semibold border ${
                  compareIds.includes(p.id)
                    ? 'bg-[var(--theme-primary)] text-gray-900 border-[var(--theme-primary)]'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          disabled={pdfDisabled || pdfBusy}
          onClick={downloadPdf}
          className="mt-auto w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--theme-primary)] text-gray-900 text-sm font-bold disabled:opacity-50"
        >
          {pdfBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          Download PDF
        </button>
        <p className="text-[10px] leading-snug text-slate-500">
          {reportMode === 'fiveFor3'
            ? 'Salesperson from lead card; weekly buckets per month. Planned targets coming soon.'
            : 'Leads by created date; wins & revenue by won date.'}
          {data?.pipelineName ? ` ${data.pipelineName}.` : ''}
        </p>
      </aside>

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <h2 className="text-center text-sm font-bold text-slate-800 dark:text-slate-100 mb-2 shrink-0">
          {dashboardTitle}
        </h2>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500 flex-1">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading dashboard…
          </div>
        )}
        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>
        )}
        {!loading && data && (
          <div className="flex-1 min-h-0 flex flex-col gap-4">
            {reportMode === 'fiveFor3' && data.months ? (
              <CrmPipelineFiveForThreeTable months={data.months} />
            ) : null}
            {reportMode === 'fiveFor5' && data.comparison && data.comparison.pipelines.length > 1 && (
              <div className="shrink-0 max-h-[12rem] overflow-auto rounded-lg custom-scrollbar">
                <h3 className="text-xs font-black uppercase tracking-wide mb-1 px-1">
                  Pipeline comparison (range total)
                </h3>
                <div className={`rounded-lg overflow-x-auto ${LIGHT_SURFACE} ${DASH_SHADOW}`}>
                  <table className="w-full text-xs min-w-[480px]">
                    <thead className="sticky top-0 bg-white dark:bg-slate-900">
                      <tr className="border-b border-slate-200">
                        <th className="text-left px-3 py-2 font-bold">Metrics</th>
                        {data.comparison.pipelines.map((p) => (
                          <th key={p.id} className="text-right px-3 py-2 font-bold whitespace-nowrap">
                            {p.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.comparison.rows.map((row) => (
                        <tr key={row.metric} className="border-b border-slate-200 dark:border-slate-600">
                          <td className="px-3 py-1.5 font-medium">{row.metricLabel}</td>
                          {data.comparison!.pipelines.map((p) => (
                            <td key={p.id} className="px-3 py-1.5 text-right tabular-nums">
                              {formatDashboardCell(row.metric, row.values[p.id])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {reportMode === 'fiveFor5' &&
              data.sections.map((section) => (
                <SectionTable key={section.key} section={section} columns={data.columns} />
              ))}
          </div>
        )}
      </div>
    </div>
  </>
  );
}