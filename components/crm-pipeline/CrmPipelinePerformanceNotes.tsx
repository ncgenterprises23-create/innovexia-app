'use client';

import { Info } from 'lucide-react';

const DASH_SHADOW = 'shadow-[0_2px_4px_rgba(15,23,42,0.12),0_8px_16px_-2px_rgba(15,23,42,0.22)]';

export default function CrmPipelinePerformanceNotes() {
  return (
    <div
      className={`rounded-xl border border-[var(--theme-primary)]/20 bg-white dark:bg-slate-900/80 p-3 h-full min-h-[17.5rem] ${DASH_SHADOW} text-xs text-slate-600 dark:text-slate-300 space-y-2`}
    >
      <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
        <Info size={16} className="text-[var(--theme-primary)] shrink-0" />
        Notes
      </div>
      <ul className="list-disc pl-4 space-y-1 leading-relaxed">
        <li>Profit = Revenue − Costing (from won leads in each week).</li>
        <li>Meetings match 5 For 3: completed todo / email / call / meeting activities.</li>
        <li>Conversion = clients won ÷ unique meetings in that week.</li>
        <li>
          Double-click <strong>Planned by us</strong> in the table, then use <strong>Save planned targets</strong>.
          Values are stored on the <em>Sales Performance Planned</em> sheet (pipeline + month + week + salesperson).
        </li>
      </ul>
    </div>
  );
}