import { McpTool } from '../types';
import { contributeUpstream } from './contribute_upstream';
import { listDocwrightIssues, createDocwrightProposal } from './docwright_intake';

export const contributionTools: McpTool[] = [
  {
    name: 'list_docwright_issues',
    description:
      'List issues on the DocWright upstream GitHub repo, optionally filtered by label or assignee. ' +
      'Read-only — use it to check whether a friction entry or bug is already known before proposing upstream.',
    inputSchema: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'Filter by label (e.g. bug, proposal, contribution-pipeline)',
        },
        assignee: {
          type: 'string',
          description: 'Filter by GitHub username the issue is assigned to',
        },
        state: {
          type: 'string',
          description: 'Issue state to list (default: open)',
          enum: ['open', 'closed', 'all'],
        },
      },
      required: [],
    },
    handler: async (args) => {
      const result = await listDocwrightIssues(
        args.label ? String(args.label) : undefined,
        args.assignee ? String(args.assignee) : undefined,
        args.state ? String(args.state) : 'open',
      );
      return { content: [{ type: 'text', text: result }] };
    },
  },
  {
    name: 'create_docwright_proposal',
    description:
      'Draft an upstream DocWright proposal as a pre-filled GitHub issue URL. Does NOT submit anything — ' +
      'a human must open the URL to file it (consent-based intake). Check list_docwright_issues for duplicates first.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short proposal title (max 200 chars)',
        },
        body: {
          type: 'string',
          description: 'Proposal body: what & why, security implications, how it will be verified (max 5000 chars)',
        },
        category: {
          type: 'string',
          description: 'Proposal category (default: feature-request)',
          enum: ['feature-request', 'process-change', 'profile', 'integration', 'docs'],
        },
      },
      required: ['title', 'body'],
    },
    handler: async (args) => {
      const result = createDocwrightProposal(
        String(args.title ?? ''),
        String(args.body ?? ''),
        args.category ? String(args.category) : 'feature-request',
      );
      return { content: [{ type: 'text', text: result }] };
    },
  },
  {
    name: 'contribute_upstream',
    description:
      'Submit a bug report, feature request, or other contribution to the DocWright upstream repository. ' +
      'Available only in upstream mode (--mode=upstream). Gated by DOCWRIGHT_CONTRIB_APPROVED=1 env var ' +
      '(human-set; AI cannot forge). Creates a GitHub issue via DOCWRIGHT_GITHUB_TOKEN or generates a ' +
      'pre-filled URL fallback. Every call is logged to .docwright/contributions.log.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short title for the issue (max 200 chars)',
        },
        description: {
          type: 'string',
          description: 'Detailed description of the issue or request (max 5000 chars)',
        },
        category: {
          type: 'string',
          description:
            'Category: bug, feature-request, ux-friction, docs-gap, suggestion (default: bug)',
          enum: ['bug', 'feature-request', 'ux-friction', 'docs-gap', 'suggestion'],
        },
      },
      required: ['title', 'description'],
    },
    handler: async (args) => {
      const result = await contributeUpstream(
        String(args.title ?? ''),
        String(args.description ?? ''),
        args.category ? String(args.category) : 'bug',
      );
      return { content: [{ type: 'text', text: result }] };
    },
  },
];
