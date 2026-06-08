import { json } from '@sveltejs/kit';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO = process.env.DOCWRIGHT_ROOT ?? path.resolve(process.cwd(), '../..');

/**
 * POST /api/lifecycle/run-tests
 * Body: { plan: "plan-name-without-extension" }
 *
 * Detects which test suites are relevant, runs them, and returns results.
 * Sets tests_defined: true in the plan frontmatter if all pass.
 */
export async function POST({ request }) {
  const body = await request.json().catch(() => null);
  const plan: string = (body?.plan ?? '').trim();
  if (!plan) return json({ error: 'missing plan name' }, { status: 400 });

  // Find candidate test files
  const testDirs = [
    path.join(REPO, 'test', 'dispatch'),
    path.join(REPO, 'test', 'hooks'),
    path.join(REPO, 'test', 'mcp'),
  ];

  const suites: { label: string; cmd: string[]; cwd: string }[] = [];

  if (fs.existsSync(path.join(REPO, 'test', 'dispatch'))) {
    const files = fs.readdirSync(path.join(REPO, 'test', 'dispatch'));
    if (files.some(f => f.endsWith('.test.ts'))) {
      suites.push({ label: 'dispatch', cmd: ['npm', 'run', 'test:dispatch'], cwd: REPO });
    }
  }
  if (fs.existsSync(path.join(REPO, 'test', 'hooks'))) {
    suites.push({ label: 'hooks', cmd: ['npm', 'run', 'test:hooks:pending'], cwd: REPO });
    suites.push({ label: 'lifecycle-hook', cmd: ['npm', 'run', 'test:hooks'], cwd: REPO });
  }
  if (fs.existsSync(path.join(REPO, 'test', 'mcp'))) {
    const venv = path.join(REPO, '.venv', 'bin', 'python3');
    if (fs.existsSync(venv)) {
      suites.push({
        label: 'mcp',
        cmd: [venv, 'test/mcp/test-plan-tools.py'],
        cwd: REPO,
      });
    }
  }
  if (fs.existsSync(path.join(REPO, 'test', 'compat'))) {
    const files = fs.readdirSync(path.join(REPO, 'test', 'compat'));
    if (files.some(f => f.endsWith('.test.ts'))) {
      suites.push({ label: 'compat', cmd: ['npm', 'run', 'test:compat'], cwd: REPO });
    }
  }
  if (fs.existsSync(path.join(REPO, 'test', 'integration'))) {
    const files = fs.readdirSync(path.join(REPO, 'test', 'integration'));
    if (files.some(f => f.endsWith('.test.ts'))) {
      suites.push({ label: 'integration', cmd: ['npm', 'run', 'test:integration'], cwd: REPO });
    }
  }

  if (suites.length === 0) {
    return json({
      passed: false,
      blocker: 'No automated test suites found. Write tests first, then run again.',
      output: '',
    });
  }

  // Run each suite
  const results: { label: string; passed: boolean; output: string }[] = [];
  for (const suite of suites) {
    const r = spawnSync(suite.cmd[0], suite.cmd.slice(1), {
      cwd: suite.cwd,
      encoding: 'utf-8',
      env: { ...process.env, DOCWRIGHT_ROOT: REPO },
      timeout: 60_000,
    });
    results.push({
      label: suite.label,
      passed: r.status === 0,
      output: (r.stdout + r.stderr).trim(),
    });
  }

  const allPassed = results.every(r => r.passed);
  const output = results.map(r => `[${r.label}] ${r.passed ? '✅ PASS' : '❌ FAIL'}\n${r.output}`).join('\n\n');

  // Update tests_defined in the plan if all passed
  if (allPassed) {
    const planFile = path.join(REPO, 'plans', plan + '.md');
    if (fs.existsSync(planFile)) {
      const text = fs.readFileSync(planFile, 'utf-8');
      const updated = text.replace(/^tests_defined:\s*false/m, 'tests_defined: true');
      if (updated !== text) fs.writeFileSync(planFile, updated);
    }
  }

  return json({ passed: allPassed, output, results });
}
