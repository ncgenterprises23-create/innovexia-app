import { parseSheetDate } from '@/lib/dateUtils';

export type FrequencyKind = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'once';

const MAX_OCCURRENCES = 400;

export function dateKeyIST(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function todayKeyIST(): string {
  return dateKeyIST(new Date());
}

export function toDateKey(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  const iso = parseSheetDate(value);
  if (iso) return dateKeyIST(new Date(iso));
  const raw = String(value).trim();
  const isoDay = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDay) return `${isoDay[1]}-${isoDay[2]}-${isoDay[3]}`;
  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return null;
}

export function occurrenceKey(checklistId: number | string, dateKey: string) {
  return `${checklistId}|${dateKey}`;
}

export function normalizeFrequency(raw: any): FrequencyKind {
  const f = String(raw || '').trim().toLowerCase();
  if (['d', 'daily', 'day', 'days'].includes(f)) return 'daily';
  if (['w', 'weekly', 'week', 'weeks'].includes(f)) return 'weekly';
  if (['m', 'monthly', 'month', 'months'].includes(f)) return 'monthly';
  if (['q', 'quarterly', 'quarter', 'quarters'].includes(f)) return 'quarterly';
  if (['y', 'yearly', 'year', 'years', 'annually', 'annual'].includes(f)) return 'yearly';
  if (['once', 'one time', 'onetime', 'single'].includes(f)) return 'once';
  return 'once';
}

type Ymd = { y: number; m: number; d: number };

function parseYmd(key: string): Ymd {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

function ymdKey(p: Ymd): string {
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

function compareYmd(a: Ymd, b: Ymd) {
  return a.y - b.y || a.m - b.m || a.d - b.d;
}

function addDays(p: Ymd, days: number): Ymd {
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function addMonths(p: Ymd, months: number): Ymd {
  const dt = new Date(Date.UTC(p.y, p.m - 1 + months, 1));
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: Math.min(p.d, last) };
}

function weekdayOf(p: Ymd): number {
  return new Date(Date.UTC(p.y, p.m - 1, p.d, 6, 30)).getUTCDay();
}

function shiftSundayToSaturday(p: Ymd): Ymd {
  return weekdayOf(p) === 0 ? addDays(p, -1) : p;
}

function ymdToIso(p: Ymd): string {
  return new Date(`${ymdKey(p)}T09:00:00+05:30`).toISOString();
}

const HARDCODED_COMPLETED_UNTIL = '2026-09-24';

export function calculateOccurrenceStatus(dateKey: string, historyStatus?: string | null) {
  if (dateKey && dateKey <= HARDCODED_COMPLETED_UNTIL) {
    return 'completed';
  }
  const done = String(historyStatus || '').trim().toLowerCase();
  if (done && done !== 'pending' && done !== 'planned' && done !== 'overdue') {
    return done;
  }
  const today = todayKeyIST();
  if (dateKey < today) return 'overdue';
  if (dateKey === today) return 'pending';
  return 'planned';
}

export function expandOccurrenceDates(startValue: any, frequencyRaw: any): string[] {
  const startKey = toDateKey(startValue);
  if (!startKey) return [];

  const freq = normalizeFrequency(frequencyRaw);
  const start = parseYmd(startKey);
  const today = parseYmd(todayKeyIST());
  const end = today;
  const dates: string[] = [];

  if (freq === 'once') {
    return compareYmd(start, today) <= 0 ? [startKey] : [];
  }

  let cursor = start;
  if (freq === 'weekly') {
    const targetWeekday = weekdayOf(start);
    while (weekdayOf(cursor) !== targetWeekday) {
      cursor = addDays(cursor, 1);
    }
  }

  let guard = 0;
  while (compareYmd(cursor, end) <= 0 && guard < MAX_OCCURRENCES) {
    guard += 1;
    if (freq === 'daily' && weekdayOf(cursor) === 0) {
      cursor = addDays(cursor, 1);
      continue;
    }

    const shown = (freq === 'monthly' || freq === 'quarterly' || freq === 'yearly')
      ? shiftSundayToSaturday(cursor)
      : cursor;

    if (compareYmd(shown, end) <= 0 && (compareYmd(shown, start) >= 0 || weekdayOf(cursor) === 0)) {
      const key = ymdKey(shown);
      if (dates[dates.length - 1] !== key) dates.push(key);
    }

    if (freq === 'daily') cursor = addDays(cursor, 1);
    else if (freq === 'weekly') cursor = addDays(cursor, 7);
    else if (freq === 'monthly') cursor = addMonths(cursor, 1);
    else if (freq === 'quarterly') cursor = addMonths(cursor, 3);
    else if (freq === 'yearly') cursor = addMonths(cursor, 12);
    else break;
  }

  if (dates.length === 0 && compareYmd(start, today) <= 0) dates.push(startKey);
  return dates;
}

export function expandMasterChecklist(master: any, historyByOccurrence: Map<string, string>) {
  const startValue = toDateKey(master.due_date)
    ? master.due_date
    : (toDateKey(master.group_id) ? master.group_id : master.created_at);
  const dates = expandOccurrenceDates(startValue, master.frequency);
  if (dates.length === 0) return [];
  return dates.map((dateKey) => {
    const groupKey = master.group_id || master.id;
    const historyStatus =
      historyByOccurrence.get(occurrenceKey(groupKey, dateKey)) ||
      historyByOccurrence.get(occurrenceKey(master.id, dateKey));
    const ymd = parseYmd(dateKey);
    return {
      ...master,
      master_due_date: master.due_date,
      occurrence_id: `${master.id}_${dateKey}`,
      occurrence_date: dateKey,
      due_date: ymdToIso(ymd),
      status: calculateOccurrenceStatus(dateKey, historyStatus),
    };
  });
}
