import { McpTool } from '../types';
import { createStepIssue, linkStepIssue } from './step_issues';

function resolvePlanPath(plan_name: string): string {
  let p = String(plan_name);
  if (!p.startsWith('plans/')) {
    p = 'plans/' + p;
  }
  if (!p.endsWith('.md')) {
    p = p + '.md';
  }
  return p;
}

export const stepIssueTools: McpTool[] = [
  {
    name: 'create_step_issue',
    description:
      'Create a GitHub issue for a plan step and update the plan file with the issue number and suggested branch name. Requires Issue/Branch columns — run npm run migrate:plan-steps first if the plan was created before this tooling existed.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_name: {
          type: 'string',
          description:
            'Plan filename without path/extension (e.g. chat-session-panel) or full relative path (plans/...md)'
        },
        step: {
          type: 'number',
          description: 'Step number to create an issue for'
        },
        assignee: {
          type: 'string',
          description: 'GitHub username to assign the issue to'
        }
      },
      required: ['plan_name', 'step']
    },
    handler: async (args) => {
      const planPath = resolvePlanPath(String(args.plan_name));
      const result = await createStepIssue(
        planPath,
        Number(args.step),
        args.assignee ? String(args.assignee) : undefined
      );
      return { content: [{ type: 'text', text: result }] };
    }
  },
  {
    name: 'link_step_issue',
    description:
      'Link an existing GitHub issue to a plan step, updating the Issue and Branch columns without creating a new issue.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_name: {
          type: 'string',
          description:
            'Plan filename without path/extension (e.g. chat-session-panel) or full relative path (plans/...md)'
        },
        step: {
          type: 'number',
          description: 'Step number to link the issue to'
        },
        issue_number: {
          type: 'number',
          description: 'Existing GitHub issue number to link'
        }
      },
      required: ['plan_name', 'step', 'issue_number']
    },
    handler: async (args) => {
      const planPath = resolvePlanPath(String(args.plan_name));
      const result = await linkStepIssue(
        planPath,
        Number(args.step),
        Number(args.issue_number)
      );
      return { content: [{ type: 'text', text: result }] };
    }
  }
];
