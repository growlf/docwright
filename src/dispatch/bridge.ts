/**
 * Bug-reporting bridge — suggest-style dedup + demand signal (proposal #68 §3).
 *
 * Two-phase, never auto-reject:
 *   1. suggestDuplicates() — read-only; returns similar open bugs ("is one of these yours?").
 *   2a. confirmDuplicate()  — the reporter picked one: +1 demand AND harvest their context.
 *   2b. createReportedBug() — none matched: file a new bug, cross-linking any near-misses as
 *       `related` (the association tier — never a full demand increment, so counts don't lie).
 *
 * Invariant: explicit reports only. There is no passive/automatic detection path here
 * (that would be telemetry — forbidden).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { parseFrontmatter, setFrontmatterField } from './frontmatter';

export interface BugReport {
  title: string;
  description: string;
  reporter: string;
  priority?: 'low' | 'medium' | 'high';
  system_info?: string;
  milestone?: string;
  category?: 'bug' | 'feature';
}

export interface DuplicateSuggestion {
  path: string;
  title: string;
  score: number;
  demandCount: number;
  source: 'local' | 'gh';
  ghIssueNumber?: number;
}

// Titles at/above this Jaccard score are surfaced as suggestions ("is one of these yours?").
// Below it, reports are simply filed as new (no association noise).
export const SUGGEST_THRESHOLD = 0.5;

function tokenize(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2),
  );
}

/** Token-set Jaccard similarity of two titles (0..1). */
export function getSimilarity(a: string, b: string): number {
  const t1 = tokenize(a);
  const t2 = tokenize(b);
  if (t1.size === 0 || t2.size === 0) return 0;
  const inter = new Set([...t1].filter(x => t2.has(x)));
  const union = new Set([...t1, ...t2]);
  return inter.size / union.size;
}

function openBugs(repoRoot: string, category: 'bug' | 'feature' = 'bug'): Array<{ relPath: string; absPath: string; fm: Record<string, any> }> {
  const issuesDir = path.join(repoRoot, 'issues');
  if (!fs.existsSync(issuesDir)) return [];
  const out: Array<{ relPath: string; absPath: string; fm: Record<string, any> }> = [];
  for (const file of fs.readdirSync(issuesDir)) {
    if (!file.endsWith('.md') || file === 'README.md') continue;
    const absPath = path.join(issuesDir, file);
    try {
      const fm = parseFrontmatter(fs.readFileSync(absPath, 'utf-8'));
      if (String(fm.category ?? '') === category && ['new', 'triaged', 'scope-checked', 'awaiting-proposal'].includes(String(fm.status ?? ''))) {
        out.push({ relPath: path.join('issues', file), absPath, fm });
      }
    } catch { /* skip unreadable */ }
  }
  return out;
}

export interface GhIssue { number: number; title: string; }
/** Injectable GitHub-issue query — lets tests substitute a fake so they never
 *  shell out to the real `gh` CLI (the source of the flaky 2000ms CI timeout). */
export type GhIssueQuery = (category: 'bug' | 'feature') => GhIssue[];

