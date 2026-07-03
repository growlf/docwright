import { McpTool } from '../types';
import { contributeUpstream } from './contribute_upstream';

export const contributionTools: McpTool[] = [
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
