import { SchemaType, type FunctionDeclaration } from '@google/generative-ai';
import { listFmsModuleIds } from '../fms/modules';

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'list_delegations',
    description:
      'List delegation tasks for the current user. Use for pending delegations, assigned work, or delegation status.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: {
          type: SchemaType.STRING,
          description: 'Filter by status, e.g. pending, completed, in progress',
        },
        limit: { type: SchemaType.NUMBER, description: 'Max rows to return (default 25)' },
      },
    },
  },
  {
    name: 'list_todos',
    description: 'List todo items from the ERP todo module.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: { type: SchemaType.NUMBER, description: 'Max rows to return (default 25)' },
      },
    },
  },
  {
    name: 'list_checklists',
    description: 'List checklist definitions from the checklist module.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: { type: SchemaType.NUMBER, description: 'Max rows to return (default 25)' },
      },
    },
  },
  {
    name: 'list_helpdesk_tickets',
    description: 'List helpdesk tickets related to the current user.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: { type: SchemaType.STRING, description: 'Filter by ticket status' },
        limit: { type: SchemaType.NUMBER, description: 'Max rows to return (default 25)' },
      },
    },
  },
  {
    name: 'query_fms_pending',
    description:
      'Query FMS workflow items that are active (not completed/cancelled), optionally at a specific step, overdue, or matching search text.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        module: {
          type: SchemaType.STRING,
          description: `FMS module id. One of: ${listFmsModuleIds().join(', ')}`,
        },
        step: {
          type: SchemaType.NUMBER,
          description: 'Filter to items whose current step equals this number',
        },
        overdueOnly: {
          type: SchemaType.BOOLEAN,
          description: 'If true, only items past planned date at current step',
        },
        search: {
          type: SchemaType.STRING,
          description: 'Free-text search across row fields (party name, PI number, etc.)',
        },
        limit: { type: SchemaType.NUMBER, description: 'Max rows to return (default 20)' },
      },
      required: ['module'],
    },
  },
];
