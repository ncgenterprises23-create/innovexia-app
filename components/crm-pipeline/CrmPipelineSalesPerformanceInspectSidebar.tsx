'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, ListTree, Loader2, Search, X } from 'lucide-react';
import {
  formatSalesPerformanceActual,
  formatSalesPerformanceCurrency,
  type SalesPerformanceMetricKey,
} from '@/lib/crmPipelineSalesPerformance';
import {
  SALES_PERFORMANCE_INSPECT_METRIC_LABELS,
  type SalesPerformanceInspectOppContact,
  type SalesPerformanceInspectResult,
} from '@/lib/crmPipelineSalesPerformanceInspect';
import {
  downloadSalesPerformanceInspectCsv,
  filterInspectItems,
  filterInspectMeetings,
  filterInspectWon,
} from '@/lib/crmSalesPerformanceInspectCsv';

type Props = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  data: SalesPerformanceInspectResult | null;
};

function OppContactBlock({ row, subtitle }: { row: SalesPerformanceInspectOppContact; subtitle?: string }) {
  const fields: { label: string; value: string }[] = [
    { label: 'Name', value: row.name },
    { label: 'Contact name', value: row.contact_name },
    { label: 'Email', value: row.email },
    { label: 'Phone', value: row.phone },
    { label: 'Salesperson', value: row.salesperson },
  ];
  return (
    <div>
      <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{row.name}</p>
      {subtitle ? <p className="text-slate-500 text-[11px] mt-0.5">{subtitle}</p> : null}
      <dl className="mt-2 grid grid-cols-[7.5rem_1fr] gap-x-2 gap-y-1 text-[11px] leading-snug">
        {fields.map((f) => (
          <div key={f.label} className="contents">
            <dt className="font-semibold text-slate-500 dark:text-slate-400 truncate">{f.label}</dt>
            <dd className="text-slate-800 dark:text-slate-200 break-words">{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function fmtTotal(metric: SalesPerformanceMetricKey, amount: number | null): string {
  if (amount == null) return '—';
  if (metric === 'revenue' || metric === 'costing' || metric === 'profit') {
    return formatSalesPerformanceCurrency(amount);
  }
  if (metric === 'conversion_ratio') return formatSalesPerformanceActual('conversion_ratio', amount);
  return formatSalesPerformanceActual(metric, amount);
}

export default function CrmPipelineSalesPerformanceInspectSidebar({
  open,
  onClose,
  loading,
  error,
  data,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open) setSearchQuery('');
  }, [open, data?.weekKey, data?.metric, data?.salesperson]);

  const filteredItems = useMemo(
    () => (data ? filterInspectItems(data.items, searchQuery) : []),
    [data, searchQuery]
  );
  const filteredMeetings = useMemo(
    () => (data ? filterInspectMeetings(data.conversionMeetings, searchQuery) : []),
    [data, searchQuery]
  );
  const filteredWon = useMemo(
    () => (data ? filterInspectWon(data.conversionWonClients, searchQuery) : []),
    [data, searchQuery]
  );

  const exportableCount =
    data?.metric === 'conversion_ratio'
      ? filteredMeetings.length + filteredWon.length
      : filteredItems.length;

  const handleExport = () => {
    if (!data) return;
    downloadSalesPerformanceInspectCsv(data, {
      items: filteredItems,
      meetings: data.metric === 'conversion_ratio' ? filteredMeetings : undefined,
      wonClients: data.metric === 'conversion_ratio' ? filteredWon : undefined,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[57] bg-black/40"
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed top-0 right-0 z-[58] h-full w-full max-w-lg flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl"
            role="dialog"
            aria-labelledby="crm-sp-inspect-title"
          >
            <header className="shrink-0 flex items-start justify-between gap-3 px-4 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
              <div className="flex gap-2 min-w-0">
                <ListTree className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0">
                  <h2 id="crm-sp-inspect-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Inspect actuals
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {data
                      ? SALES_PERFORMANCE_INSPECT_METRIC_LABELS[data.metric]
                      : 'Loading breakdown…'}
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

            {data && !loading ? (
              <div className="shrink-0 px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[12rem]">
                  <Search
                    size={16}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, email, phone…"
                    className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exportableCount === 0}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
                  title="Download CSV (filtered rows)"
                >
                  <Download size={16} />
                  Export
                </button>
              </div>
            ) : null}

            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-4">
              {loading && (
                <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading records…
                </div>
              )}
              {error && !loading && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}
              {data && !loading && (
                <>
                  <section className="rounded-xl border border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs space-y-2">
                    <p>
                      <span className="font-bold text-slate-800 dark:text-slate-100">Row: </span>
                      {data.weekLabel} · {data.salesperson}
                      {data.isTotalRow ? ' (total)' : ''}
                    </p>
                    <p>
                      <span className="font-bold text-slate-800 dark:text-slate-100">Table total: </span>
                      {fmtTotal(data.metric, data.totalAmount)}
                    </p>
                    <p>
                      <span className="font-bold text-slate-800 dark:text-slate-100">Active window: </span>
                      {data.effectiveRangeDisplay}
                    </p>
                    {data.clipLabel ? (
                      <p>
                        <span className="font-bold text-slate-800 dark:text-slate-100">Quick filter: </span>
                        {data.clipLabel}
                      </p>
                    ) : null}
                    <p>
                      <span className="font-bold text-slate-800 dark:text-slate-100">Date column: </span>
                      {data.dateSourceField}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{data.dateSourceHelp}</p>
                    {data.statusFilter !== 'all' ? (
                      <p>
                        <span className="font-bold">Status filter: </span>
                        {data.statusFilter}
                      </p>
                    ) : null}
                  </section>

                  {data.metric === 'conversion_ratio' ? (
                    <>
                      <InspectList
                        title={`Unique meetings (${filteredMeetings.length}${searchQuery ? ` of ${data.conversionMeetings?.length ?? 0}` : ''})`}
                        empty={
                          searchQuery
                            ? 'No meetings match your search.'
                            : 'No meetings in this window.'
                        }
                      >
                        {filteredMeetings.map((m) => (
                          <li key={`${m.activityId}-${m.opportunityId}`} className="inspect-li">
                            <OppContactBlock row={m} subtitle={`${m.activityType} · ${m.doneAtDisplay}`} />
                          </li>
                        ))}
                      </InspectList>
                      <InspectList
                        title={`Unique clients won (${filteredWon.length}${searchQuery ? ` of ${data.conversionWonClients?.length ?? 0}` : ''})`}
                        empty={
                          searchQuery ? 'No won clients match your search.' : 'No won clients in this window.'
                        }
                      >
                        {filteredWon.map((w) => (
                          <li key={w.opportunityId} className="inspect-li">
                            <OppContactBlock row={w} subtitle={`Won ${w.wonAtDisplay}`} />
                          </li>
                        ))}
                      </InspectList>
                    </>
                  ) : (
                    <InspectList
                      title={`Records (${filteredItems.length}${searchQuery ? ` of ${data.items.length}` : ''})`}
                      empty={
                        searchQuery
                          ? 'No records match your search.'
                          : 'Nothing matched this cell for the current filters.'
                      }
                    >
                      {filteredItems.map((item) => {
                        if (item.kind === 'lead') {
                          return (
                            <li key={item.opportunityId} className="inspect-li">
                              <OppContactBlock
                                row={item}
                                subtitle={`Created ${item.createdAtDisplay} · ${item.stage} · ${item.outcome} · ID ${item.opportunityId}`}
                              />
                            </li>
                          );
                        }
                        if (item.kind === 'meeting') {
                          return (
                            <li key={`${item.activityId}-${item.opportunityId}`} className="inspect-li">
                              <OppContactBlock
                                row={item}
                                subtitle={`${item.activityType} · ${item.doneAtDisplay}`}
                              />
                            </li>
                          );
                        }
                        return (
                          <li key={item.opportunityId} className="inspect-li">
                            <OppContactBlock row={item} subtitle={`Won ${item.wonAtDisplay}`} />
                            <p className="text-slate-600 tabular-nums text-[11px] mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                              Rev {formatSalesPerformanceCurrency(item.revenue)} · Cost{' '}
                              {formatSalesPerformanceCurrency(item.costing)} · Profit{' '}
                              {formatSalesPerformanceCurrency(item.profit)}
                            </p>
                          </li>
                        );
                      })}
                    </InspectList>
                  )}
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function InspectList({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: ReactNode;
}) {
  const list = children == null ? [] : Array.isArray(children) ? children : [children];
  const hasItems = list.filter(Boolean).length > 0;
  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-2">{title}</h3>
      {!hasItems ? (
        <p className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-200 rounded-lg">
          {empty}
        </p>
      ) : (
        <ul className="space-y-2 [&_.inspect-li]:rounded-lg [&_.inspect-li]:border [&_.inspect-li]:border-slate-200 [&_.inspect-li]:dark:border-slate-700 [&_.inspect-li]:bg-white [&_.inspect-li]:dark:bg-slate-900/60 [&_.inspect-li]:p-2.5 [&_.inspect-li]:text-xs">
          {children}
        </ul>
      )}
    </section>
  );
}