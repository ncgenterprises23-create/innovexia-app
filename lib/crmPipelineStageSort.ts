/** Stages/pipelines with missing or blank sequence sort last (stable tie-break by id). */

export function sequenceSortKey(row: { sequence?: unknown }): number {
  const n = Number(row.sequence);
  return Number.isFinite(n) && n > 0 ? n : Number.MAX_SAFE_INTEGER;
}

export function compareBySequenceThenId(
  a: { sequence?: unknown; id?: unknown },
  b: { sequence?: unknown; id?: unknown }
): number {
  const d = sequenceSortKey(a) - sequenceSortKey(b);
  if (d !== 0) return d;
  return String(a.id ?? '').localeCompare(String(b.id ?? ''));
}
