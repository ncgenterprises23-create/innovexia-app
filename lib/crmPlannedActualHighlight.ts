/**
 * Background for Actual cells when a Planned target exists: green if met/exceeded, red if below.
 */
export function actualVsPlannedHighlightClass(
  planned: number | null | undefined,
  actual: number | null | undefined
): string {
  if (planned == null || !Number.isFinite(planned)) return '';
  const act = actual != null && Number.isFinite(actual) ? actual : 0;
  if (act >= planned) {
    return 'bg-emerald-300/90 text-emerald-950 font-bold ring-1 ring-emerald-500/70 dark:bg-emerald-500/35 dark:text-emerald-50';
  }
  return 'bg-red-300/90 text-red-950 font-bold ring-1 ring-red-500/70 dark:bg-red-500/35 dark:text-red-50';
}