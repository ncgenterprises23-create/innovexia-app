'use client';

import { useEffect, useRef, useState } from 'react';
import {
  formatSalesPerformanceActual,
  formatSalesPerformanceCurrency,
  type SalesPerformanceRow,
  type SalesPerformanceWeek,
} from '@/lib/crmPipelineSalesPerformance';
import {
  formatSalesPerformancePlanned,
  plannedCellKey,
} from '@/lib/crmPipelineSalesPerformancePlanned';
import { actualVsPlannedHighlightClass } from '@/lib/crmPlannedActualHighlight';

const DASH_SHADOW = 'shadow-[0_2px_4px_rgba(15,23,42,0.12),0_8px_16px_-2px_rgba(15,23,42,0.22)]';
const LIGHT_SURFACE =
  'bg-[var(--theme-light)] dark:bg-[var(--theme-primary)]/15 border border-[var(--theme-primary)]/25';

const TH_MAIN =
  'bg-amber-200/90 dark:bg-amber-900/55 text-slate-900 dark:text-amber-50 border-r border-amber-400/60';

function conversionBadgeClass(value: number): string {
  if (value >= 30) return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-400/80';
  if (value >= 15) return 'bg-amber-100 text-amber-900 ring-1 ring-amber-400/80';
  return 'bg-sky-100 text-sky-900 ring-1 ring-sky-300/80';
}

