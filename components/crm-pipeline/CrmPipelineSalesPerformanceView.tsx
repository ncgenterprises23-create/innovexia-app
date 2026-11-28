'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Filter, Loader2, RotateCcw, Save } from 'lucide-react';
import {
  applySalesPerformanceClientFilters,
  type SalesPerformanceBuildResult,
} from '@/lib/crmPipelineSalesPerformance';
import {
  applyPlannedEditsToWeeks,
  extractPlannedEditsFromWeeks,
  plannedCellKey,
  type SalesPerformancePlannedEdit,
} from '@/lib/crmPipelineSalesPerformancePlanned';
import CrmPipelinePerformanceFilterBar, {
  type PerformanceFilterState,
} from '@/components/crm-pipeline/CrmPipelinePerformanceFilterBar';
import CrmPipelinePerformanceKpiStrip from '@/components/crm-pipeline/CrmPipelinePerformanceKpiStrip';
import CrmPipelinePerformanceTable from '@/components/crm-pipeline/CrmPipelinePerformanceTable';
import CrmPipelineRevenueProfitChart from '@/components/crm-pipeline/CrmPipelineRevenueProfitChart';
import CrmPipelinePerformanceNotes from '@/components/crm-pipeline/CrmPipelinePerformanceNotes';
import {
  createDefaultSalesPerformanceServerFilters,
  type SalesPerformanceServerFilters,
} from '@/components/crm-pipeline/CrmPipelineSalesPerformanceDashboard';
import CrmPipelineSalesPerformanceInspectSidebar from '@/components/crm-pipeline/CrmPipelineSalesPerformanceInspectSidebar';
import type { SalesPerformanceInspectCellPayload } from '@/components/crm-pipeline/CrmPipelinePerformanceTable';
import type { SalesPerformanceInspectResult } from '@/lib/crmPipelineSalesPerformanceInspect';
import {
  displayTitleWithClip,
  monthKeyForClip,
  resolveSalesPerformanceClip,
} from '@/lib/crmSalesPerformanceDateRange';
import { useToast } from '@/components/ToastProvider';

type PipelineOption = { id: string; name: string };

type PlannedEditsState = Record<
  string,
  { plannedLeads: number | null; plannedMeetings: number | null; plannedRevenue: number | null }
>;

type Props = {
  data: SalesPerformanceBuildResult;
  pipelineOptions: PipelineOption[];
  monthOptions: { value: string; label: string }[];
  serverFilters: SalesPerformanceServerFilters;
  onApplyServerFilters: (next: SalesPerformanceServerFilters) => void;
  currentUsername?: string;
  canEditPlanned?: boolean;
  currentUserRole?: string;
  onPlannedSaved?: () => void;
  myOnly?: boolean;
};

function filtersSummaryLine(
  draft: PerformanceFilterState,
  pipelineOptions: { id: string; name: string }[],
  monthOptions: { value: string; label: string }[]
): string {
  const pipe = pipelineOptions.find((p) => p.id === draft.pipelineId)?.name ?? draft.pipelineId;
  const month = monthOptions.find((m) => m.value === draft.monthKey)?.label ?? draft.monthKey;
  const parts = [pipe, month];
  if (draft.weekKey !== 'all') {
    const wk = draft.weekKey.replace(/^w/i, '');
    parts.push(`Week ${wk}`);
  }
  if (draft.salesperson !== 'all') parts.push(draft.salesperson);
  if (draft.tag !== 'all') parts.push(draft.tag);
  if (draft.status !== 'all') {
    parts.push(draft.status.charAt(0).toUpperCase() + draft.status.slice(1));
  }
  return parts.join(' · ');
}

function filtersToDraft(server: SalesPerformanceServerFilters): PerformanceFilterState {
  return {
    pipelineId: server.pipelineId,
    monthKey: server.monthKey,
    weekKey: 'all',
    salesperson: 'all',
    status: server.status,
    tag: server.tag,
  };
}

function editsEqual(a: PlannedEditsState, b: PlannedEditsState): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const x = a[key];
    const y = b[key];
    if (!x && !y) continue;
    if (!x || !y) return false;
    if (
      x.plannedLeads !== y.plannedLeads ||
      x.plannedMeetings !== y.plannedMeetings ||
      x.plannedRevenue !== y.plannedRevenue
    ) {
      return false;
    }
  }
  return true;
}

