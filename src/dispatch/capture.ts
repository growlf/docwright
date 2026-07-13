/**
 * capture.ts — source-agnostic facade for the capture pipeline (GH-pivot Step 4).
 *
 * Routes suggest/confirm/create to the local `issues/*.md` bridge (default) or the
 * GitHub-backed pipeline when ISSUES_SOURCE=github. Callers (the MCP `capture_bug_report`
 * tool + the Web-UI report endpoints) depend on this facade, not on either backend, so
 * the cutover (Step 7) is a flag flip. GH selected but unconfigured degrades to local.
 */
import {
  suggestDuplicates, confirmDuplicate, createReportedBug,
  type BugReport, type DuplicateSuggestion,
} from './bridge';
import { ghSuggestDuplicates, ghCreateReportedBug, ghConfirmDuplicate } from './capture-github';
import { GitHubClient, githubConfigFromEnv } from './github-issues';
import { getIssueSource } from './issue-source';

export interface CaptureResult {
  path: string;
  demandCount: number;
  source: 'local' | 'github';
  url?: string;
  ghIssueNumber?: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** GH client from env, or null when GH isn't configured (→ caller degrades to local). */
function ghClient(env: NodeJS.ProcessEnv): GitHubClient | null {
  const cfg = githubConfigFromEnv(env);
  return cfg ? new GitHubClient(cfg) : null;
}

/** True when capture should target GitHub AND GitHub is configured. */
function useGithub(env: NodeJS.ProcessEnv, client: GitHubClient | null): client is GitHubClient {
  return getIssueSource(env) === 'github' && client !== null;
}

export async function captureSuggest(
  repoRoot: string,
  title: string,
  category: 'bug' | 'feature' = 'bug',
  opts: { env?: NodeJS.ProcessEnv; client?: GitHubClient | null } = {},
): Promise<DuplicateSuggestion[]> {
  const env = opts.env ?? process.env;
  const client = opts.client !== undefined ? opts.client : ghClient(env);
  if (useGithub(env, client)) return ghSuggestDuplicates(client, title, category);
  return suggestDuplicates(repoRoot, title, category);
}

export async function captureConfirm(
  repoRoot: string,
  ref: string,
  report: BugReport,
  opts: { env?: NodeJS.ProcessEnv; client?: GitHubClient | null } = {},
): Promise<CaptureResult> {
  const env = opts.env ?? process.env;
  const client = opts.client !== undefined ? opts.client : ghClient(env);
  if (useGithub(env, client)) {
    const r = await ghConfirmDuplicate(client, ref, report, today());
    return { path: r.path, demandCount: r.demandCount, source: 'github', ghIssueNumber: r.ghIssueNumber };
  }
  const r = confirmDuplicate(repoRoot, ref, report);
  return { path: r.path, demandCount: r.demandCount, source: 'local' };
}

export async function captureCreate(
  repoRoot: string,
  report: BugReport,
  related: string[] = [],
  opts: { env?: NodeJS.ProcessEnv; client?: GitHubClient | null } = {},
): Promise<CaptureResult> {
  const env = opts.env ?? process.env;
  const client = opts.client !== undefined ? opts.client : ghClient(env);
  if (useGithub(env, client)) {
    const r = await ghCreateReportedBug(client, report, today(), related);
    return { path: r.path, demandCount: r.demandCount, source: 'github', url: r.url, ghIssueNumber: r.ghIssueNumber };
  }
  const r = createReportedBug(repoRoot, report, related);
  return { path: r.path, demandCount: r.demandCount, source: 'local' };
}
