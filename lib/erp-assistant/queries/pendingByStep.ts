import { roleAllowed, type SessionUser } from '../auth';
import { FMS_MODULES, type FmsModuleId } from '../fms/modules';
import { getCurrentStep, isOverdueAtStep, isRecordCancelled } from '../fms/steps';
import { cachedAssistantFetch } from '../toolCache';

export interface FmsPendingQuery {
  module: FmsModuleId;
  step?: number;
  overdueOnly?: boolean;
  search?: string;
  limit?: number;
}

export type FmsPendingItem = {
  id: unknown;
  currentStep: number;
  currentStepName: string;
  plannedDate: unknown;
  overdue: boolean;
} & Record<string, unknown>;

export async function queryFmsPending(user: SessionUser, query: FmsPendingQuery) {
  const mod = FMS_MODULES[query.module];
  if (!mod) {
    return { error: `Unknown module: ${query.module}` };
  }
  if (!roleAllowed(user.role_name || '', mod.allowedRoles)) {
    return { error: 'You do not have access to this module.' };
  }

  const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
  const [config, data] = await Promise.all([
    cachedAssistantFetch(`fms-config:${query.module}`, {}, () => mod.getStepConfig()),
    cachedAssistantFetch(`fms-data:${query.module}`, {}, () => mod.getData()),
  ]);
  const maxStepFromConfig = config.reduce((m, c) => Math.max(m, c.step || 0), 0);
  const maxStep = maxStepFromConfig > 0 ? maxStepFromConfig : mod.maxStep;
  const searchLower = query.search?.trim().toLowerCase();

  let matched = data.filter((item) => {
    if (isRecordCancelled(item)) return false;
    const current = getCurrentStep(item, maxStep, mod.stepStrategy);
    if (current > maxStep) return false;
    if (query.step != null && current !== query.step) return false;
    if (query.overdueOnly && !isOverdueAtStep(item, current)) return false;
    if (searchLower) {
      const blob = JSON.stringify(item).toLowerCase();
      if (!blob.includes(searchLower)) return false;
    }
    return true;
  });

  const total = matched.length;
  matched = matched.slice(0, limit);

  const stepName = (step: number) =>
    config.find((c) => c.step === step)?.stepName || `Step ${step}`;

  const items: FmsPendingItem[] = matched.map((item) => {
    const currentStep = getCurrentStep(item, maxStep, mod.stepStrategy);
    const summary = mod.summarizeItem(item);
    return {
      ...summary,
      id: summary.id ?? item.id,
      currentStep,
      currentStepName: stepName(currentStep),
      plannedDate: item[`Planned_${currentStep}`] ?? null,
      overdue: isOverdueAtStep(item, currentStep),
    };
  });

  return {
    module: mod.label,
    route: mod.route,
    total,
    returned: items.length,
    stepFilter: query.step ?? null,
    items,
  };
}
