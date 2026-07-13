#!/usr/bin/env tsx
/**
 * parity-check-issues.ts — Step 6 CLI for the GH-pivot: the Bar B PARITY GATE.
 *
 * Verifies the migrated GH board preserves every local issue's juice (demand + all
 * reported_dates + status + scope + body), the demand ranking, board placement, and that
 * governance-doc links resolve. Exits 1 when the gate fails — cutover (Step 7) is BLOCKED
 * until this is green. Read-only.
 *
 *   npm run parity:issues
 *
 * Requires: DOCWRIGHT_GH_REPO, DOCWRIGHT_GH_TOKEN, DOCWRIGHT_GH_PROJECT_ID.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { GitHubClient, githubConfigFromEnv } from '../src/dispatch/github-issues';
import { parseLocalIssue, type LocalIssue } from '../src/dispatch/migrate-issues';
import { checkParity } from '../src/dispatch/parity-check';

const ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return path.resolve(process.env.DOCWRIGHT_ROOT);
  let dir = path.dirname(new URL(import.meta.url).pathname);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'VERSION'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
})();

function readLocalIssues(): LocalIssue[] {
  const dir = path.join(ROOT, 'issues');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(n => n.endsWith('.md') && n !== 'README.md')
    .map(n => parseLocalIssue(path.join('issues', n), fs.readFileSync(path.join(dir, n), 'utf-8')));
}

function readGovernanceDocs(): Array<{ path: string; content: string }> {
  const out: Array<{ path: string; content: string }> = [];
  for (const rel of ['proposals', 'proposals/approved', 'plans', 'plans/completed', 'decisions']) {
    const dir = path.join(ROOT, rel);
    if (!fs.existsSync(dir)) continue;
    for (const n of fs.readdirSync(dir)) {
      if (n.endsWith('.md')) out.push({ path: path.join(rel, n), content: fs.readFileSync(path.join(dir, n), 'utf-8') });
    }
  }
  return out;
}

async function main() {
  const cfg = githubConfigFromEnv();
  if (!cfg) {
    console.error('ERROR: set DOCWRIGHT_GH_REPO, DOCWRIGHT_GH_TOKEN and DOCWRIGHT_GH_PROJECT_ID.');
    process.exit(1);
  }
  const client = new GitHubClient(cfg);
  const mapPath = path.join(ROOT, 'issues.migration-map.json');
  const migrationMap = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, 'utf-8')) : undefined;

  const report = checkParity({
    locals: readLocalIssues(),
    board: await client.listProjectItemsDetailed(),
    docs: readGovernanceDocs(),
    migrationMap,
  });

  console.log(`\n=== GH-pivot parity gate (Bar B) — ${cfg.owner}/${cfg.repo} project ${cfg.projectId} ===\n`);
  for (const c of report.checks) {
    console.log(`  ${c.passed ? '✅' : '❌'} ${c.name} — ${c.detail}`);
    for (const f of c.failures.slice(0, 20)) console.log(`       • ${f}`);
    if (c.failures.length > 20) console.log(`       • …and ${c.failures.length - 20} more`);
  }
  console.log(`\n${report.summary}\n`);
  process.exit(report.passed ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
