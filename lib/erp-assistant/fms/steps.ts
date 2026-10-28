export type StepStrategy = 'sequential' | 'firstGap' | 'sequentialWithSkip';

export function isRecordCancelled(item: Record<string, unknown>): boolean {
  const cancelled = item.Cancelled ?? item.cancelled;
  return String(cancelled ?? '').trim().toLowerCase() === 'yes';
}

function isStepPassedWithSkip(item: Record<string, unknown>, step: number): boolean {
  if (item[`Actual_${step}`]) return true;
  return String(item[`Status_${step}`] ?? '').trim().toLowerCase() === 'skipped';
}

export function getCurrentStep(
  item: Record<string, unknown>,
  maxStep: number,
  strategy: StepStrategy = 'sequential'
): number {
  if (strategy === 'firstGap') {
    for (let i = 1; i <= maxStep; i++) {
      if (!item[`Actual_${i}`]) return i;
    }
    return maxStep + 1;
  }

  if (strategy === 'sequentialWithSkip') {
    let step = 1;
    for (let s = 1; s <= maxStep; s++) {
      if (isStepPassedWithSkip(item, s)) step = s + 1;
      else break;
    }
    return step;
  }

  let step = 1;
  for (let s = 1; s <= maxStep; s++) {
    if (item[`Actual_${s}`]) step = s + 1;
    else break;
  }
  return step;
}

export function isOverdueAtStep(item: Record<string, unknown>, step: number): boolean {
  const planned = item[`Planned_${step}`];
  if (!planned) return false;
  const plannedDate = new Date(String(planned));
  if (Number.isNaN(plannedDate.getTime())) return false;
  if (item[`Actual_${step}`]) return false;
  return plannedDate.getTime() < Date.now();
}
