'use client';

import {
  IndianRupee,
  Layers,
  Percent,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import type { SalesPerformanceKpiSummary } from '@/lib/crmPipelineSalesPerformance';
import { formatSalesPerformanceCurrency } from '@/lib/crmPipelineSalesPerformance';

const DASH_SHADOW = 'shadow-[0_2px_4px_rgba(15,23,42,0.12),0_8px_16px_-2px_rgba(15,23,42,0.22)]';

type Props = { summary: SalesPerformanceKpiSummary };

export default function CrmPipelinePerformanceKpiStrip({ summary }: Props) {
  const cards = [
    {
      label: 'Total Leads',
      value: String(Math.round(summary.leads)),
      sub: 'Actual this period',
      icon: UserPlus,
      tint: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
    },
    {
      label: 'Total Meetings',
      value: String(Math.round(summary.meetings)),
      sub: 'Unique meetings (5 For 3 rules)',
      icon: Users,
      tint: 'bg-sky-500/15 text-sky-900 dark:text-sky-200',
    },
    {
      label: 'Conversion Ratio',
      value: `${summary.conversion_ratio.toFixed(1)}%`,
      sub: 'Meetings to clients',
      icon: Percent,
      tint: 'bg-violet-500/15 text-violet-900 dark:text-violet-200',
    },
    {
      label: 'Revenue',
      value: formatSalesPerformanceCurrency(summary.revenue),
      sub: 'Won expected revenue',
      icon: IndianRupee,
      tint: 'bg-amber-500/15 text-amber-950 dark:text-amber-100',
    },
    {
      label: 'Costing',
      value: formatSalesPerformanceCurrency(summary.costing),
      sub: 'Won costing field',
      icon: Layers,
      tint: 'bg-orange-500/15 text-orange-950 dark:text-orange-100',
    },
    {
      label: 'Profit',
      value: formatSalesPerformanceCurrency(summary.profit),
      sub: 'Revenue minus costing',
      icon: TrendingUp,
      tint: 'bg-[var(--theme-primary)]/20 text-gray-900 dark:text-amber-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 shrink-0">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-xl border border-[var(--theme-primary)]/20 bg-white dark:bg-slate-900/80 px-3 py-2.5 ${DASH_SHADOW}`}
        >
          <div className="flex items-start gap-2">
            <span className={`shrink-0 p-1.5 rounded-lg ${c.tint}`}>
              <c.icon size={16} strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{c.label}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums truncate">
                {c.value}
              </p>
              <p className="text-[10px] text-slate-500 leading-snug mt-0.5">{c.sub}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}