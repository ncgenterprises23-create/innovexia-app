import { yearMonthFromDate } from '@/lib/crmPipelineSalesPerformancePlanned';

const IST = 'Asia/Kolkata';

export type SalesPerformanceDatePreset = 'month' | 'today' | 'yesterday' | 'last3' | 'lastWeek' | 'custom';

export type SalesPerformanceClipRange = {
  startMs: number;
  endMs: number;
  label: string;
};

export type SalesPerformanceDateFilterState = {
  preset: SalesPerformanceDatePreset;
  customFrom: string;
  customTo: string;
};

function ymdInIst(d = new Date()): { y: number; m: number; day: number } {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const [y, m, day] = s.split('-').map(Number);
  return { y, m, day };
}

/** India Standard Time wall clock → UTC ms (no DST). */
function istToUtcMs(y: number, m: number, day: number, h: number, min: number, s: number, ms: number): number {
  return Date.UTC(y, m - 1, day, h, min, s, ms) - 5.5 * 3600 * 1000;
}

function dayBoundsIst(y: number, m: number, day: number): { startMs: number; endMs: number } {
  return {
    startMs: istToUtcMs(y, m, day, 0, 0, 0, 0),
    endMs: istToUtcMs(y, m, day, 23, 59, 59, 999),
  };
}

function addDaysYmd(y: number, m: number, day: number, delta: number): { y: number; m: number; day: number } {
  const utc = istToUtcMs(y, m, day, 12, 0, 0, 0) + delta * 86400 * 1000;
  return ymdInIst(new Date(utc));
}

function weekdayIst(y: number, m: number, day: number): number {
  const utc = istToUtcMs(y, m, day, 12, 0, 0, 0);
  const w = new Intl.DateTimeFormat('en-US', { timeZone: IST, weekday: 'short' }).format(new Date(utc));
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[w] ?? 0;
}

function previousMonSunIst(anchor = new Date()): { startMs: number; endMs: number; label: string } {
  const { y, m, day } = ymdInIst(anchor);
  const wd = weekdayIst(y, m, day);
  const daysSinceMon = (wd + 6) % 7;
  const thisMon = addDaysYmd(y, m, day, -daysSinceMon);
  const lastMon = addDaysYmd(thisMon.y, thisMon.m, thisMon.day, -7);
  const lastSun = addDaysYmd(lastMon.y, lastMon.m, lastMon.day, 6);
  const start = dayBoundsIst(lastMon.y, lastMon.m, lastMon.day).startMs;
  const end = dayBoundsIst(lastSun.y, lastSun.m, lastSun.day).endMs;
  return { startMs: start, endMs: end, label: 'Last week (Mon–Sun)' };
}

function formatShortIst(y: number, m: number, day: number): string {
  const utc = istToUtcMs(y, m, day, 12, 0, 0, 0);
  return new Date(utc).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: IST,
  });
}

export function resolveSalesPerformanceClip(
  preset: SalesPerformanceDatePreset,
  customFrom: string,
  customTo: string,
  anchor = new Date()
): SalesPerformanceClipRange | null {
  if (preset === 'month') return null;

  const { y, m, day } = ymdInIst(anchor);

  if (preset === 'today') {
    const b = dayBoundsIst(y, m, day);
    return { ...b, label: 'Today' };
  }

  if (preset === 'yesterday') {
    const prev = addDaysYmd(y, m, day, -1);
    const b = dayBoundsIst(prev.y, prev.m, prev.day);
    return { ...b, label: 'Yesterday' };
  }

  if (preset === 'last3') {
    const from = addDaysYmd(y, m, day, -2);
    const start = dayBoundsIst(from.y, from.m, from.day).startMs;
    const end = dayBoundsIst(y, m, day).endMs;
    return { startMs: start, endMs: end, label: 'Last 3 days' };
  }

  if (preset === 'lastWeek') {
    const lw = previousMonSunIst(anchor);
    return { startMs: lw.startMs, endMs: lw.endMs, label: lw.label };
  }

  if (preset === 'custom' && customFrom && customTo) {
    const [fy, fm, fd] = customFrom.split('-').map(Number);
    const [ty, tm, td] = customTo.split('-').map(Number);
    if (!fy || !fm || !fd || !ty || !tm || !td) return null;
    const start = dayBoundsIst(fy, fm, fd).startMs;
    const end = dayBoundsIst(ty, tm, td).endMs;
    if (end < start) return null;
    return {
      startMs: start,
      endMs: end,
      label: `${formatShortIst(fy, fm, fd)} – ${formatShortIst(ty, tm, td)}`,
    };
  }

  return null;
}

export function defaultCustomRange(anchor = new Date()): { from: string; to: string } {
  const { y, m, day } = ymdInIst(anchor);
  const pad = (n: number) => String(n).padStart(2, '0');
  const to = `${y}-${pad(m)}-${pad(day)}`;
  const fromD = addDaysYmd(y, m, day, -6);
  const from = `${fromD.y}-${pad(fromD.m)}-${pad(fromD.day)}`;
  return { from, to };
}

export function monthKeyForClip(clip: SalesPerformanceClipRange | null, fallbackMonth: string): string {
  if (!clip) return fallbackMonth;
  return yearMonthFromDate(new Date(clip.endMs));
}

export function displayTitleWithClip(
  monthLabel: string,
  clip: SalesPerformanceClipRange | null | { label: string }
): string {
  if (!clip || !clip.label) return monthLabel;
  return `${clip.label} · ${monthLabel}`;
}

export function todayYmdIst(): string {
  const { y, m, day } = ymdInIst();
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}