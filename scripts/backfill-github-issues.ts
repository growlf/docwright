#!/usr/bin/env tsx
/**
 * Backfill GitHub issue links for already-filed local reports (Wave C, Step 3).
 *
 * Finds issues/*.md with category: bug|feature, an open status, and
 * demand_count at or above the same threshold the heatmap's manual "⬆ GH"
 * promote button uses (>=3) that don't yet have a github_issue: backlink,
 * and promotes each one via the same promoteIssueToGithub() the UI button
 * calls. Deliberately demand-gated, not run-on-every-report: creating a
 * public GitHub issue is an externally-visible action, so this stays
 * dry-run by default.
 *
 * Usage:
 *   npx tsx scripts/backfill-github-issues.ts                 # dry-run listing
 *   npx tsx scripts/backfill-github-issues.ts --execute        # actually create them
 *   npx tsx scripts/backfill-github-issues.ts --threshold=5    # override the demand gate
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseFrontmatter } from '../src/dispatch/frontmatter';
import { promoteIssueToGithub } from '../src/dispatch/bridge';

const REPO_ROOT = process.env.DOCWRIGHT_VAULT_ROOT ?? process.cwd();
const ISSUES_DIR = path.join(REPO_ROOT, 'issues');

const execute = process.argv.includes('--execute');
const thresholdArg = process.argv.find(a => a.startsWith('--threshold='));
const threshold = thresholdArg ? parseInt(thresholdArg.split('=')[1], 10) : 3;

const CLOSED_STATUSES = ['resolved', 'wont-fix', 'duplicate'];

interface Candidate { relPath: string; title: string; category: string; demandCount: number }

function findCandidates(): Candidate[] {
  const out: Candidate[] = [];
  if (!fs.existsSync(ISSUES_DIR)) return out;
  for (const file of fs.readdirSync(ISSUES_DIR)) {
    if (!file.endsWith('.md') || file === 'README.md') continue;
    const relPath = path.join('issues', file);
    try {
      const fm = parseFrontmatter(fs.readFileSync(path.join(ISSUES_DIR, file), 'utf-8'));
      const category = String(fm.category ?? '');
      if (!['bug', 'feature'].includes(category)) continue;
      if (CLOSED_STATUSES.includes(String(fm.status ?? ''))) continue;
      if (fm.github_issue) continue;
      const demandCount = parseInt(String(fm.demand_count ?? '0'), 10);
      if (demandCount < threshold) continue;
      out.push({ relPath, title: String(fm.title ?? file), category, demandCount });
    } catch { /* skip unreadable */ }
  }
  return out.sort((a, b) => b.demandCount - a.demandCount);
}

function main(): void {
  const candidates = findCandidates();
  if (candidates.length === 0) {
    console.log(`No un-linked ${['bug', 'feature'].join('/')} issues at or above demand_count ${threshold}.`);
    return;
  }

  console.log(`${candidates.length} candidate(s) at or above demand_count ${threshold}:\n`);
  for (const c of candidates) {
    console.log(`  [${c.category}] demand ${c.demandCount} — ${c.relPath} — ${c.title}`);
  }

  if (!execute) {
    console.log('\nDry run only — pass --execute to actually create these as GitHub issues.');
    return;
  }

  console.log('\nCreating GitHub issues...\n');
  let ok = 0, failed = 0;
  for (const c of candidates) {
    try {
      const res = promoteIssueToGithub(REPO_ROOT, c.relPath);
      console.log(`  ✓ ${c.relPath} -> #${res.number} (${res.url})`);
      ok++;
    } catch (err) {
      console.log(`  ✗ ${c.relPath}: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }
  console.log(`\n${ok} created, ${failed} failed.`);
}

main();
