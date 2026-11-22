'use client';

import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, X } from 'lucide-react';
type Props = {
  open: boolean;
  onClose: () => void;
  activeReport: 'fiveFor5' | 'fiveFor3' | 'salesPerformance';
};

function SectionBlock({
  title,
  highlight,
  children,
}: {
  title: string;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border p-4 space-y-2 ${
        highlight
          ? 'border-amber-400/80 bg-amber-50/60 dark:bg-amber-950/25 dark:border-amber-600/50'
          : 'border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/50'
      }`}
    >
      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}

export default function CrmPipelineDashboardInfoSidebar({ open, onClose, activeReport }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] bg-black/40"
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed top-0 right-0 z-[56] h-full w-full max-w-md flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl"
            role="dialog"
            aria-labelledby="crm-dash-info-title"
          >
            <header className="shrink-0 flex items-start justify-between gap-3 px-4 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
              <div className="flex gap-2">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
                <div>
                  <h2 id="crm-dash-info-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Dashboard calculations
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    How numbers are built for 5 For 5, 5 For 3, and Sales Performance.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-600"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-4">
              <SectionBlock title="Shared rules" highlight={false}>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    <strong>Client identity</strong> — same company name, else contact name, else lead ID (one client per
                    key).
                  </li>
                  <li>
                    <strong>Revenue</strong> — numeric <em>Expected revenue</em> on the lead; ignored if missing or ≤ 0.
                  </li>
                  <li>
                    <strong>Costing</strong> — numeric <em>Costing</em> on the lead (Sales Performance view); wins only.
                  </li>
                  <li>
                    <strong>Won date</strong> — from activity log when outcome became Won, else lead <em>updated</em>{' '}
                    date when outcome is Won.
                  </li>
                  <li>
                    <strong>Pipeline scope</strong> — only leads in the pipeline(s) you select; optional “my leads only”
                    applies when enabled on the board.
                  </li>
                </ul>
              </SectionBlock>

              <SectionBlock title="5 For 5 report" highlight={activeReport === 'fiveFor5'}>
                <p>
                  Tag breakdown with one time column per period (month, quarter, or year). Filters: granularity, range
                  (last 1 / 3 / 6 periods), pipeline, and optional pipeline comparison.
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    <strong>No. of Unique Clients</strong> — distinct clients among leads whose <em>created</em> date
                    falls in that period.
                  </li>
                  <li>
                    <strong>Conversion Ratio</strong> — (won deals in period ÷ leads created in period) × 100. Won =
                    outcome Won and won date in period.
                  </li>
                  <li>
                    <strong>Average RS Sale</strong> — revenue in period ÷ number of won deals in period.
                  </li>
                  <li>
                    <strong>No of Transaction</strong> — count of won deals in the period.
                  </li>
                  <li>
                    <strong>Revenue</strong> — sum of expected revenue for wins in the period.
                  </li>
                  <li>
                    <strong>Margin</strong> — revenue × 30% (fixed rate in dashboard API).
                  </li>
                  <li>
                    <strong>Profit</strong> — revenue × 15% (fixed rate in dashboard API).
                  </li>
                  <li>
                    <strong>Category / Tags</strong> — one row per tag on leads in scope, plus a <em>Total</em> row
                    (all tags). Untagged leads appear as “(Untagged)”.
                  </li>
                  <li>
                    <strong>Q Avg</strong> (month view only) — average of the visible month columns; for conversion
                    and average sale this is a simple average of those values, not a re-rolled ratio.
                  </li>
                  <li>
                    <strong>Comparison mode</strong> — totals for the full selected range per pipeline (Total / All),
                    side by side at the top of the table.
                  </li>
                </ul>
              </SectionBlock>

              <SectionBlock title="5 For 3 report" highlight={activeReport === 'fiveFor3'}>
                <p>
                  Salesperson weekly scorecard for <strong>one calendar month</strong> (the month that contains the range
                  end). Rows are salespeople from each lead card; columns are weeks and metrics.{' '}
                  <strong>Planned</strong> for leads and unique meetings is loaded from the{' '}
                  <em>Sales Performance Planned</em> sheet (same targets as the Sales Performance dashboard).
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    <strong>Week buckets</strong> — Monday–Sunday weeks inside the month. Days before the first Monday
                    may form a short “prefix” week; if the 1st is Sunday, that Sunday is skipped (prior month’s week).
                  </li>
                  <li>
                    <strong>No Of Leads</strong> — leads <em>created</em> in that week, attributed to the salesperson on
                    the card.
                  </li>
                  <li>
                    <strong>No. of Unique Meetings</strong> — completed follow-ups in the week: activity type todo,
                    email, call, or meeting with Mark done. Counted once per salesperson + client per week.
                  </li>
                  <li>
                    <strong>No of Clients</strong> — distinct clients won in the week (outcome Won, won date in week).
                  </li>
                  <li>
                    <strong>Conversion Ratio</strong> — (clients ÷ unique meetings) × 100 for that week.
                  </li>
                  <li>
                    <strong>Revenue</strong> — expected revenue for wins in the week.
                  </li>
                  <li>
                    <strong>Avg Rs Sales</strong> — revenue ÷ clients for the week (0 if no clients).
                  </li>
                  <li>
                    <strong>TOTAL row</strong> — sums leads, revenue, and clients across people; unique meetings in
                    TOTAL dedupe by client only (not per salesperson), so team totals may differ from adding rows.
                  </li>
                </ul>
              </SectionBlock>

              <SectionBlock title="Sales Performance view" highlight={activeReport === 'salesPerformance'}>
                <p>
                  Executive-style view for the current month: filter bar, KPI tiles, salesperson table, and a revenue vs
                  profit chart. 5 For 5 and 5 For 3 reports are unchanged — switch report type in the filter panel.
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    <strong>Week × salesperson</strong> — same week buckets and salesperson name rules as 5 For 3.
                  </li>
                  <li>
                    <strong>Meetings</strong> — unique meetings (completed todo / email / call / meeting), same as 5 For
                    3.
                  </li>
                  <li>
                    <strong>Conversion</strong> — clients won ÷ unique meetings in that week.
                  </li>
                  <li>
                    <strong>Profit</strong> — revenue minus costing on wins in the week (not the fixed % used in 5 For
                    5).
                  </li>
                  <li>
                    <strong>Planned</strong> — shown as “—” until targets are added later.
                  </li>
                  <li>
                    <strong>Status filter</strong> — limits which leads are included (open / won / lost); reloads from
                    server on Apply.
                  </li>
                </ul>
              </SectionBlock>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}