export function getNextPlannedTime(
  currentActualTime: Date,
  value: number = 1,
  unit: 'hours' | 'days' = 'hours'
): Date {
  const nextTime = new Date(currentActualTime);
  if (unit === 'hours') {
    nextTime.setTime(nextTime.getTime() + value * 60 * 60 * 1000);
  } else {
    nextTime.setDate(nextTime.getDate() + value);
  }
  return nextTime;
}

export const O2D_CUSTOMER_TYPES = ['DEALER', 'PRINTER', 'AGENCY', 'CORPORATE'] as const;