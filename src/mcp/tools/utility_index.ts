import { McpTool } from '../types';
import { getFacts, collate, runDryRun, auditLog } from './utility';

export const utilityTools: McpTool[] = [
  {
    name: 'get_facts',
    description: 'Project invariants and operational gotchas. Call before lifecycle changes.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      const res = await getFacts();
      return { content: [{ type: 'text', text: res }] };
    }
  },
  {
    name: 'collate',
    description: 'Find overlapping proposals and plans by keyword similarity.',
    inputSchema: {
      type: 'object',
      properties: {
        threshold: { type: 'number', description: 'Jaccard similarity threshold (default 0.12)' }
      }
    },
    handler: async (args) => {
      const res = await collate(args.threshold !== undefined ? Number(args.threshold) : 0.12);
      return { content: [{ type: 'text', text: res }] };
    }
  },
  {
    name: 'run_dry_run',
    description: 'Show pending lifecycle transitions without applying them.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      const res = await runDryRun();
      return { content: [{ type: 'text', text: res }] };
    }
  },
  {
    name: 'audit_log',
    description: 'Read recent lifecycle transitions from .docwright/audit.jsonl.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max entries to return (default 50)' }
      }
    },
    handler: async (args) => {
      const res = await auditLog(args.limit !== undefined ? Number(args.limit) : 50);
      return { content: [{ type: 'text', text: res }] };
    }
  }
];
