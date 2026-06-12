import { McpTool } from '../types';
import { transitionToApproved, transitionToCompleted, transitionToCanceled, approveSubPlan } from './transitions';

export const transitionTools: McpTool[] = [
  {
    name: 'transition_to_approved',
    description: 'Transition a proposal with approved: true to proposals/approved/ and create a plan.',
    inputSchema: {
      type: 'object',
      properties: {
        proposal_name: { type: 'string', description: 'Name of the proposal file (e.g. "my-proposal")' }
      },
      required: ['proposal_name']
    },
    handler: async (args) => {
      const result = await transitionToApproved(String(args.proposal_name));
      return { content: [{ type: 'text', text: result }] };
    }
  },
  {
    name: 'transition_to_completed',
    description: 'Transition a plan with status: completed to plans/completed/ and generate doc.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_name: { type: 'string', description: 'Name of the plan file' }
      },
      required: ['plan_name']
    },
    handler: async (args) => {
      const result = await transitionToCompleted(String(args.plan_name));
      return { content: [{ type: 'text', text: result }] };
    }
  },
  {
    name: 'transition_to_canceled',
    description: 'Cancel a plan with a reason. Moves to plans/completed/ with canceled status.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_name: { type: 'string', description: 'Name of the plan file' },
        cancellation_reason: { type: 'string', description: 'Reason for cancellation' }
      },
      required: ['plan_name', 'cancellation_reason']
    },
    handler: async (args) => {
      const result = await transitionToCanceled(String(args.plan_name), String(args.cancellation_reason));
      return { content: [{ type: 'text', text: result }] };
    }
  },
  {
    name: 'approve_sub_plan',
    description: 'Approve a sub-plan proposal from a parent plan. Chains critique → improve → approve → create plan → update parent deliverable.',
    inputSchema: {
      type: 'object',
      properties: {
        parent_plan: { type: 'string', description: 'Name of the parent plan (e.g. "phase-vault-portability-pilot")' },
        proposal_name: { type: 'string', description: 'Name of the sub-plan proposal (e.g. "sub-plan-vault-migration-system")' }
      },
      required: ['parent_plan', 'proposal_name']
    },
    handler: async (args) => {
      const result = await approveSubPlan(String(args.parent_plan), String(args.proposal_name));
      return { content: [{ type: 'text', text: result }] };
    }
  }
];
