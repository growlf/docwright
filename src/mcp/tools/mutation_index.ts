import { McpTool } from '../types';
import { updateStep, updatePlanStatus, appendHistory, setPlanField, writePlan } from './mutation';

export const mutationTools: McpTool[] = [
  {
    name: 'update_step',
    description: 'Update a single step row in a plan\'s Implementation Steps table.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_name: { type: 'string' },
        step_match: { type: 'string', description: 'Substring uniquely identifying the row' },
        new_status: { type: 'string', description: 'done or pending' }
      },
      required: ['plan_name', 'step_match', 'new_status']
    },
    handler: async (args) => {
      const res = await updateStep(String(args.plan_name), String(args.step_match), String(args.new_status));
      return { content: [{ type: 'text', text: res }] };
    }
  },
  {
    name: 'update_plan_status',
    description: 'Update a plan\'s status field with full lifecycle validation.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_name: { type: 'string' },
        new_status: { type: 'string' }
      },
      required: ['plan_name', 'new_status']
    },
    handler: async (args) => {
      const res = await updatePlanStatus(String(args.plan_name), String(args.new_status));
      return { content: [{ type: 'text', text: res }] };
    }
  },
  {
    name: 'append_history',
    description: 'Append a row to the plan\'s Document History table.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_name: { type: 'string' },
        change: { type: 'string' }
      },
      required: ['plan_name', 'change']
    },
    handler: async (args) => {
      const res = await appendHistory(String(args.plan_name), String(args.change));
      return { content: [{ type: 'text', text: res }] };
    }
  },
  {
    name: 'set_plan_field',
    description: 'Set a single frontmatter field on a plan file.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_name: { type: 'string' },
        field: { type: 'string' },
        value: { type: 'string' }
      },
      required: ['plan_name', 'field', 'value']
    },
    handler: async (args) => {
      const res = await setPlanField(String(args.plan_name), String(args.field), args.value);
      return { content: [{ type: 'text', text: res }] };
    }
  },
  {
    name: 'write_plan',
    description: 'Full content replacement for a plan file.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_name: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['plan_name', 'content']
    },
    handler: async (args) => {
      const res = await writePlan(String(args.plan_name), String(args.content));
      return { content: [{ type: 'text', text: res }] };
    }
  }
];
