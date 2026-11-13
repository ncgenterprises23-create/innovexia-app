import { parseSheetDate } from '@/lib/dateUtils';

export type FollowUpBucket = 'future' | 'today' | 'past' | 'none';
export type FollowUpFilter = 'all' | FollowUpBucket;

export function followUpBucket(dueDate?: string | null): FollowUpBucket {
  const raw = dueDate != null ? String(dueDate).trim() : '';
  if (!raw) return 'none';
  const iso = parseSheetDate(raw);
  if (!iso) return 'none';
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return 'none';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const t = today.getTime();
  const d = dueDay.getTime();
  if (d > t) return 'future';
  if (d === t) return 'today';
  return 'past';
}

/** Neutral card body; status color lives in the top-right corner bubble. */
export function leadCardFollowUpSurface(_bucket: FollowUpBucket): string {
  return [
    'bg-white dark:bg-slate-800/95',
    'border-slate-200/90 dark:border-slate-600/50',
  ].join(' ');
}

/** Large translucent quarter-circle “bubble” clipped by the card corner. */
export function leadCardCornerBubbleClass(bucket: FollowUpBucket): string {
  switch (bucket) {
    case 'future':
      return 'bg-emerald-400/45 dark:bg-emerald-500/35';
    case 'today':
      return 'bg-amber-300/55 dark:bg-amber-400/40';
    case 'past':
      return 'bg-rose-400/45 dark:bg-rose-500/35';
    default:
      return 'bg-slate-300/50 dark:bg-slate-500/35';
  }
}

/** ⋮ menu sitting on the colored corner bubble. */
export function leadCardCornerMenuClass(bucket: FollowUpBucket): string {
  const base =
    'border border-transparent hover:bg-white/25 dark:hover:bg-black/15 transition-colors';
  switch (bucket) {
    case 'future':
      return `${base} text-emerald-950/80 dark:text-emerald-50`;
    case 'today':
      return `${base} text-amber-950/85 dark:text-amber-50`;
    case 'past':
      return `${base} text-rose-950/80 dark:text-rose-50`;
    default:
      return `${base} text-slate-700 dark:text-slate-200`;
  }
}

/** @deprecated Use corner bubble + leadCardFollowUpSurface */
export function leadCardFollowUpGradient(bucket: FollowUpBucket): string {
  return leadCardFollowUpSurface(bucket);
}

export const FOLLOW_UP_FILTER_CHIPS: {
  id: Exclude<FollowUpFilter, 'all'>;
  ring: string;
  activeRing: string;
  title: string;
}[] = [
  { id: 'none', ring: 'bg-slate-400', activeRing: 'ring-slate-600', title: 'No follow-up date' },
  { id: 'future', ring: 'bg-emerald-500', activeRing: 'ring-emerald-600', title: 'Follow-up in the future' },
  { id: 'today', ring: 'bg-amber-400', activeRing: 'ring-amber-600', title: 'Follow-up today' },
  { id: 'past', ring: 'bg-rose-500', activeRing: 'ring-rose-600', title: 'Follow-up overdue' },
];
