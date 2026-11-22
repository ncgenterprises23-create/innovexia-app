'use client';

import { Fragment } from 'react';
import {
  FIVE_FOR_THREE_METRIC_LABELS,
  FIVE_FOR_THREE_METRIC_ORDER,
  formatFiveForThreeActual,
  formatFiveForThreePlanned,
  type FiveForThreeMonth,
  type FiveForThreeMetricKey,
} from '@/lib/crmPipelineFiveForThree';
import { actualVsPlannedHighlightClass } from '@/lib/crmPlannedActualHighlight';

const DASH_SHADOW = 'shadow-[0_2px_4px_rgba(15,23,42,0.12),0_8px_16px_-2px_rgba(15,23,42,0.22)]';
const LIGHT_SURFACE =
  'bg-[var(--theme-light)] dark:bg-[var(--theme-primary)]/15 border border-[var(--theme-primary)]/25';

function conversionBadgeClass(value: number): string {
  if (value >= 30) return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-400/80';
  if (value >= 15) return 'bg-amber-100 text-amber-900 ring-1 ring-amber-400/80';
  return 'bg-sky-100 text-sky-900 ring-1 ring-sky-300/80';
}

function renderFiveForThreeActual(
  metricKey: FiveForThreeMetricKey,
  cell: { planned: number | null; actual: number | null },
  totalRow: boolean
) {
  const raw = formatFiveForThreeActual(metricKey, cell.actual);
  if (raw === '—') return <span className="text-slate-400">—</span>;

  if (metricKey === 'conversion_ratio') {
    const v = typeof cell.actual === 'number' ? cell.actual : 0;
    return (
      <span
        className={`inline-flex items-center justify-center min-w-[3.25rem] px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${conversionBadgeClass(v)}`}
      >
        {raw}
      </span>
    );
  }

  if (metricKey === 'revenue' || metricKey === 'avg_sale') {
    const n = cell.actual ?? 0;
    const formatted =
      n >= 1_00_000
        ? `₹${(n / 1_00_000).toFixed(2)}L`
        : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    return (
      <span
        className={
          totalRow ? 'font-bold text-amber-950 dark:text-amber-50' : 'text-slate-800 dark:text-slate-100'
        }
      >
        {formatted}
      </span>
    );
  }

  return (
    <span className={totalRow ? 'font-bold text-amber-950 dark:text-amber-50' : ''}>{raw}</span>
  );
}

function SubHeaderCells() {
  return (
    <>
      {FIVE_FOR_THREE_METRIC_ORDER.map((key) => (
        <Fragment key={key}>
          <th className="text-center font-semibold px-1 py-1 text-[10px] text-slate-700 dark:text-amber-100 border-r border-amber-300/60">
            Planned
          </th>
          <th className="text-center font-semibold px-1 py-1 text-[10px] text-slate-800 dark:text-amber-50 border-r border-amber-300/60">
            Actual
          </th>
        </Fragment>
      ))}
    </>
  );
}

