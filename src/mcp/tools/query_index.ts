import { McpTool } from '../types';
import { getSessionContext, listActivePlans, getPlan, getStatus } from './query';

export const queryTools: McpTool[] = [
  {
    name: 'get_session_context',
    description: 'Read SESSION-LOG.md (last 100 lines) and summary of active plans.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      const res = await getSessionContext();
      return { content: [{ type: 'text', text: res }] };
    }
  },
  {
    name: 'list_active_plans',
    description: 'List all plans currently with status: approved or in-progress.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      const res = await listActivePlans();
      return { content: [{ type: 'text', text: res }] };
    }
  },
  {
    name: 'get_plan',
    description: 'Read a specific plan file (from plans/ or plans/completed/).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the plan file' }
      },
      required: ['name']
    },
    handler: async (args) => {
      const res = await getPlan(String(args.name));
      return { content: [{ type: 'text', text: res }] };
    }
  },
  {
    name: 'get_status',
    description: 'Full lifecycle status of proposals, plans, and completed items. 60s cache.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      const res = await getStatus();
      return { content: [{ type: 'text', text: res }] };
    }
  }
];