function ConversionBadge({ value }: { value: number | null | undefined }) {
  const text = formatSalesPerformanceActual('conversion_ratio', value);
  if (text === '—') return <span className="text-slate-400">—</span>;
  const v = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[3.5rem] px-2.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${conversionBadgeClass(v)}`}
    >
      {text}
    </span>
  );
}

function MoneyCell({ value }: { value: number | null | undefined }) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <span className="inline-flex items-center justify-center gap-0.5 tabular-nums font-medium text-slate-800 dark:text-slate-100">
      {formatSalesPerformanceCurrency(value)}
    </span>
  );
}

function weekShortLabel(label: string): string {
  const m = label.match(/^Week\s+(\d+)/i);
  return m ? `Week ${m[1]}` : label.slice(0, 14);
}

function weekDateRangeLabel(label: string): string {
  const m = label.match(/\(([^)]+)\)/);
  return m ? m[1].trim() : '';
}

type PlannedField = 'leads' | 'meetings';

function PlannedEditCell({
  weekKey,
  salesperson,
  field,
  value,
  editable,
  editingKey,
  onStartEdit,
  onCommit,
}: {
  weekKey: string;
  salesperson: string;
  field: PlannedField;
  value: number | null | undefined;
  editable: boolean;
  editingKey: string | null;
  onStartEdit: (key: string) => void;
  onCommit: (weekKey: string, salesperson: string, field: PlannedField, raw: string) => void;
}) {
  const cellId = `${plannedCellKey(weekKey, salesperson)}|${field}`;
  const isEditing = editingKey === cellId;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  if (!editable) {
    const hasValue = value != null && Number.isFinite(value);
    return (
      <span className={`tabular-nums ${hasValue ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
        {formatSalesPerformancePlanned(value)}
      </span>
    );
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={0}
        step={1}
        defaultValue={value != null && Number.isFinite(value) ? String(Math.round(value)) : ''}
        className="w-14 max-w-full mx-auto block text-center text-xs rounded border border-amber-400 bg-white px-1 py-0.5"
        onBlur={(e) => onCommit(weekKey, salesperson, field, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') onStartEdit('');
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="w-full min-h-[1.35rem] rounded px-1 text-center tabular-nums text-slate-600 hover:bg-amber-100/90 dark:hover:bg-amber-950/40 border border-transparent hover:border-amber-300/70 cursor-text"
      title="Double-click to edit planned target"
      onDoubleClick={() => onStartEdit(cellId)}
    >
      {formatSalesPerformancePlanned(value)}
    </button>
  );
}

type Props = {
  monthLabel: string;
  weeks: SalesPerformanceWeek[];
  editablePlanned?: boolean;
  onPlannedChange?: (
    weekKey: string,
    salesperson: string,
    field: PlannedField,
    value: number | null
  ) => void;
};

export default function CrmPipelinePerformanceTable({
  monthLabel,
  weeks,
  editablePlanned = false,
  onPlannedChange,
}: Props) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  if (weeks.length === 0) {
    return <p className="text-sm text-slate-500 py-8 text-center">No data for this period.</p>;
  }

  const displayWeeks: { label: string; rows: SalesPerformanceRow[] }[] = weeks.map((w) => ({
    label: w.weekLabel,
    rows: w.rows,
  }));

  return (
    <div className={`rounded-xl ${LIGHT_SURFACE} ${DASH_SHADOW} flex flex-col shrink-0`}>
      <h3 className="text-center text-sm font-bold text-slate-800 dark:text-slate-100 py-2 border-b border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/20 shrink-0">
        {monthLabel}
      </h3>
      <div className="overflow-x-auto pb-2">
        <table className="w-full text-xs border-collapse min-w-[1120px]">
          <thead>
            <tr className={`border-b border-amber-400/80 ${TH_MAIN}`}>
              <th
                rowSpan={2}
                className={`text-left font-bold px-2 py-2 min-w-[7.5rem] ${TH_MAIN}`}
              >
                Week
              </th>
              <th
                rowSpan={2}
                className={`text-left font-bold px-2 py-2 min-w-[7.5rem] ${TH_MAIN}`}
              >
                Sales Person
              </th>
              <th colSpan={2} className={`text-center font-bold px-1 py-1.5 text-[10px] leading-snug ${TH_MAIN}`}>
                No. of Leads
              </th>
              <th colSpan={2} className={`text-center font-bold px-1 py-1.5 text-[10px] leading-snug ${TH_MAIN}`}>
                No. of Meetings
              </th>
              <th
                rowSpan={2}
                className={`text-center font-bold px-2 py-2 text-[10px] leading-snug min-w-[7rem] ${TH_MAIN}`}
              >
                Conversion Ratio
                <br />
                <span className="font-semibold text-[9px]">(Meetings → Clients)</span>
              </th>
              <th rowSpan={2} className={`text-center font-bold px-2 py-2 min-w-[6.5rem] ${TH_MAIN}`}>
                Revenue
              </th>
              <th rowSpan={2} className={`text-center font-bold px-2 py-2 min-w-[6rem] ${TH_MAIN}`}>
                Costing
              </th>
              <th rowSpan={2} className={`text-center font-bold px-2 py-2 min-w-[6.5rem] ${TH_MAIN}`}>
                Profit
                <br />
                <span className="font-semibold text-[9px]">(Revenue − Costing)</span>
              </th>
            </tr>
            <tr className="bg-amber-100/95 dark:bg-amber-950/50 border-b-2 border-amber-500/80 text-slate-800 dark:text-amber-100">
              <th className="text-center font-semibold px-1 py-1 text-[10px] border-r border-amber-300/70">
                Planned by us
              </th>
              <th className="text-center font-semibold px-1 py-1 text-[10px] border-r border-amber-300/70">
                Actual no.
              </th>
              <th className="text-center font-semibold px-1 py-1 text-[10px] border-r border-amber-300/70">
                Planned by us
              </th>
              <th className="text-center font-semibold px-1 py-1 text-[10px] border-r border-amber-300/70">
                Actual no.
              </th>
            </tr>
          </thead>
          <tbody className="[&>tr:last-child>td]:pb-2">
            {displayWeeks.map((week) =>
              week.rows.map((row, rowIdx) => {
                const totalRow = row.isTotal;
                const rowBg = totalRow
                  ? 'bg-amber-100/90 dark:bg-amber-950/35'
                  : rowIdx % 2 === 1
                    ? 'bg-amber-50/20 dark:bg-slate-900/25'
                    : 'bg-white dark:bg-slate-950/10';
                const conv = row.metrics.conversion_ratio.actual ?? 0;
                return (
                  <tr
                    key={`${week.label}-${row.salesperson}-${rowIdx}`}
                    className={`border-b border-amber-200/80 dark:border-amber-800/50 ${rowBg} ${
                      totalRow ? 'font-semibold border-b-2 border-amber-400/70' : ''
                    }`}
                  >
                    {rowIdx === 0 ? (
                      <td
                        rowSpan={week.rows.length}
                        className={`px-2 py-2 align-top border-r border-amber-200/70 ${rowBg} min-w-[7.5rem]`}
                      >
                        <span className="inline-block px-2.5 py-1 rounded-full bg-[var(--theme-primary)] text-gray-900 text-xs font-black leading-tight">
                          {weekShortLabel(week.label)}
                        </span>
                        {weekDateRangeLabel(week.label) ? (
                          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-1.5 leading-snug max-w-[6.5rem]">
                            ({weekDateRangeLabel(week.label)})
                          </p>
                        ) : null}
                      </td>
                    ) : null}
                    <td
                      className={`px-2 py-1.5 border-r border-amber-200/60 ${rowBg} ${
                        totalRow ? 'text-amber-950 dark:text-amber-100' : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {row.salesperson}
                    </td>
                    <td className="px-1.5 py-1.5 text-center border-r border-amber-100/80">
                      <PlannedEditCell
                        weekKey={row.weekKey}
                        salesperson={row.salesperson}
                        field="leads"
                        value={row.metrics.leads.planned}
                        editable={editablePlanned && !totalRow}
                        editingKey={editingKey}
                        onStartEdit={setEditingKey}
                        onCommit={(wk, sp, field, raw) => {
                          setEditingKey(null);
                          const trimmed = raw.trim();
                          const next =
                            trimmed === '' ? null : Number.isFinite(Number(trimmed)) ? Number(trimmed) : null;
                          onPlannedChange?.(wk, sp, field, next);
                        }}
                      />
                    </td>
                    <td
                      className={`px-1.5 py-1.5 text-center tabular-nums border-r border-amber-100/80 ${actualVsPlannedHighlightClass(
                        row.metrics.leads.planned,
                        row.metrics.leads.actual
                      )}`}
                    >
                      {formatSalesPerformanceActual('leads', row.metrics.leads.actual)}
                    </td>
                    <td className="px-1.5 py-1.5 text-center border-r border-amber-100/80">
                      <PlannedEditCell
                        weekKey={row.weekKey}
                        salesperson={row.salesperson}
                        field="meetings"
                        value={row.metrics.meetings.planned}
                        editable={editablePlanned && !totalRow}
                        editingKey={editingKey}
                        onStartEdit={setEditingKey}
                        onCommit={(wk, sp, field, raw) => {
                          setEditingKey(null);
                          const trimmed = raw.trim();
                          const next =
                            trimmed === '' ? null : Number.isFinite(Number(trimmed)) ? Number(trimmed) : null;
                          onPlannedChange?.(wk, sp, field, next);
                        }}
                      />
                    </td>
                    <td
                      className={`px-1.5 py-1.5 text-center tabular-nums border-r border-amber-100/80 ${actualVsPlannedHighlightClass(
                        row.metrics.meetings.planned,
                        row.metrics.meetings.actual
                      )}`}
                    >
                      {formatSalesPerformanceActual('meetings', row.metrics.meetings.actual)}
                    </td>
                    <td className="px-1.5 py-1.5 text-center border-r border-amber-100/80">
                      <ConversionBadge value={conv} />
                    </td>
                    <td className="px-2 py-1.5 text-center border-r border-amber-100/80">
                      <MoneyCell value={row.metrics.revenue.actual} />
                    </td>
                    <td className="px-2 py-1.5 text-center border-r border-amber-100/80">
                      <MoneyCell value={row.metrics.costing.actual} />
                    </td>
                    <td className="px-2 py-1.5 text-center font-bold text-amber-900 dark:text-amber-200">
                      <MoneyCell value={row.metrics.profit.actual} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}