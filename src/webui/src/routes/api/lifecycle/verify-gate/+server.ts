import { json } from '@sveltejs/kit';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, setFrontmatterMap } from '../../../../../../dispatch/frontmatter';
import { hasPendingSteps } from '../../../../../../dispatch/completion-gate';
import { buildGateEvidence, GATE_CMD_ALLOWLIST, type LiveEffects } from '../../../../../../dispatch/gate-criteria';
import { requireAuth } from '$lib/server/auth.js';

const REPO = process.env.DOCWRIGHT_ROOT ?? path.resolve(process.cwd(), '../..');
const TEN_MINUTES = 10 * 60 * 1000;

function headCommit(): string {
  const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
}

/**
 * POST /api/lifecycle/verify-gate
 * Body: { plan: "plan-name-without-extension" }
 *
 * The Web UI counterpart of the verify_gate_criteria MCP tool (step 3): runs each
 * machine-verifiable gate criterion and records the result into the plan's gate_evidence map.
 * Shares the dispatch core (buildGateEvidence + GATE_CMD_ALLOWLIST) with the MCP tool, so the
 * two surfaces stay in lock-step. cmd:<name> is restricted to the fixed allowlist.
 */
export const POST = requireAuth(async ({ request }) => {
  const body = await request.json().catch(() => null);
  const planArg: string = (body?.plan ?? '').trim();
  if (!planArg) return json({ error: 'missing plan name' }, { status: 400 });

  const safe = planArg.endsWith('.md') ? planArg : planArg + '.md';
  const planPath = path.join(REPO, 'plans', safe);
  if (!fs.existsSync(planPath)) return json({ error: `Plan '${planArg}' not found in plans/` }, { status: 404 });

  let text = fs.readFileSync(planPath, 'utf-8');
  const fm = parseFrontmatter(text);
  const commit = headCommit();
  const ts = new Date().toISOString();

  const fx: LiveEffects = {
    frontmatter: fm,
    hasPendingSteps: hasPendingSteps(text),
    fileExists: (p) => fs.existsSync(path.join(REPO, p)),
    runCmd: (name) => {
      const script = GATE_CMD_ALLOWLIST[name];
      if (!script) return null;
      const r = spawnSync('npm', ['run', script], {
        cwd: REPO, encoding: 'utf8', timeout: TEN_MINUTES, maxBuffer: 32 * 1024 * 1024,
      });
      return { satisfied: r.status === 0, detail: `cmd:${name} (npm run ${script}) → ${r.status === 0 ? 'pass' : 'fail'}` };
    },
  };
  const existing = fm.gate_evidence && typeof fm.gate_evidence === 'object' && !Array.isArray(fm.gate_evidence)
    ? (fm.gate_evidence as Record<string, any>) : {};

  const { evidence, recorded, warnings } = buildGateEvidence(text, fx, { commit, ts }, existing);

  if (recorded.length > 0) {
    text = setFrontmatterMap(text, 'gate_evidence', evidence);
    fs.writeFileSync(planPath, text);
  }
  return json({ recorded, warnings, commit });
});
