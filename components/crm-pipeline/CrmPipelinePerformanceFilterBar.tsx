'use client';

import { Filter, RotateCcw } from 'lucide-react';
import type { SalesPerformanceStatusFilter } from '@/lib/crmPipelineSalesPerformance';

export type PerformanceFilterState = {
  pipelineId: string;
  monthKey: string;
  weekKey: string;
  salesperson: string;
  status: SalesPerformanceStatusFilter;
};

type PipelineOption = { id: string; name: string };

type Props = {
  pipelines: PipelineOption[];
  weekOptions: { key: string; label: string }[];
  salespeople: string[];
  monthOptions: { value: string; label: string }[];
  draft: PerformanceFilterState;
  onDraftChange: (next: PerformanceFilterState) => void;
  onApply: () => void;
  onReset?: () => void;
  todayActive?: boolean;
  onToggleToday?: () => void;
};

export default function CrmPipelinePerformanceFilterBar({
  pipelines,
  weekOptions,
  salespeople,
  monthOptions,
  draft,
  onDraftChange,
  onApply,
  onReset,
  todayActive = false,
  onToggleToday,
}: Props) {
  const fieldClass =
    'rounded-lg border border-[var(--theme-primary)]/25 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm min-w-0';

  return (
    <div className="shrink-0 rounded-xl border border-[var(--theme-primary)]/25 bg-[var(--theme-light)]/80 dark:bg-slate-900/60 px-3 py-3 flex flex-wrap items-end gap-3">
      <div className="min-w-[9rem] flex-1">
        <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
          Pipeline
        </label>
        <select
          className={`${fieldClass} w-full`}
          value={draft.pipelineId}
          onChange={(e) => onDraftChange({ ...draft, pipelineId: e.target.value })}
        >
          {pipelines.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[9rem] flex-1">
        <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
          Week
        </label>
        <select
          className={`${fieldClass} w-full`}
          value={draft.weekKey}
          onChange={(e) => onDraftChange({ ...draft, weekKey: e.target.value })}
        >
          <option value="all">All weeks</option>
          {weekOptions.map((w) => (
            <option key={w.key} value={w.key}>
              {w.label}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[10rem] flex-1">
        <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
          Salesperson
        </label>
        <select
          className={`${fieldClass} w-full`}
          value={draft.salesperson}
          onChange={(e) => onDraftChange({ ...draft, salesperson: e.target.value })}
        >
          <option value="all">All salespersons</option>
          {salespeople.map((sp) => (
            <option key={sp} value={sp}>
              {sp}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[11rem] flex-1">
        <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
          Month
        </label>
        <select
          className={`${fieldClass} w-full`}
          value={draft.monthKey}
          onChange={(e) => onDraftChange({ ...draft, monthKey: e.target.value })}
        >
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[9rem] flex-1">
        <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
          Status
        </label>
        <select
          className={`${fieldClass} w-full`}
          value={draft.status}
          onChange={(e) =>
            onDraftChange({ ...draft, status: e.target.value as SalesPerformanceStatusFilter })
          }
        >
          <option value="all">All status</option>
          <option value="open">Open</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {onToggleToday ? (
          <button
            type="button"
            onClick={onToggleToday}
            className={`inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-bold border shadow-sm transition-colors ${
              todayActive
                ? 'bg-[var(--theme-primary)] text-gray-900 border-[var(--theme-primary)]'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-[var(--theme-primary)]/30 hover:bg-amber-50/80'
            }`}
            title={todayActive ? 'Showing today only — click to use full month' : 'Filter actuals to today only'}
          >
            Today
          </button>
        ) : null}
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Reset filters to defaults"
          >
            <RotateCcw size={16} />
            Reset
          </button>
        ) : null}
        <button
          type="button"
          onClick={onApply}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--theme-primary)] text-gray-900 text-sm font-bold shadow-md hover:brightness-105"
        >
          <Filter size={16} />
          Apply filters
        </button>
      </div>
    </div>
  );
}