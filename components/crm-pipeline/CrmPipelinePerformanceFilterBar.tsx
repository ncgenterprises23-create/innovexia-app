'use client';

import { useMemo } from 'react';
import CrmSearchableSelectFilter from '@/components/crm-pipeline/CrmSearchableSelectFilter';
import { CRM_TAG_FILTER_ALL } from '@/lib/crmPipelineDashboard';
import type { SalesPerformanceStatusFilter } from '@/lib/crmPipelineSalesPerformance';

export type PerformanceFilterState = {
  pipelineId: string;
  monthKey: string;
  weekKey: string;
  salesperson: string;
  status: SalesPerformanceStatusFilter;
  tag: string;
};

type PipelineOption = { id: string; name: string };

type Props = {
  pipelines: PipelineOption[];
  weekOptions: { key: string; label: string }[];
  salespeople: string[];
  monthOptions: { value: string; label: string }[];
  tagOptions: string[];
  draft: PerformanceFilterState;
  onDraftChange: (next: PerformanceFilterState) => void;
  /** When true, no outer card border (nested inside parent filter panel). */
  embedded?: boolean;
};

const STATUS_OPTIONS: { value: SalesPerformanceStatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

const FILTER_COL = 'min-w-[11rem] flex-1 basis-[11rem]';
const fieldClass =
  'rounded-lg border border-[var(--theme-primary)]/25 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm min-w-0';

export default function CrmPipelinePerformanceFilterBar({
  pipelines,
  weekOptions,
  salespeople,
  monthOptions,
  tagOptions,
  draft,
  onDraftChange,
  embedded = false,
}: Props) {
  const pipelineOpts = useMemo(
    () => pipelines.map((p) => ({ value: p.id, label: p.name })),
    [pipelines]
  );
  const weekOpts = useMemo(
    () => weekOptions.map((w) => ({ value: w.key, label: w.label })),
    [weekOptions]
  );
  const salespersonOpts = useMemo(
    () => salespeople.map((sp) => ({ value: sp, label: sp })),
    [salespeople]
  );
  const monthOpts = useMemo(
    () => monthOptions.map((m) => ({ value: m.value, label: m.label })),
    [monthOptions]
  );
  const tagOpts = useMemo(
    () => tagOptions.map((t) => ({ value: t, label: t })),
    [tagOptions]
  );

  const inputProps = { inputClassName: `${fieldClass} w-full`, placeholder: 'Search or pick…' as const };

  const shell = embedded
    ? 'flex flex-wrap items-end gap-3'
    : 'shrink-0 rounded-xl border border-[var(--theme-primary)]/25 bg-[var(--theme-light)]/80 dark:bg-slate-900/60 px-3 py-3 flex flex-wrap items-end gap-3';

  return (
    <div className={shell}>
      <div className={FILTER_COL}>
        <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
          Pipeline
        </label>
        <CrmSearchableSelectFilter
          value={draft.pipelineId}
          options={pipelineOpts}
          onChange={(pipelineId) => onDraftChange({ ...draft, pipelineId })}
          {...inputProps}
        />
      </div>
      <div className={FILTER_COL}>
        <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
          Week
        </label>
        <CrmSearchableSelectFilter
          value={draft.weekKey}
          options={weekOpts}
          allValue="all"
          allLabel="All weeks"
          onChange={(weekKey) => onDraftChange({ ...draft, weekKey })}
          {...inputProps}
        />
      </div>
      <div className={FILTER_COL}>
        <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
          Salesperson
        </label>
        <CrmSearchableSelectFilter
          value={draft.salesperson}
          options={salespersonOpts}
          allValue="all"
          allLabel="All salespersons"
          onChange={(salesperson) => onDraftChange({ ...draft, salesperson })}
          {...inputProps}
        />
      </div>
      <div className={FILTER_COL}>
        <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
          Month
        </label>
        <CrmSearchableSelectFilter
          value={draft.monthKey}
          options={monthOpts}
          onChange={(monthKey) => onDraftChange({ ...draft, monthKey })}
          {...inputProps}
        />
      </div>
      <div className={FILTER_COL}>
        <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
          Tags
        </label>
        <CrmSearchableSelectFilter
          value={draft.tag}
          options={tagOpts}
          allValue={CRM_TAG_FILTER_ALL}
          allLabel="All tags"
          onChange={(tag) => onDraftChange({ ...draft, tag })}
          {...inputProps}
        />
      </div>
      <div className={FILTER_COL}>
        <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
          Status
        </label>
        <CrmSearchableSelectFilter
          value={draft.status}
          options={STATUS_OPTIONS}
          allValue="all"
          allLabel="All status"
          onChange={(status) =>
            onDraftChange({ ...draft, status: status as SalesPerformanceStatusFilter })
          }
          {...inputProps}
        />
      </div>
    </div>
  );
}