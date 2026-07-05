import { McpTool } from '../types';
import { logFriction } from './friction';

export const frictionTools: McpTool[] = [
  {
    name: 'log_friction',
    description:
      'Record a structured friction entry (bug, missing feature, UX papercut, docs gap) in docs/friction-log.md. ' +
      'Available only in vault mode (--mode=vault). Entries are triaged on a weekly review cadence; ' +
      'untriaged entries older than 7 days surface as a notification badge on the vault status page.',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'What happened and where it hurt (max 1000 chars)',
        },
        category: {
          type: 'string',
          description: 'Category of friction (default: ux-friction)',
          enum: ['bug', 'feature-request', 'ux-friction', 'docs-gap', 'missing-abstraction'],
        },
        severity: {
          type: 'string',
          description: 'How much it hurt (default: medium)',
          enum: ['low', 'medium', 'high'],
        },
      },
      required: ['description'],
    },
    handler: async (args) => {
      const result = logFriction(
        String(args.description ?? ''),
        args.category ? String(args.category) : 'ux-friction',
        args.severity ? String(args.severity) : 'medium',
      );
      return { content: [{ type: 'text', text: result }] };
    },
  },
];
