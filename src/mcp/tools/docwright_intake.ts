import { getRepoRoot } from '../lib/paths';
import { getMode } from '../lib/mode';
import { spawnSync } from 'node:child_process';

/**
 * Consent-based intake loop (contribution pipeline, Step 3):
 *   friction entry → list_docwright_issues (is it already known?) →
 *   create_docwright_proposal (pre-filled URL, human submits) if novel.
 *
 * Both tools are read-only against GitHub — list queries the public API,
 * create only generates a URL. Neither writes upstream, so neither needs
 * the DOCWRIGHT_CONTRIB_APPROVED gate that contribute_upstream carries.
 */

const DEFAULT_UPSTREAM_SLUG = 'growlf/docwright';

const PROPOSAL_CATEGORIES = [
  'feature-request',
  'process-change',
  'profile',
  'integration',
  'docs',
] as const;

function sanitize(input: string, maxLength: number): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * The DocWright upstream repo slug. In upstream mode the repo root IS the
 * DocWright checkout, so derive from its origin remote; in vault mode the
 * origin is the vault's own repo, so use DOCWRIGHT_UPSTREAM_REPO or the default.
 */
export function upstreamRepoSlug(): string {
  const envSlug = process.env.DOCWRIGHT_UPSTREAM_REPO;
  if (envSlug && /^[\w.-]+\/[\w.-]+$/.test(envSlug)) return envSlug;
  if (getMode() !== 'upstream') return DEFAULT_UPSTREAM_SLUG;
  try {
    const root = getRepoRoot();
    if (!root) return DEFAULT_UPSTREAM_SLUG;
    const result = spawnSync('git', ['remote', 'get-url', 'origin'], {
      cwd: root,
      encoding: 'utf8',
    });
    if (result.status !== 0) return DEFAULT_UPSTREAM_SLUG;
    const url = result.stdout.trim();
    const sshMatch = url.match(/^git@[^:]+:(.+?)(?:\.git)?$/);
    if (sshMatch) return sshMatch[1];
    const httpsMatch = url.match(/^https?:\/\/[^/]+\/(.+?)(?:\.git)?$/);
    if (httpsMatch) return httpsMatch[1];
    return DEFAULT_UPSTREAM_SLUG;
  } catch {
    return DEFAULT_UPSTREAM_SLUG;
  }
}

export async function listDocwrightIssues(
  label?: string,
  assignee?: string,
  state: string = 'open',
): Promise<string> {
  const slug = upstreamRepoSlug();
  const params = new URLSearchParams({ per_page: '30' });
  params.set('state', ['open', 'closed', 'all'].includes(state) ? state : 'open');
  if (label) params.set('labels', sanitize(label, 100));
  if (assignee) params.set('assignee', sanitize(assignee, 50));

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  const token = process.env.DOCWRIGHT_GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  let issues: any[];
  try {
    const response = await fetch(
      `https://api.github.com/repos/${slug}/issues?${params.toString()}`,
      { headers },
    );
    if (!response.ok) {
      return `ERROR: GitHub API returned ${response.status} for ${slug}. ${
        response.status === 403 ? 'Rate limited — set DOCWRIGHT_GITHUB_TOKEN to raise the limit.' : ''
      }`.trim();
    }
    issues = (await response.json()) as any[];
  } catch (err: any) {
    return `ERROR: could not reach GitHub (${err?.message ?? 'network error'}). Are you offline?`;
  }

  // The issues API also returns PRs — filter them out.
  const real = issues.filter((i) => !i.pull_request);
  if (real.length === 0) {
    return `No ${state} issues found on ${slug}${label ? ` with label "${label}"` : ''}${assignee ? ` assigned to ${assignee}` : ''}.`;
  }

  const lines = real.map((i) => {
    const labels = (i.labels ?? [])
      .map((l: any) => (typeof l === 'string' ? l : l.name))
      .filter(Boolean)
      .join(', ');
    const who = i.assignee?.login ? ` → ${i.assignee.login}` : '';
    return `#${i.number} [${labels || 'unlabeled'}]${who} ${i.title}\n   ${i.html_url}`;
  });
  return [`${real.length} ${state} issue(s) on ${slug}:`, '', ...lines].join('\n');
}

export function createDocwrightProposal(
  title: string,
  body: string,
  category: string = 'feature-request',
): string {
  const sanitizedTitle = sanitize(title, 200);
  if (!sanitizedTitle) {
    return 'ERROR: title is required and must be non-empty after sanitization.';
  }
  const sanitizedBody = sanitize(body, 5000) || '(no body provided)';
  const sanitizedCategory = (PROPOSAL_CATEGORIES as readonly string[]).includes(category)
    ? category
    : 'feature-request';

  const slug = upstreamRepoSlug();
  const params = new URLSearchParams({
    title: `[proposal] ${sanitizedTitle}`,
    body: [
      `**Category:** ${sanitizedCategory}`,
      '',
      sanitizedBody,
      '',
      '---',
      '_Drafted via create_docwright_proposal — check `list_docwright_issues` first for duplicates._',
    ].join('\n'),
    labels: ['proposal', sanitizedCategory].join(','),
  });
  const url = `https://github.com/${slug}/issues/new?${params.toString()}`;

  return [
    '📋 Proposal drafted — nothing has been submitted. A human must open this URL to file it:',
    url,
  ].join('\n');
}