function buildDirtySaveRecords(
  weeks: SalesPerformanceBuildResult['weeks'],
  edits: PlannedEditsState,
  baseline: PlannedEditsState
): SalesPerformancePlannedEdit[] {
  const records: SalesPerformancePlannedEdit[] = [];
  for (const week of weeks) {
    for (const row of week.rows) {
      if (row.isTotal) continue;
      const key = plannedCellKey(week.weekKey, row.salesperson);
      const cur = edits[key] ?? baseline[key] ?? {
        plannedLeads: null,
        plannedMeetings: null,
        plannedRevenue: null,
      };
      const orig = baseline[key] ?? {
        plannedLeads: null,
        plannedMeetings: null,
        plannedRevenue: null,
      };
      if (
        cur.plannedLeads === orig.plannedLeads &&
        cur.plannedMeetings === orig.plannedMeetings &&
        cur.plannedRevenue === orig.plannedRevenue
      ) {
        continue;
      }
      records.push({
        weekKey: week.weekKey,
        salesperson: row.salesperson,
        plannedLeads: cur.plannedLeads,
        plannedMeetings: cur.plannedMeetings,
        plannedRevenue: cur.plannedRevenue,
      });
    }
  }
  return records;
}

export default function CrmPipelineSalesPerformanceView({
  data,
  pipelineOptions,
  monthOptions,
  serverFilters,
  onApplyServerFilters,
  currentUsername,
  canEditPlanned = false,
  currentUserRole,
  onPlannedSaved,
  myOnly = false,
}: Props) {
  const toast = useToast();
  const [draft, setDraft] = useState<PerformanceFilterState>(() => filtersToDraft(serverFilters));
  const [appliedClient, setAppliedClient] = useState<
    Pick<PerformanceFilterState, 'weekKey' | 'salesperson'>
  >({
    weekKey: 'all',
    salesperson: 'all',
  });
  const [plannedEdits, setPlannedEdits] = useState<PlannedEditsState>({});
  const [savedBaseline, setSavedBaseline] = useState<PlannedEditsState>({});
  const [savingPlanned, setSavingPlanned] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [inspectData, setInspectData] = useState<SalesPerformanceInspectResult | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const plannedContext = data.plannedContext;

  const activeFiltersSummary = useMemo(
    () => filtersSummaryLine(draft, pipelineOptions, monthOptions),
    [draft, pipelineOptions, monthOptions]
  );

  useEffect(() => {
    setDraft((d) => ({
      ...filtersToDraft(serverFilters),
      weekKey: d.weekKey,
      salesperson: d.salesperson,
      status: serverFilters.status,
      tag: serverFilters.tag,
    }));
  }, [serverFilters]);

  useEffect(() => {
    const baseline = extractPlannedEditsFromWeeks(data.weeks);
    setPlannedEdits(baseline);
    setSavedBaseline(baseline);
  }, [data]);

  const viewData = useMemo(
    () =>
      applySalesPerformanceClientFilters(data, {
        weekKey: appliedClient.weekKey,
        salesperson: appliedClient.salesperson,
      }),
    [data, appliedClient.weekKey, appliedClient.salesperson]
  );

  const displayWeeks = useMemo(
    () => applyPlannedEditsToWeeks(viewData.weeks, plannedEdits),
    [viewData.weeks, plannedEdits]
  );

  const plannedDirty = useMemo(
    () => !editsEqual(plannedEdits, savedBaseline),
    [plannedEdits, savedBaseline]
  );

  const handlePlannedChange = useCallback(
    (weekKey: string, salesperson: string, field: 'leads' | 'meetings' | 'revenue', value: number | null) => {
      const key = plannedCellKey(weekKey, salesperson);
      setPlannedEdits((prev) => {
        const cur = prev[key] ?? {
          plannedLeads: null,
          plannedMeetings: null,
          plannedRevenue: null,
        };
        return {
          ...prev,
          [key]: {
            plannedLeads: field === 'leads' ? value : cur.plannedLeads,
            plannedMeetings: field === 'meetings' ? value : cur.plannedMeetings,
            plannedRevenue: field === 'revenue' ? value : cur.plannedRevenue,
          },
        };
      });
    },
    []
  );

  const handleSavePlanned = async () => {
    if (!canEditPlanned) {
      toast.error('Only admins can save planned targets');
      return;
    }
    const ctx = plannedContext ?? {
      pipelineId: serverFilters.pipelineId,
      yearMonth: serverFilters.monthKey,
    };
    const records = buildDirtySaveRecords(data.weeks, plannedEdits, savedBaseline);
    if (records.length === 0) {
      toast.success('No planned changes to save');
      return;
    }
    setSavingPlanned(true);
    try {
      const res = await fetch('/api/crm-pipeline/sales-performance-planned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineId: ctx.pipelineId,
          yearMonth: ctx.yearMonth,
          records,
          user: { username: currentUsername, role_name: currentUserRole },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setPlannedEdits((prev) => {
        const next = { ...prev };
        for (const rec of records) {
          const key = plannedCellKey(rec.weekKey, rec.salesperson);
          next[key] = {
            plannedLeads: rec.plannedLeads,
            plannedMeetings: rec.plannedMeetings,
            plannedRevenue: rec.plannedRevenue,
          };
        }
        return next;
      });
      setSavedBaseline((prev) => {
        const next = { ...prev };
        for (const rec of records) {
          const key = plannedCellKey(rec.weekKey, rec.salesperson);
          next[key] = {
            plannedLeads: rec.plannedLeads,
            plannedMeetings: rec.plannedMeetings,
            plannedRevenue: rec.plannedRevenue,
          };
        }
        return next;
      });
      toast.success('Planned targets saved');
      onPlannedSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save planned targets');
    } finally {
      setSavingPlanned(false);
    }
  };

  const handleResetFilters = () => {
    const defaults = createDefaultSalesPerformanceServerFilters();
    setDraft({
      pipelineId: defaults.pipelineId,
      monthKey: defaults.monthKey,
      weekKey: 'all',
      salesperson: 'all',
      status: defaults.status,
      tag: defaults.tag,
    });
    setAppliedClient({ weekKey: 'all', salesperson: 'all' });
    onApplyServerFilters(defaults);
  };

  const handleApply = () => {
    const serverChanged =
      draft.pipelineId !== serverFilters.pipelineId ||
      draft.monthKey !== serverFilters.monthKey ||
      draft.status !== serverFilters.status ||
      draft.tag !== serverFilters.tag;

    if (serverChanged) {
      onApplyServerFilters({
        pipelineId: draft.pipelineId,
        monthKey: draft.monthKey,
        status: draft.status,
        tag: draft.tag,
        datePreset: 'month',
        customFrom: serverFilters.customFrom,
        customTo: serverFilters.customTo,
      });
    }
    setAppliedClient({
      weekKey: draft.weekKey,
      salesperson: draft.salesperson,
    });
  };

  const handleInspectActual = useCallback(
    async (cell: SalesPerformanceInspectCellPayload) => {
      setInspectOpen(true);
      setInspectLoading(true);
      setInspectError(null);
      setInspectData(null);
      try {
        const clip = resolveSalesPerformanceClip(
          serverFilters.datePreset,
          serverFilters.customFrom,
          serverFilters.customTo
        );
        const yearMonth = monthKeyForClip(clip, serverFilters.monthKey);
        const qs = new URLSearchParams();
        qs.set('pipelineIds', draft.pipelineId);
        qs.set('yearMonth', yearMonth);
        qs.set('weekKey', cell.weekKey);
        qs.set('salesperson', cell.salesperson);
        qs.set('metric', cell.metric);
        if (cell.isTotal) qs.set('isTotal', '1');
        if (serverFilters.status !== 'all') qs.set('status', serverFilters.status);
        if (serverFilters.tag !== 'all') qs.set('tag', serverFilters.tag);
        if (clip) {
          qs.set('clipFrom', new Date(clip.startMs).toISOString());
          qs.set('clipTo', new Date(clip.endMs).toISOString());
          if (clip.label) qs.set('clipLabel', clip.label);
        }
        if (myOnly && currentUsername) qs.set('mine', currentUsername);
        const res = await fetch(`/api/crm-pipeline/sales-performance-inspect?${qs}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load details');
        setInspectData(json.inspect ?? null);
      } catch (e) {
        setInspectError(e instanceof Error ? e.message : 'Failed to load details');
      } finally {
        setInspectLoading(false);
      }
    },
    [
      serverFilters,
      draft.pipelineId,
      myOnly,
      currentUsername,
    ]
  );

  const handleToggleToday = () => {
    const nextPreset = serverFilters.datePreset === 'today' ? 'month' : 'today';
    const clip = resolveSalesPerformanceClip(
      nextPreset,
      serverFilters.customFrom,
      serverFilters.customTo
    );
    const monthKey = monthKeyForClip(clip, draft.monthKey);
    onApplyServerFilters({
      ...serverFilters,
      datePreset: nextPreset,
      monthKey,
      pipelineId: draft.pipelineId,
      status: draft.status,
      tag: draft.tag,
    });
    setDraft((d) => ({ ...d, monthKey }));
  };

  return (
    <>
      <CrmPipelineSalesPerformanceInspectSidebar
        open={inspectOpen}
        onClose={() => setInspectOpen(false)}
        loading={inspectLoading}
        error={inspectError}
        data={inspectData}
      />
    <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1 pb-2">
      <div className="shrink-0 rounded-xl border border-[var(--theme-primary)]/25 bg-[var(--theme-light)]/80 dark:bg-slate-900/60 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2 gap-y-2">
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            title={filtersOpen ? 'Hide filter fields' : 'Show filter fields'}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--theme-primary)] text-gray-900 text-sm font-bold shadow-md hover:brightness-105 shrink-0"
          >
            <Filter size={16} className="shrink-0" aria-hidden />
            {filtersOpen ? 'Hide filters' : 'Show filters'}
            {filtersOpen ? (
              <ChevronUp size={16} className="opacity-70 shrink-0" aria-hidden />
            ) : (
              <ChevronDown size={16} className="opacity-70 shrink-0" aria-hidden />
            )}
          </button>
          {!filtersOpen ? (
            <p
              className="text-xs text-slate-600 dark:text-slate-400 truncate min-w-0 max-w-[min(100%,28rem)]"
              title={activeFiltersSummary}
            >
              {activeFiltersSummary}
            </p>
          ) : null}
          <div aria-hidden className="flex-1 min-w-[0.5rem] min-h-px" />
          <button
            type="button"
            onClick={handleToggleToday}
            className={`inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-bold border shadow-sm transition-colors shrink-0 ${
              serverFilters.datePreset === 'today'
                ? 'bg-[var(--theme-primary)] text-gray-900 border-[var(--theme-primary)]'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-[var(--theme-primary)]/30 hover:bg-amber-50/80'
            }`}
            title={
              serverFilters.datePreset === 'today'
                ? 'Showing today only — click to use full month'
                : 'Filter actuals to today only'
            }
          >
            Today
          </button>
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
            title="Reset filters to defaults"
          >
            <RotateCcw size={16} />
            Reset
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--theme-primary)] text-gray-900 text-sm font-bold shadow-md hover:brightness-105 shrink-0"
          >
            <Filter size={16} />
            Apply filters
          </button>
        </div>
        {filtersOpen ? (
          <div className="mt-3 pt-3 border-t border-[var(--theme-primary)]/15">
            <CrmPipelinePerformanceFilterBar
              embedded
              pipelines={pipelineOptions}
              weekOptions={data.weekOptions}
              salespeople={data.salespeople}
              monthOptions={monthOptions}
              tagOptions={data.tagOptions}
              draft={draft}
              onDraftChange={setDraft}
            />
          </div>
        ) : null}
      </div>
      <CrmPipelinePerformanceKpiStrip summary={viewData.kpiSummary} />
      {plannedContext ? (
        <div className="flex flex-wrap items-center justify-between gap-2 shrink-0 px-0.5">
          <p className="text-[10px] text-slate-500">
            {canEditPlanned ? (
              <>
                Double-click <strong className="font-semibold">Planned by us</strong> (admin). Only changed rows are
                written to the sheet (week <strong>w1</strong> = Week 1 in the table).
              </>
            ) : (
              <>Planned targets are view-only. Contact an admin to update.</>
            )}
          </p>
          {canEditPlanned ? (
            <button
              type="button"
              disabled={!plannedDirty || savingPlanned}
              onClick={() => void handleSavePlanned()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--theme-primary)] text-gray-900 text-sm font-bold shadow-md disabled:opacity-45 shrink-0"
            >
              {savingPlanned ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save planned changes
            </button>
          ) : null}
        </div>
      ) : null}
      <CrmPipelinePerformanceTable
        monthLabel={
          data.rangeLabel
            ? displayTitleWithClip(data.monthLabel, {
                startMs: 0,
                endMs: 0,
                label: data.rangeLabel,
              })
            : data.monthLabel
        }
        weeks={displayWeeks}
        editablePlanned={Boolean(plannedContext) && canEditPlanned}
        onPlannedChange={handlePlannedChange}
        onInspectActual={(cell) => void handleInspectActual(cell)}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 shrink-0 min-h-[20rem]">
        <div className="lg:col-span-2">
          <CrmPipelineRevenueProfitChart
            series={viewData.chartSeries}
            weekOptions={data.weekOptions}
          />
        </div>
        <CrmPipelinePerformanceNotes />
      </div>
    </div>
    </>
  );
}