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
 * (that would be telemetry — forbidden). New bugs default to `milestone: future`, consistent
 * with the rest of the vault until a determination cycle schedules them.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseFrontmatter, setFrontmatterField } from './frontmatter';

export interface BugReport {
  title: string;
  description: string;
  reporter: string;
  priority?: 'low' | 'medium' | 'high';
  system_info?: string;
  milestone?: string;
}

export interface DuplicateSuggestion {
  path: string;
  title: string;
  score: number;
  demandCount: number;
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

function openBugs(repoRoot: string): Array<{ relPath: string; absPath: string; fm: Record<string, any> }> {
  const issuesDir = path.join(repoRoot, 'issues');
  if (!fs.existsSync(issuesDir)) return [];
  const out: Array<{ relPath: string; absPath: string; fm: Record<string, any> }> = [];
  for (const file of fs.readdirSync(issuesDir)) {
    if (!file.endsWith('.md') || file === 'README.md') continue;
    const absPath = path.join(issuesDir, file);
    try {
      const fm = parseFrontmatter(fs.readFileSync(absPath, 'utf-8'));
      if (fm.category === 'bug' && ['open', 'in-progress'].includes(String(fm.status ?? ''))) {
        out.push({ relPath: path.join('issues', file), absPath, fm });
      }
    } catch { /* skip unreadable */ }
  }
  return out;
}

/** Phase 1 — read-only. Similar open bugs, best match first. Never writes. */
export function suggestDuplicates(repoRoot: string, title: string): DuplicateSuggestion[] {
  return openBugs(repoRoot)
    .map(b => ({
      path: b.relPath,
      title: String(b.fm.title ?? ''),
      score: getSimilarity(title, String(b.fm.title ?? '')),
      demandCount: parseInt(String(b.fm.demand_count ?? '1'), 10),
    }))
    .filter(s => s.score >= SUGGEST_THRESHOLD)
    .sort((a, b) => b.score - a.score);
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

  // Harvest context — the goldmine is the spread of environments/repros, not the tally.
  const today = new Date().toISOString().slice(0, 10);
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

/** Phase 2b — no match: file a new bug, associating any near-misses via `related`. */
export function createReportedBug(repoRoot: string, report: BugReport, related: string[] = []): { path: string; demandCount: number } {
  const issuesDir = path.join(repoRoot, 'issues');
  if (!fs.existsSync(issuesDir)) fs.mkdirSync(issuesDir, { recursive: true });

  const base = report.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 50) || 'report';
  let slug = base, n = 1;
  while (fs.existsSync(path.join(issuesDir, `bug-${slug}.md`))) { slug = `${base}-${n++}`; }
  const relPath = path.join('issues', `bug-${slug}.md`);
  const today = new Date().toISOString().slice(0, 10);

  const relatedBlock = related.length
    ? 'related:\n' + related.map(r => `  - ${r}`).join('\n') + '\n'
    : '';

  const content = `---
title: ${report.title}
status: open
created: ${today}
author: ${report.reporter}
author-role: user
category: bug
priority: ${report.priority || 'medium'}
complexity: medium
estimated_effort: S
demand_count: 1
milestone: future
channel: dev
${relatedBlock}tags:
  - reported-bug
---

# ${report.title}

## Description

${report.description}

## System Info

${report.system_info || 'None provided'}
`;
  fs.writeFileSync(path.join(issuesDir, `bug-${slug}.md`), content, 'utf-8');
  return { path: relPath, demandCount: 1 };
}
