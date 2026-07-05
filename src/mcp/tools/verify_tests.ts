import { readFile, writeFile, getRepoRoot } from '../lib/paths';
import { setFrontmatterField } from '../lib/frontmatter';
import { uncheckedTestingPlanBoxes } from '../lib/steps';
import { appendHistory } from './mutation';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';

export interface TestRunResult {
  ok: boolean;
  /** Last ~40 lines of combined output, for the tool response. */
  outputTail: string;
}

export type TestRunner = (script: string, cwd: string) => TestRunResult;

const SCRIPT_NAME_RE = /^[A-Za-z0-9:._-]{1,64}$/;
const TEN_MINUTES = 10 * 60 * 1000;

function defaultRunner(script: string, cwd: string): TestRunResult {
  const args = script === 'test' ? ['test'] : ['run', script];
  const result = spawnSync('npm', args, {
    cwd,
    encoding: 'utf8',
    timeout: TEN_MINUTES,
    maxBuffer: 32 * 1024 * 1024,
  });
  const combined = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return {
    ok: result.status === 0,
    outputTail: combined.trim().split('\n').slice(-40).join('\n'),
  };
}

function headCommit(cwd: string): string {
  const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

/**
 * Run a package.json-defined npm script against the repo and record the result
 * on the plan (tests_last_run / tests_last_result / tests_last_commit + a
 * Document History row). This recorded evidence is what the completion gate
 * checks — a plan cannot reach completed without a green run stamped here.
 *
 * Security: only script names that exist in package.json `scripts` are
 * runnable — this is not an arbitrary-command endpoint.
 */
export async function verifyPlanTests(
  planName: string,
  script: string = 'test',
  runner: TestRunner = defaultRunner,
): Promise<string> {
  const safe = planName.endsWith('.md') ? planName : `${planName}.md`;

  let text: string;
  try {
    text = readFile(`plans/${safe}`);
  } catch {
    return `ERROR: Plan '${planName}' not found in plans/.`;
  }

  if (!SCRIPT_NAME_RE.test(script)) {
    return `ERROR: invalid script name '${script}'. Only package.json script names are allowed (letters, digits, ':._-').`;
  }

  const root = getRepoRoot();
  if (!root) return 'ERROR: repo root not set.';

  let scripts: Record<string, string> = {};
  try {
    scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts ?? {};
  } catch {
    return 'ERROR: could not read package.json to validate the script name.';
  }
  if (!scripts[script]) {
    return `ERROR: '${script}' is not a script in package.json. Available: ${Object.keys(scripts).sort().join(', ')}`;
  }

  const run = runner(script, root);
  const stamp = new Date().toISOString();
  const commit = headCommit(root);
  const verdict = run.ok ? 'pass' : 'fail';

  text = setFrontmatterField(text, 'tests_last_run', stamp);
  text = setFrontmatterField(text, 'tests_last_result', verdict);
  text = setFrontmatterField(text, 'tests_last_commit', commit);
  writeFile(`plans/${safe}`, text);

  await appendHistory(
    safe,
    `Test run recorded via verify_plan_tests: npm ${script === 'test' ? 'test' : `run ${script}`} → ${verdict.toUpperCase()}${commit ? ` @ ${commit}` : ''}`,
  );

  const openBoxes = uncheckedTestingPlanBoxes(readFile(`plans/${safe}`));
  const boxNote = openBoxes.length
    ? `\n⚠ ${openBoxes.length} Testing Plan box${openBoxes.length === 1 ? '' : 'es'} still unchecked — the completion gate will refuse until each is verified [x].`
    : '';

  if (!run.ok) {
    return `❌ Tests FAILED (npm ${script === 'test' ? 'test' : `run ${script}`}). Recorded tests_last_result: fail${commit ? ` @ ${commit}` : ''} — the completion gate will refuse this plan.\n\nOutput tail:\n${run.outputTail}${boxNote}`;
  }
  return `✅ Tests passed (npm ${script === 'test' ? 'test' : `run ${script}`}). Recorded tests_last_result: pass @ ${stamp}${commit ? `, commit ${commit}` : ''}.${boxNote}`;
}
