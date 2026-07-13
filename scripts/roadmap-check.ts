#!/usr/bin/env tsx
/**
 * roadmap-check.ts — the DocWright enforcer for roadmap date discipline
 * ([[plans/roadmap-date-discipline]], step 3). Fetches the GH board (Project items +
 * milestones), runs the pure validator, and reports violations.
 *
 *   npm run roadmap:check            # WARN mode — reports, exits 0
 *   npm run roadmap:check -- --strict   # hard-fail — exits 1 on any DATA violation (CI default)
 *
 * GH unconfigured or unreachable → degrades to a clean pass (never hard-errors a build on
 * a transient fetch failure), even under --strict. Only data violations (dateless milestone /
 * out-of-range issue) block. Requires DOCWRIGHT_GH_REPO / TOKEN / PROJECT_ID to enforce.
 */
import { GitHubClient, githubConfigFromEnv } from '../src/dispatch/github-issues';
import { roadmapDataFromBoard, auditRoadmapDates } from '../src/dispatch/roadmap-dates';

const strict = process.argv.includes('--strict');

async function main() {
  const cfg = githubConfigFromEnv();
  if (!cfg) {
    console.error('roadmap:check — GitHub not configured (set DOCWRIGHT_GH_REPO/TOKEN/PROJECT_ID). Skipping.');
    process.exit(0);
  }
  const client = new GitHubClient(cfg);
  const [items, milestones] = await Promise.all([
    client.listProjectItemsDetailed(),
    client.listMilestones('all'),
  ]);
  const data = roadmapDataFromBoard(items, milestones);
  const { ok, violations } = auditRoadmapDates(data);

  console.log(`\nRoadmap date check — ${milestones.length} milestone(s), ${data.issues.length} board issue(s)`);
  if (ok) {
    console.log('✅ no violations.');
    process.exit(0);
  }
  for (const v of violations) console.log(`  ${strict ? '❌' : '⚠️ '} [${v.kind}] ${v.subject}: ${v.detail}`);
  console.log(`\n${violations.length} violation(s). ${strict ? 'STRICT → failing the build.' : 'Warn mode (rollout) — not blocking.'}`);
  process.exit(strict ? 1 : 0);
}

// A fetch/reachability failure is NOT a roadmap violation — degrade to a pass even under
// --strict so a transient GitHub outage never false-fails an unrelated PR. Only actual
// data violations (dateless milestone / out-of-range issue) block the build.
main().catch(e => {
  console.error(`roadmap:check — could not reach GitHub (${e?.message ?? e}); degrading to a pass (transient/config issue, not a roadmap violation).`);
  process.exit(0);
});
