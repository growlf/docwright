#!/usr/bin/env tsx
/**
 * migrate-issues-to-github.ts — Step 5 CLI for the GH-pivot.
 *
 * Lossless, two-way, idempotent migration of local `issues/*.md` → GitHub Issues + the
 * DocWright Project board. DRY-RUN BY DEFAULT — prints the plan and changes nothing;
 * pass `--execute` to write. Even with `--execute` this step is NON-DESTRUCTIVE (originals
 * stay; archiving is Step 7, gated on the Step 6 parity check).
 *
 *   npm run migrate:issues            # dry-run: show the plan
 *   npm run migrate:issues -- --execute
 *
 * Requires: DOCWRIGHT_GH_REPO, DOCWRIGHT_GH_TOKEN, DOCWRIGHT_GH_PROJECT_ID.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { GitHubClient, githubConfigFromEnv } from '../src/dispatch/github-issues';
import { setFrontmatterField } from '../src/dispatch/frontmatter';
import {
  parseLocalIssue, planMigration, executeMigration, computeLinkRewrites,
  type LocalIssue, type ExistingGhIssue,
} from '../src/dispatch/migrate-issues';

const ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return path.resolve(process.env.DOCWRIGHT_ROOT);
  let dir = path.dirname(new URL(import.meta.url).pathname);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'VERSION'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
})();

const execute = process.argv.includes('--execute');
const dryRun = !execute;

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
      if (!n.endsWith('.md')) continue;
      out.push({ path: path.join(rel, n), content: fs.readFileSync(path.join(dir, n), 'utf-8') });
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
  const urlBase = `https://github.com/${cfg.owner}/${cfg.repo}/issues`;

  console.log(`\n${dryRun ? '[DRY-RUN]' : '[EXECUTE]'} migrate issues → ${cfg.owner}/${cfg.repo} (project ${cfg.projectId})\n`);

  const locals = readLocalIssues();
  const existingGh: ExistingGhIssue[] = (await client.listIssues('all'))
    .map(i => ({ number: i.number, nodeId: i.nodeId, title: i.title, labels: i.labels }));
  const board = await client.listProjectItemsDetailed();
  const boardFieldsByNumber = new Map(
    board.filter(i => i.issue).map(i => [i.issue!.number, i.fields] as const),
  );

  const plan = planMigration(locals, existingGh, boardFieldsByNumber);
  console.log(`Local issues: ${locals.length} | existing GH issues: ${existingGh.length} | on board: ${boardFieldsByNumber.size}`);
  console.log(`Plan: ${plan.summary.create} create, ${plan.summary.update} update, ${plan.summary.skip} skip (total ${plan.summary.total})\n`);
  for (const a of plan.actions) {
    console.log(`  ${a.kind.toUpperCase().padEnd(6)} ${a.slug}  — ${a.reason}`);
  }

  const result = await executeMigration(plan, client, { dryRun, repoUrlBase: urlBase });

  if (!dryRun) {
    // Rewrite governance-doc references to migrated issues → stable GH URLs.
    const rewrites = computeLinkRewrites(readGovernanceDocs(), result.map);
    for (const r of rewrites) {
      fs.writeFileSync(path.join(ROOT, r.path), r.content, 'utf-8');
    }
    // Write the github_issue backlink into each local file (reconcile anchor / idempotency).
    for (const issue of locals) {
      const gh = result.map[issue.slug];
      if (!gh) continue;
      const full = path.join(ROOT, issue.path);
      const raw = fs.readFileSync(full, 'utf-8');
      if (!/^github_issue:/m.test(raw.split('\n---')[0] ?? '')) {
        fs.writeFileSync(full, setFrontmatterField(raw, 'github_issue', gh.number), 'utf-8');
      }
    }
    // Record the reversible local-path → gh map.
    fs.writeFileSync(path.join(ROOT, 'issues.migration-map.json'), JSON.stringify(result.map, null, 2) + '\n', 'utf-8');
    console.log(`\nRewrote ${rewrites.length} governance doc(s); wrote issues.migration-map.json`);
  }

  console.log(`\n${dryRun ? 'Would create' : 'Created'} ${result.created}, ${dryRun ? 'update' : 'updated'} ${result.updated}, skipped ${result.skipped}.`);
  if (dryRun) console.log('Re-run with --execute to apply. (Non-destructive — originals are retained until the Step 6 parity gate.)');
}

main().catch(e => { console.error(e); process.exit(1); });
