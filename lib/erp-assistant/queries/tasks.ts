import {
  getDelegations,
  getTodos,
  getChecklists,
  getHelpdeskTickets,
} from '@/lib/sheets';
import { roleAllowed, type SessionUser } from '../auth';
import { cachedAssistantFetch } from '../toolCache';

const ADMIN_MANAGER = ['Admin', 'Manager'];
const ALL_STAFF = ['Admin', 'Manager', 'Employee'];

export async function queryDelegations(
  user: SessionUser,
  opts: { status?: string; limit?: number } = {}
) {
  if (!roleAllowed(user.role_name || '', ADMIN_MANAGER)) {
    return { error: 'You do not have access to delegations.' };
  }
  const limit = Math.min(opts.limit ?? 25, 50);
  const rows = await cachedAssistantFetch(
    'delegations',
    { userId: user.id, role: user.role_name, username: user.username },
    () => getDelegations(user.id, user.role_name, user.username)
  );
  let filtered = rows;
  if (opts.status) {
    const s = opts.status.toLowerCase();
    filtered = filtered.filter((d) => String(d.status || '').toLowerCase() === s);
  }
  const total = filtered.length;
  const items = filtered.slice(0, limit).map((d) => ({
    id: d.id,
    title: d.title || d.task_title,
    status: d.status,
    doer: d.doer_name,
    assignedTo: d.assigned_to,
    dueDate: d.due_date || d.planned_date,
    createdAt: d.created_at,
  }));
  return { total, returned: items.length, items, route: '/delegation' };
}

export async function queryTodos(user: SessionUser, opts: { limit?: number } = {}) {
  if (!roleAllowed(user.role_name || '', ALL_STAFF)) {
    return { error: 'You do not have access to todos.' };
  }
  const limit = Math.min(opts.limit ?? 25, 50);
  const rows = await cachedAssistantFetch('todos', {}, () => getTodos());
  const total = rows.length;
  const items = rows.slice(0, limit).map((t) => ({
    id: t.id,
    title: t.title || t.task,
    status: t.status,
    isImportant: t.is_important,
    createdAt: t.created_at,
  }));
  return { total, returned: items.length, items, route: '/todo' };
}

export async function queryChecklists(user: SessionUser, opts: { limit?: number } = {}) {
  if (!roleAllowed(user.role_name || '', ADMIN_MANAGER)) {
    return { error: 'You do not have access to checklists.' };
  }
  const limit = Math.min(opts.limit ?? 25, 50);
  const rows = await cachedAssistantFetch('checklists', {}, () => getChecklists());
  const total = rows.length;
  const items = rows.slice(0, limit).map((c: Record<string, unknown>) => ({
    id: c.id,
    title: c.title || c.name,
    frequency: c.frequency,
    department: c.department,
  }));
  return { total, returned: items.length, items, route: '/checklist' };
}

export async function queryHelpdesk(
  user: SessionUser,
  opts: { status?: string; limit?: number } = {}
) {
  if (!roleAllowed(user.role_name || '', ALL_STAFF)) {
    return { error: 'You do not have access to helpdesk.' };
  }
  const limit = Math.min(opts.limit ?? 25, 50);
  const filters: Record<string, unknown> = { userId: user.id };
  if (opts.status) filters.status = opts.status;
  const rows = await cachedAssistantFetch(
    'helpdesk',
    { userId: user.id, status: opts.status || '' },
    () => getHelpdeskTickets(filters)
  );
  const total = rows.length;
  const items = rows.slice(0, limit).map((t) => ({
    id: t.id,
    subject: t.subject || t.title,
    status: t.status,
    priority: t.priority,
    createdAt: t.created_at,
  }));
  return { total, returned: items.length, items, route: '/helpdesk' };
}
