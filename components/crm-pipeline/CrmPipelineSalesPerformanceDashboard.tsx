'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, Loader2 } from 'lucide-react';
import CrmPipelineDashboardInfoSidebar from '@/components/crm-pipeline/CrmPipelineDashboardInfoSidebar';
import CrmPipelineSalesPerformanceView from '@/components/crm-pipeline/CrmPipelineSalesPerformanceView';
import { CRM_DASHBOARD_ALL_PIPELINES } from '@/components/crm-pipeline/CrmPipelineDashboard';
import type {
  SalesPerformanceBuildResult,
  SalesPerformanceStatusFilter,
} from '@/lib/crmPipelineSalesPerformance';
import {
  defaultCustomRange,
  displayTitleWithClip,
  monthKeyForClip,
  resolveSalesPerformanceClip,
  type SalesPerformanceDatePreset,
} from '@/lib/crmSalesPerformanceDateRange';

type PipelineOption = { id: string; name: string };

const DASH_SHADOW = 'shadow-[0_2px_4px_rgba(15,23,42,0.12),0_8px_16px_-2px_rgba(15,23,42,0.22)]';

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthEndIso(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return end.toISOString();
}

export function buildSalesPerformanceMonthOptions(count = 12): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const anchor = new Date();
  for (let i = 0; i < count; i++) {
    const dt = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    const value = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const label = dt.toLocaleString('en-IN', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
    opts.push({ value, label });
  }
  return opts;
}

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

export type SalesPerformanceServerFilters = {
  pipelineId: string;
  monthKey: string;
  status: SalesPerformanceStatusFilter;
  tag: string;
  datePreset: SalesPerformanceDatePreset;
  customFrom: string;
  customTo: string;
};

export function createDefaultSalesPerformanceServerFilters(): SalesPerformanceServerFilters {
  const custom = defaultCustomRange();
  return {
    pipelineId: CRM_DASHBOARD_ALL_PIPELINES,
    monthKey: currentMonthKey(),
    status: 'all',
    tag: 'all',
    datePreset: 'month',
    customFrom: custom.from,
    customTo: custom.to,
  };
}

export default function CrmPipelineSalesPerformanceDashboard({
  pipelines,
  myOnly,
  currentUsername,
  canEditPlanned = false,
  currentUserRole,
}: {
  pipelines: PipelineOption[];
  myOnly: boolean;
  currentUsername?: string;
  canEditPlanned?: boolean;
  currentUserRole?: string;
}) {
  const monthOptions = useMemo(() => buildSalesPerformanceMonthOptions(12), []);
  const pipelineOptions = useMemo(
    () => [{ id: CRM_DASHBOARD_ALL_PIPELINES, name: 'All pipelines' }, ...pipelines],
    [pipelines]
  );

  const defaultCustom = useMemo(() => defaultCustomRange(), []);
  const [serverFilters, setServerFilters] = useState<SalesPerformanceServerFilters>({
    pipelineId: CRM_DASHBOARD_ALL_PIPELINES,
    monthKey: currentMonthKey(),
    status: 'all',
    tag: 'all',
    datePreset: 'month',
    customFrom: defaultCustom.from,
    customTo: defaultCustom.to,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salesPerformance, setSalesPerformance] = useState<SalesPerformanceBuildResult | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const load = useCallback(async () => {
    if (pipelines.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('pipelineIds', serverFilters.pipelineId);
      qs.set('presetCount', '1');
      qs.set('granularity', 'month');
      qs.set('report', 'salesPerformance');
      const clip = resolveSalesPerformanceClip(
        serverFilters.datePreset,
        serverFilters.customFrom,
        serverFilters.customTo
      );
      const yearMonth = monthKeyForClip(clip, serverFilters.monthKey);
      qs.set('to', clip ? new Date(clip.endMs).toISOString() : monthEndIso(yearMonth));
      qs.set('yearMonth', yearMonth);
      if (clip) {
        qs.set('clipFrom', new Date(clip.startMs).toISOString());
        qs.set('clipTo', new Date(clip.endMs).toISOString());
        qs.set('clipLabel', clip.label);
      }
      if (serverFilters.status !== 'all') qs.set('status', serverFilters.status);
      if (serverFilters.tag !== 'all') qs.set('tag', serverFilters.tag);
      if (myOnly && currentUsername) qs.set('mine', currentUsername);
      const res = await fetchDash(`/api/crm-pipeline/dashboard?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load dashboard');
      setSalesPerformance(json.salesPerformance ?? null);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      setSalesPerformance(null);
    } finally {
      setLoading(false);
    }
  }, [pipelines.length, serverFilters, myOnly, currentUsername]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeClip = useMemo(
    () =>
      resolveSalesPerformanceClip(
        serverFilters.datePreset,
        serverFilters.customFrom,
        serverFilters.customTo
      ),
    [serverFilters.datePreset, serverFilters.customFrom, serverFilters.customTo]
  );
  const title = salesPerformance
    ? `Sales Performance (${displayTitleWithClip(salesPerformance.monthLabel, activeClip)})`
    : 'Sales Performance';

  return (
    <>
      <CrmPipelineDashboardInfoSidebar
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        activeReport="salesPerformance"
      />
      <div className="flex flex-1 min-h-0 flex-col px-4 py-3 overflow-hidden">
        <div className="flex items-center justify-center gap-2 mb-2 shrink-0 relative">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="absolute right-0 p-1.5 rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-100/80 dark:hover:bg-amber-950/40 border border-transparent hover:border-amber-300/60 dark:hover:border-amber-700/50 transition-colors"
            title="How dashboard numbers are calculated"
            aria-label="Open calculation details"
          >
            <Info className="w-4 h-4" aria-hidden />
          </button>
        </div>
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500 flex-1">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading dashboard…
          </div>
        )}
        {error && !loading && (
          <div className={`rounded-lg px-4 py-3 text-sm border border-red-200 bg-red-50 text-red-800 ${DASH_SHADOW}`}>
            {error}
          </div>
        )}
        {!loading && salesPerformance && (
          <CrmPipelineSalesPerformanceView
            data={salesPerformance}
            pipelineOptions={pipelineOptions}
            monthOptions={monthOptions}
            serverFilters={serverFilters}
            onApplyServerFilters={(next) => setServerFilters(next)}
            currentUsername={currentUsername}
            canEditPlanned={canEditPlanned}
            currentUserRole={currentUserRole}
            onPlannedSaved={() => void load()}
            myOnly={myOnly}
          />
        )}
      </div>
    </>
  );
}