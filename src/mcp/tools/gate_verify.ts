import { readFile, writeFile, getRepoRoot } from '../lib/paths';
import { setFrontmatterMap, parseFrontmatter } from '../lib/frontmatter';
import { hasPendingSteps } from '../lib/steps';
import { buildGateEvidence, GATE_CMD_ALLOWLIST, type LiveEffects } from '../../dispatch/gate-criteria';
import { appendHistory } from './mutation';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * verify_gate_criteria — the agent verify-and-record path for evidence-backed completion (step 3).
 * For each MACHINE-bound gate criterion, run its check and record the result into the plan's
 * `gate_evidence` map (keyed by criterion id, with commit + timestamp). checkCompletionGate reads
 * that recorded evidence for `cmd:`/`file_exists:` criteria (it is pure and cannot run them itself).
 *
 * Security: `cmd:<name>` is not arbitrary — only names in GATE_CMD_ALLOWLIST run, mapped to
 * package.json scripts. Everything else records satisfied:false without executing.
 */

const TEN_MINUTES = 10 * 60 * 1000;

export type CmdRunner = (name: string) => { satisfied: boolean; detail: string } | null;

function defaultCmdRunner(root: string): CmdRunner {
  return (name) => {
    const script = GATE_CMD_ALLOWLIST[name];
    if (!script) return null; // not allowed — never executes
    const r = spawnSync('npm', ['run', script], {
      cwd: root, encoding: 'utf8', timeout: TEN_MINUTES, maxBuffer: 32 * 1024 * 1024,
    });
    return { satisfied: r.status === 0, detail: `cmd:${name} (npm run ${script}) → ${r.status === 0 ? 'pass' : 'fail'}` };
  };
}

function headCommit(root: string): string {
  const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
}

export interface GateVerifyOptions {
  runCmd?: CmdRunner;
  fileExists?: (absPath: string) => boolean;
  now?: () => string;
}

export async function verifyGateCriteria(planName: string, opts: GateVerifyOptions = {}): Promise<string> {
  const safe = planName.endsWith('.md') ? planName : `${planName}.md`;

  let text: string;
  try {
    text = readFile(`plans/${safe}`);
  } catch {
    return `ERROR: Plan '${planName}' not found in plans/.`;
  }
  const root = getRepoRoot();
  if (!root) return 'ERROR: repo root not set.';

  const commit = headCommit(root);
  const ts = opts.now ? opts.now() : new Date().toISOString();
  const runCmd = opts.runCmd ?? defaultCmdRunner(root);
  const fileExists = opts.fileExists ?? ((abs: string) => fs.existsSync(abs));

  const fm = parseFrontmatter(text);
  const fx: LiveEffects = {
    frontmatter: fm,
    hasPendingSteps: hasPendingSteps(text),
    fileExists: (p) => fileExists(path.join(root, p)),
    runCmd,
  };
  const existing = fm.gate_evidence && typeof fm.gate_evidence === 'object' && !Array.isArray(fm.gate_evidence)
    ? (fm.gate_evidence as Record<string, any>) : {};

  const { evidence, recorded, warnings } = buildGateEvidence(text, fx, { commit, ts }, existing);

  if (recorded.length === 0) {
    const warnBlock = warnings.length ? `\n${warnings.map((w) => '• ' + w).join('\n')}` : '';
    return `No machine-verifiable gate criteria recorded on '${planName}' (only human/unbound criteria present).${warnBlock}`;
  }

  text = setFrontmatterMap(text, 'gate_evidence', evidence);
  writeFile(`plans/${safe}`, text);
  const summary = recorded.map((r) => `${r.satisfied ? '✅' : '❌'} (${r.id}) ${r.raw} — ${r.detail}`);
  await appendHistory(safe, `Gate evidence recorded via verify_gate_criteria${commit ? ` @ ${commit}` : ''}: ${summary.join('; ')}`);

  const warnBlock = warnings.length ? `\n\n⚠ Skipped:\n${warnings.map((w) => '• ' + w).join('\n')}` : '';
  return `Recorded gate evidence for '${planName}' (${recorded.length} criteri${recorded.length === 1 ? 'on' : 'a'})${commit ? ` @ ${commit}` : ''}:\n${summary.map((s) => '  ' + s).join('\n')}${warnBlock}`;
}
