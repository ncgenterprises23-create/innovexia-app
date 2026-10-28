import type { SessionUser } from '../auth';
import { queryFmsPending } from '../queries/pendingByStep';
import {
  queryChecklists,
  queryDelegations,
  queryHelpdesk,
  queryTodos,
} from '../queries/tasks';
import type { FmsModuleId } from '../fms/modules';
import { FMS_MODULES } from '../fms/modules';

export interface ToolSource {
  module: string;
  path: string;
  count?: number;
}

export async function runTool(
  name: string,
  args: Record<string, unknown>,
  user: SessionUser
): Promise<{ result: unknown; sources?: ToolSource[] }> {
  switch (name) {
    case 'list_delegations': {
      const result = await queryDelegations(user, {
        status: args.status as string | undefined,
        limit: args.limit as number | undefined,
      });
      if ('error' in result) return { result };
      return {
        result,
        sources: [{ module: 'Delegations', path: result.route!, count: result.total }],
      };
    }
    case 'list_todos': {
      const result = await queryTodos(user, { limit: args.limit as number | undefined });
      if ('error' in result) return { result };
      return {
        result,
        sources: [{ module: 'Todo', path: result.route!, count: result.total }],
      };
    }
    case 'list_checklists': {
      const result = await queryChecklists(user, { limit: args.limit as number | undefined });
      if ('error' in result) return { result };
      return {
        result,
        sources: [{ module: 'Checklist', path: result.route!, count: result.total }],
      };
    }
    case 'list_helpdesk_tickets': {
      const result = await queryHelpdesk(user, {
        status: args.status as string | undefined,
        limit: args.limit as number | undefined,
      });
      if ('error' in result) return { result };
      return {
        result,
        sources: [{ module: 'Helpdesk', path: result.route!, count: result.total }],
      };
    }
    case 'query_fms_pending': {
      const moduleId = String(args.module || '') as FmsModuleId;
      if (!FMS_MODULES[moduleId]) {
        return { result: { error: `Invalid module. Use one of: ${Object.keys(FMS_MODULES).join(', ')}` } };
      }
      const result = await queryFmsPending(user, {
        module: moduleId,
        step: args.step != null ? Number(args.step) : undefined,
        overdueOnly: Boolean(args.overdueOnly),
        search: args.search as string | undefined,
        limit: args.limit != null ? Number(args.limit) : undefined,
      });
      if ('error' in result) return { result };
      return {
        result,
        sources: [
          {
            module: result.module!,
            path: result.route!,
            count: result.total,
          },
        ],
      };
    }
    default:
      return { result: { error: `Unknown tool: ${name}` } };
  }
}