/** Query GitHub for open issues tracked under the given category's label. Returns empty array if gh CLI is unavailable. */
function queryGhIssues(category: 'bug' | 'feature' = 'bug'): GhIssue[] {
  const label = category === 'feature' ? 'enhancement' : 'bug';
  try {
    const out = execSync(`gh issue list --label ${label} --state open --json number,title`, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(out) as GhIssue[];
  } catch {
    return [];
  }
}

/** Phase 1 — read-only. Similar open bugs/feature requests (same category only), best match first. Never writes. */
export function suggestDuplicates(
  repoRoot: string,
  title: string,
  category: 'bug' | 'feature' = 'bug',
  ghQuery: GhIssueQuery = queryGhIssues,
): DuplicateSuggestion[] {
  const local: DuplicateSuggestion[] = openBugs(repoRoot, category)
    .map(b => ({
      path: b.relPath,
      title: String(b.fm.title ?? ''),
      score: getSimilarity(title, String(b.fm.title ?? '')),
      demandCount: parseInt(String(b.fm.demand_count ?? '1'), 10),
      source: 'local' as const,
    }))
    .filter(s => s.score >= SUGGEST_THRESHOLD);

  const gh: DuplicateSuggestion[] = ghQuery(category)
    .map(issue => ({
      path: `gh:${issue.number}`,
      title: issue.title,
      score: getSimilarity(title, issue.title),
      demandCount: 0,
      source: 'gh' as const,
      ghIssueNumber: issue.number,
    }))
    .filter(s => s.score >= SUGGEST_THRESHOLD);

  return [...local, ...gh].sort((a, b) => b.score - a.score);
}

/** Phase 2a — reporter confirmed a match: +1 demand and append their context. */
export function confirmDuplicate(repoRoot: string, canonicalPath: string, report: BugReport): { path: string; demandCount: number } {
  const abs = path.resolve(repoRoot, canonicalPath);
  if (!abs.startsWith(path.resolve(repoRoot)) || !fs.existsSync(abs)) {
    throw new Error(`canonical issue not found: ${canonicalPath}`);
  }
  let raw = fs.readFileSync(abs, 'utf-8');
  const fm = parseFrontmatter(raw);
  const nextDemand = parseInt(String(fm.demand_count ?? '1'), 10) + 1;
  raw = setFrontmatterField(raw, 'demand_count', nextDemand);

  // Track report dates for time-weighted demand scoring
  const today = new Date().toISOString().slice(0, 10);
  const existingDates: string[] = Array.isArray(fm.reported_dates) ? fm.reported_dates : [];
  if (!existingDates.includes(today)) {
    existingDates.push(today);
  }
  raw = setFrontmatterField(raw, 'reported_dates', `[${existingDates.join(', ')}]`);

  // Harvest context — the goldmine is the spread of environments/repros, not the tally.
  const block = [
    `### Additional report — ${today} (${report.reporter})`,
    '',
    report.description.trim(),
    report.system_info ? `\n**Environment:** ${report.system_info.trim()}` : '',
  ].join('\n');
  if (!/^##\s+Additional reports/m.test(raw)) raw = raw.trimEnd() + '\n\n## Additional reports\n';
  raw = raw.trimEnd() + '\n\n' + block + '\n';

  fs.writeFileSync(abs, raw, 'utf-8');
  return { path: canonicalPath, demandCount: nextDemand };
}

/** Phase 2b — no match: file a new bug or feature request, associating any near-misses via `related`. */
export function createReportedBug(repoRoot: string, report: BugReport, related: string[] = []): { path: string; demandCount: number } {
  const issuesDir = path.join(repoRoot, 'issues');
  if (!fs.existsSync(issuesDir)) fs.mkdirSync(issuesDir, { recursive: true });

  const category = report.category === 'feature' ? 'feature' : 'bug';
  const prefix = category === 'feature' ? 'feature' : 'bug';
  const base = report.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 50) || 'report';
  let slug = base, n = 1;
  while (fs.existsSync(path.join(issuesDir, `${prefix}-${slug}.md`))) { slug = `${base}-${n++}`; }
  const relPath = path.join('issues', `${prefix}-${slug}.md`);
  const today = new Date().toISOString().slice(0, 10);

  const relatedBlock = related.length
    ? 'related:\n' + related.map(r => `  - ${r}`).join('\n') + '\n'
    : '';

  const content = `---
title: ${report.title}
status: new
created: ${today}
author: ${report.reporter}
author-role: user
category: ${category}
priority: ${report.priority || 'medium'}
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [${today}]
channel: dev
${relatedBlock}tags:
  - reported-${category}
---

# ${report.title}

## Description

${report.description}

## System Info

${report.system_info || 'None provided'}
`;
  fs.writeFileSync(path.join(issuesDir, `${prefix}-${slug}.md`), content, 'utf-8');
  return { path: relPath, demandCount: 1 };
}

/**
 * Promote an already-filed local issue to a real GitHub issue. Manual/deliberate only --
 * reports are never auto-created on GitHub at submit time (see #68 §3 demand-gated
 * promotion: the UI only offers this once demand_count crosses a threshold, to avoid
 * flooding the public tracker with first-time or duplicate-prone reports).
 */
export function promoteIssueToGithub(repoRoot: string, issuePath: string): { url: string; number: number } {
  const fullPath = path.resolve(repoRoot, issuePath);
  const issuesRoot = path.resolve(repoRoot, 'issues');
  if (!fullPath.startsWith(issuesRoot + path.sep)) {
    throw new Error('issuePath must be under issues/');
  }
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${issuePath}`);
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const fm = parseFrontmatter(content);
  if (fm.github_issue) {
    throw new Error(`Already linked to GitHub issue #${fm.github_issue}`);
  }

  const category = String(fm.category ?? 'bug');
  const label = category === 'feature' ? 'enhancement' : 'bug';
  const body = [
    `**Description:** ${fm.description || '(no description)'}`,
    `**Reporter:** ${fm.reporter || fm.author || 'unknown'}`,
    `**Priority:** ${fm.priority || 'none'}`,
    `**Demand Count:** ${fm.demand_count || '1'}`,
    `**Source:** DocWright vault (\`${issuePath}\`)`,
    '',
    '---',
    '',
    '_Auto-promoted from DocWright demand heatmap._',
  ].join('\n');

  let ghOutput: string;
  try {
    ghOutput = execSync(
      `gh issue create --title ${JSON.stringify(String(fm.title || 'Untitled report'))} --body ${JSON.stringify(body)} --label "${label},docwright-auto"`,
      { cwd: repoRoot, encoding: 'utf-8', timeout: 30000 },
    ).trim();
  } catch (e: any) {
    throw new Error(`GitHub CLI failed: ${e.stderr || e.message}`);
  }

  const ghNumMatch = ghOutput.match(/\/(\d+)$/);
  const ghNumber = parseInt(ghNumMatch ? ghNumMatch[1] : '0', 10);
  fs.writeFileSync(fullPath, setFrontmatterField(content, 'github_issue', ghNumber), 'utf-8');

  return { url: ghOutput, number: ghNumber };
}
