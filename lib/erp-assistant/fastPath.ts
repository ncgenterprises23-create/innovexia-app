import type { SessionUser } from './auth';
import { queryFmsPending } from './queries/pendingByStep';
import type { FmsModuleId } from './fms/modules';
import {
  queryChecklists,
  queryDelegations,
  queryHelpdesk,
  queryTodos,
} from './queries/tasks';
import type { ToolSource } from './tools/runTool';

function formatDelegationReply(result: Awaited<ReturnType<typeof queryDelegations>>) {
  if ('error' in result) return result.error as string;
  const lines = result.items.map(
    (d) =>
      `• #${d.id} — ${d.title || 'Untitled'} (${d.status || 'unknown'})${d.doer ? ` — doer: ${d.doer}` : ''}`
  );
  const header = `You have **${result.total}** delegation(s) matching this query (showing ${result.returned}).`;
  return lines.length ? `${header}\n\n${lines.join('\n')}` : `${header}\n\nNo rows to display.`;
}

function formatHelpdeskReply(result: Awaited<ReturnType<typeof queryHelpdesk>>) {
  if ('error' in result) return result.error as string;
  const lines = result.items.map(
    (t) => `• #${t.id} — ${t.subject || 'Ticket'} (${t.status || 'open'})`
  );
  const header = `Found **${result.total}** helpdesk ticket(s) (showing ${result.returned}).`;
  return lines.length ? `${header}\n\n${lines.join('\n')}` : `${header}\n\nNo tickets found.`;
}

function formatTodosReply(result: Awaited<ReturnType<typeof queryTodos>>) {
  if ('error' in result) return result.error as string;
  const lines = result.items.map((t) => `• #${t.id} — ${t.title || 'Todo'}`);
  const header = `Found **${result.total}** todo item(s) (showing ${result.returned}).`;
  return lines.length ? `${header}\n\n${lines.join('\n')}` : `${header}\n\nNo todos found.`;
}

function formatFmsReply(result: Awaited<ReturnType<typeof queryFmsPending>>) {
  if ('error' in result) return result.error as string;
  const lines = result.items.map((i) => {
    const id = i.id != null && String(i.id).trim() !== '' ? String(i.id) : '—';
    return `• #${id} — step ${i.currentStep} (${i.currentStepName})${i.overdue ? ' — overdue' : ''}`;
  });
  const stepNote = result.stepFilter != null ? ` at step **${result.stepFilter}**` : '';
  const header = `**${result.module}**: **${result.total}** active item(s)${stepNote} (showing ${result.returned}).`;
  return lines.length ? `${header}\n\n${lines.join('\n')}` : `${header}\n\nNo matching records.`;
}

/**
 * Instant answers for common ERP questions — no Gemini call (avoids 1–3 min model latency).
 */
export async function tryFastPath(
  user: SessionUser,
  message: string
): Promise<{ reply: string; sources: ToolSource[] } | null> {
  const q = message.trim().toLowerCase();
  if (!q) return null;

  if (
    /pending\s+delegation|my\s+delegation|delegation.*pending|show\s+delegation/.test(q) ||
    q === 'my pending delegations'
  ) {
    const result = await queryDelegations(user, {
      status: q.includes('pending') ? 'pending' : undefined,
      limit: 20,
    });
    if ('error' in result) return { reply: String(result.error), sources: [] };
    return {
      reply: formatDelegationReply(result),
      sources: [{ module: 'Delegations', path: result.route!, count: result.total }],
    };
  }

  if (/helpdesk|support\s+ticket|open\s+ticket/.test(q)) {
    const result = await queryHelpdesk(user, { limit: 20 });
    if ('error' in result) return { reply: String(result.error), sources: [] };
    return {
      reply: formatHelpdeskReply(result),
      sources: [{ module: 'Helpdesk', path: result.route!, count: result.total }],
    };
  }

  if (/\btodo\b|to-do|my\s+tasks\b/.test(q) && !/fms|export|job/.test(q)) {
    const result = await queryTodos(user, { limit: 20 });
    if ('error' in result) return { reply: String(result.error), sources: [] };
    return {
      reply: formatTodosReply(result),
      sources: [{ module: 'Todo', path: result.route!, count: result.total }],
    };
  }

  if (/checklist/.test(q)) {
    const result = await queryChecklists(user, { limit: 20 });
    if ('error' in result) return { reply: String(result.error), sources: [] };
    const header = `Found **${result.total}** checklist(s) (showing ${result.returned}).`;
    const lines = result.items.map((c) => `• #${c.id} — ${c.title || 'Checklist'}`);
    return {
      reply: lines.length ? `${header}\n\n${lines.join('\n')}` : header,
      sources: [{ module: 'Checklist', path: result.route!, count: result.total }],
    };
  }

  const fmsPatterns: { re: RegExp; module: FmsModuleId }[] = [
    { re: /export\s+fms/, module: 'export_fms' },
    { re: /job\s+work/, module: 'job_work' },
    { re: /\bcrm\b/, module: 'crm' },
    { re: /product\s+fms/, module: 'product_fms' },
  ];

  for (const { re, module } of fmsPatterns) {
    if (!re.test(q)) continue;
    const stepMatch = q.match(/step\s*(\d+)/);
    const overdueOnly = /overdue/.test(q);
    const result = await queryFmsPending(user, {
      module,
      step: stepMatch ? Number(stepMatch[1]) : undefined,
      overdueOnly,
      limit: 20,
    });
    if ('error' in result) return { reply: String(result.error), sources: [] };
    return {
      reply: formatFmsReply(result),
      sources: [{ module: result.module!, path: result.route!, count: result.total }],
    };
  }

  return null;
}