function MonthTable({ month }: { month: FiveForThreeMonth }) {
  return (
    <div className={`rounded-lg ${LIGHT_SURFACE} ${DASH_SHADOW} overflow-hidden mb-4`}>
      <h3 className="text-center text-sm font-bold text-slate-800 dark:text-slate-100 py-2 border-b border-amber-300/70 bg-amber-50/50 dark:bg-amber-950/20">
        {month.label}
      </h3>
      <div className="overflow-x-auto custom-scrollbar max-h-[min(32rem,calc(100vh-14rem))] overflow-y-auto pb-6 scroll-pb-6">
        <table className="w-full text-xs border-collapse min-w-[980px]">
          <thead className="sticky top-0 z-30">
            <tr className="bg-amber-200/90 dark:bg-amber-900/55 border-b border-amber-400/80">
              <th
                rowSpan={2}
                className="text-left font-bold px-2 py-2 sticky left-0 z-40 bg-amber-200/90 dark:bg-amber-900/55 min-w-[10.5rem] max-w-[12rem] border-r border-amber-400/60 text-slate-900 dark:text-amber-50 text-[10px] leading-snug"
              >
                Week
              </th>
              <th
                rowSpan={2}
                className="text-left font-bold px-2 py-2 sticky left-[10.5rem] z-40 bg-amber-200/90 dark:bg-amber-900/55 min-w-[6.5rem] border-r border-amber-400/60 text-slate-900 dark:text-amber-50"
              >
                Salesperson
              </th>
              {FIVE_FOR_THREE_METRIC_ORDER.map((key) => (
                <th
                  key={key}
                  colSpan={2}
                  className="text-center font-bold px-1 py-1 border-r border-amber-400/50 text-slate-900 dark:text-amber-50 text-[10px] leading-snug"
                >
                  {FIVE_FOR_THREE_METRIC_LABELS[key]}
                </th>
              ))}
            </tr>
            <tr className="bg-amber-100/90 dark:bg-amber-950/40 border-b-2 border-amber-500/80">
              <SubHeaderCells />
            </tr>
          </thead>
          <tbody>
            {month.weeks.map((week) =>
              week.rows.map((row, rowIdx) => {
                const totalRow = row.isTotal;
                const rowBg = totalRow
                  ? 'bg-amber-100/90 dark:bg-amber-950/35'
                  : rowIdx % 2 === 1
                    ? 'bg-amber-50/25 dark:bg-slate-900/30'
                    : 'bg-white dark:bg-slate-950/10';
                return (
                  <tr
                    key={`${week.label}-${row.salesperson}-${rowIdx}`}
                    className={`border-b border-amber-300/80 dark:border-amber-700/55 ${rowBg} ${
                      totalRow ? 'border-b-2 border-amber-400 dark:border-amber-500 font-semibold' : ''
                    }`}
                  >
                    {rowIdx === 0 ? (
                      <td
                        rowSpan={week.rows.length}
                        className={`px-2 py-1.5 align-top font-bold sticky left-0 z-20 border-r border-amber-300/70 min-w-[10.5rem] max-w-[12rem] text-[10px] leading-snug ${rowBg} text-slate-800 dark:text-slate-100`}
                      >
                        {week.label}
                      </td>
                    ) : null}
                    <td
                      className={`px-2 py-1.5 sticky left-[10.5rem] z-10 border-r border-amber-200/80 ${rowBg} ${
                        totalRow
                          ? 'font-bold text-amber-950 dark:text-amber-100'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {row.salesperson}
                    </td>
                    {FIVE_FOR_THREE_METRIC_ORDER.map((metricKey: FiveForThreeMetricKey) => {
                      const cell = row.metrics[metricKey];
                      return (
                        <Fragment key={metricKey}>
                          <td className="px-1.5 py-1.5 text-center tabular-nums text-slate-400 border-r border-amber-200/60">
                            {formatFiveForThreePlanned(metricKey, cell.planned)}
                          </td>
                          <td
                            className={`px-1.5 py-1.5 tabular-nums border-r border-amber-200/60 ${
                              metricKey === 'conversion_ratio' ? 'text-center' : 'text-right'
                            } ${actualVsPlannedHighlightClass(cell.planned, cell.actual)}`}
                          >
                            {renderFiveForThreeActual(metricKey, cell, totalRow)}
                          </td>
                        </Fragment>
                      );
                    })}
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

export default function CrmPipelineFiveForThreeTable({ months }: { months: FiveForThreeMonth[] }) {
  if (months.length === 0) {
    return (
      <div className="text-center text-sm text-slate-500 py-12">No data for the selected range.</div>
    );
  }
  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
      {months.map((m) => (
        <MonthTable key={`${m.year}-${m.month}`} month={m} />
      ))}
    </div>
  );
}