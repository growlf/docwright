/**
 * issue-source.ts — Step 3 of the GH-pivot: a flagged, additive read layer.
 *
 * `readIssueDocs()` returns issue documents (an fm-shaped `{ path, fm }`, the same
 * shape `readDir(issues/)` produces) from EITHER the local `issues/*.md` files
 * (default) OR the GitHub Project board, keyed on `ISSUES_SOURCE`. The GH mapper
 * reconstructs `demand_count` + EVERY `reported_date` from the Project's Demand /
 * Reported Dates fields, so the existing time-weighted heatmap math is unchanged —
 * it just gets its rows from GitHub. Misconfigured GH degrades to local so the UI
 * never breaks. No VS Code deps (dispatch invariant).
 *
 * See docs/github-project-schema.md for the field mapping. Nothing here writes.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseFrontmatter } from './frontmatter';
import { GitHubClient, githubConfigFromEnv, type ProjectItemDetail } from './github-issues';

export interface IssueDoc {
  path: string;
  fm: Record<string, any>;
}

export type IssueSourceKind = 'local' | 'github';

/** Which issue source is active. Default `local` — the flag must be explicitly `github`. */
export function getIssueSource(env: NodeJS.ProcessEnv = process.env): IssueSourceKind {
  return env.ISSUES_SOURCE === 'github' ? 'github' : 'local';
}

/** Read the local `issues/*.md` files as `{ path, fm }` (today's behavior). */
export function readLocalIssueDocs(repoRoot: string): IssueDoc[] {
  const dir = path.join(repoRoot, 'issues');
  if (!fs.existsSync(dir)) return [];
  const out: IssueDoc[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const full = path.join(dir, name);
    try {
      const fm = parseFrontmatter(fs.readFileSync(full, 'utf-8'));
      out.push({ path: path.join('issues', name), fm });
    } catch { /* skip unreadable */ }
  }
  return out;
}

function parseDates(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p.map(String);
    } catch { /* fall through to bracket-list parse */ }
    return raw.replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function labelsToCategory(labels: string[]): string {
  const l = labels.map(s => s.toLowerCase());
  if (l.includes('enhancement') || l.includes('feature')) return 'feature';
  if (l.includes('bug')) return 'bug';
  const prefixed = labels.find(s => s.toLowerCase().startsWith('category:'));
  return prefixed ? prefixed.slice('category:'.length) : 'bug';
}

/**
 * Map a GH Project item (issue + field values) into an fm-shaped IssueDoc.
 * `path` uses the original slug from the `DocWright ID` field when present (so links
 * and path-based logic keep working), else a stable `issues/gh-<number>.md`.
 */
export function projectItemToDoc(item: Pick<ProjectItemDetail, 'issue' | 'fields'>): IssueDoc | null {
  if (!item.issue) return null;
  const f = item.fields ?? {};
  const docId = String(f['DocWright ID'] ?? '').trim().replace(/^issues\//, '').replace(/\.md$/, '');
  const slug = docId || `gh-${item.issue.number}`;
  const fm: Record<string, any> = {
    title: item.issue.title,
    status: String(f['Lifecycle'] ?? (item.issue.state === 'closed' ? 'resolved' : 'new')),
    category: labelsToCategory(item.issue.labels),
    priority: String(f['Priority'] ?? ''),
    demand_count: f['Demand'] != null ? Number(f['Demand']) : 0,
    reported_dates: parseDates(f['Reported Dates']),
    channel: String(f['Channel'] ?? ''),
    scope_decision: String(f['Scope Decision'] ?? ''),
    github_issue: item.issue.number,
    url: item.issue.url,
  };
  return { path: path.posix.join('issues', `${slug}.md`), fm };
}

function makeClient(env: NodeJS.ProcessEnv): GitHubClient | null {
  const cfg = githubConfigFromEnv(env);
  return cfg ? new GitHubClient(cfg) : null;
}

/**
 * Read issue docs from the active source. GH-sourced docs are reconstructed from the
 * Project board; a misconfigured/unreachable GH source degrades to the local files.
 */
export async function readIssueDocs(
  repoRoot: string,
  opts: { env?: NodeJS.ProcessEnv; client?: GitHubClient } = {},
): Promise<IssueDoc[]> {
  const env = opts.env ?? process.env;
  if (getIssueSource(env) === 'github') {
    const client = opts.client ?? makeClient(env);
    if (client) {
      const items = await client.listProjectItemsDetailed();
      return items.map(projectItemToDoc).filter((d): d is IssueDoc => d !== null);
    }
    // GH selected but not configured — degrade to local rather than break the UI.
  }
  return readLocalIssueDocs(repoRoot);
}
