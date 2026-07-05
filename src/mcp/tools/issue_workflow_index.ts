import { McpTool } from '../types';
import { issuePreflight, syncIssueFile, startIssueBranch, completeIssueBranch } from './issue_workflow';

export const issueWorkflowTools: McpTool[] = [
  {
    name: 'issue_preflight',
    description:
      'Pre-flight check for processing a GitHub issue: confirms it is open, scans for existing branches/PRs, checks issues/ for a matching file, and checks plans/proposals. Returns structured JSON with ready flag and any warnings.',
    inputSchema: {
      type: 'object',
      properties: {
        num: {
          type: 'number',
          description: 'GitHub issue number to check',
        },
      },
      required: ['num'],
    },
    handler: async (args) => {
      const result = await issuePreflight(Number(args.num));
      return { content: [{ type: 'text', text: result }] };
    },
  },
  {
    name: 'sync_issue_file',
    description:
      'Create or update the local issues/<slug>.md file from a GitHub issue. Fetches title/body/labels from GH, generates frontmatter with github_issue: link. Idempotent — skips if already linked unless force=true.',
    inputSchema: {
      type: 'object',
      properties: {
        num: {
          type: 'number',
          description: 'GitHub issue number to sync',
        },
        force: {
          type: 'boolean',
          description: 'Overwrite existing file even if github_issue is already set',
        },
      },
      required: ['num'],
    },
    handler: async (args) => {
      const result = await syncIssueFile(Number(args.num), Boolean(args.force));
      return { content: [{ type: 'text', text: result }] };
    },
  },
  {
    name: 'start_issue_branch',
    description:
      'Create a git branch for a GitHub issue with validated naming: <type>/<num>-<kebab-slug>. Fetches latest origin/main first. Type must be one of: fix, feat, docs, refactor, chore. Idempotent — returns existing branch if already created.',
    inputSchema: {
      type: 'object',
      properties: {
        num: {
          type: 'number',
          description: 'GitHub issue number',
        },
        type: {
          type: 'string',
          description: 'Branch type prefix: fix, feat, docs, refactor, or chore',
          enum: ['fix', 'feat', 'docs', 'refactor', 'chore'],
        },
      },
      required: ['num', 'type'],
    },
    handler: async (args) => {
      const result = await startIssueBranch(Number(args.num), String(args.type));
      return { content: [{ type: 'text', text: result }] };
    },
  },
  {
    name: 'complete_issue_branch',
    description:
      'Finish an issue branch: runs test suite, pushes, creates a PR with Closes #<num>, optionally merges, verifies the issue closed, and cleans up. Set merge=true to auto-merge; skipTests=true to skip the test gate.',
    inputSchema: {
      type: 'object',
      properties: {
        num: {
          type: 'number',
          description: 'GitHub issue number to complete',
        },
        merge: {
          type: 'boolean',
          description: 'Auto-merge the PR after tests pass (default: false)',
        },
        skip_tests: {
          type: 'boolean',
          description: 'Skip the pre-PR test suite (default: false)',
        },
      },
      required: ['num'],
    },
    handler: async (args) => {
      const result = await completeIssueBranch(Number(args.num), {
        merge: Boolean(args.merge),
        skipTests: Boolean(args.skip_tests),
      });
      return { content: [{ type: 'text', text: result }] };
    },
  },
];
