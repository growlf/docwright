import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  parseVersion, nextPhaseVersion, isAtOrBeyond,
  findPhasePlans, phaseReadiness, closePhase,
} from '../../src/dispatch/phase-close-core';

// #15/#17 — shared phase-close core, used by both the CLI and /api/phase/close.
function makeVault(opts: {
  version: string;
  completed?: Record<string, string>;  // basename → status/phase content
  pending?: Record<string, string>;
}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-pc-'));
  fs.writeFileSync(path.join(root, 'VERSION'), opts.version + '\n');
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'x', version: opts.version }, null, 2) + '\n');
  fs.mkdirSync(path.join(root, 'src', 'webui'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'webui', 'package.json'), JSON.stringify({ name: 'x-webui', version: opts.version }, null, 2) + '\n');
  fs.mkdirSync(path.join(root, 'plans', 'completed'), { recursive: true });
  for (const [f, body] of Object.entries(opts.completed ?? {})) fs.writeFileSync(path.join(root, 'plans', 'completed', f), body);
  for (const [f, body] of Object.entries(opts.pending ?? {})) fs.writeFileSync(path.join(root, 'plans', f), body);
  return root;
}
const completedPlan = (phase: number) => `---\ntitle: P\nstatus: completed\nphase: ${phase}\n---\nbody\n`;
const pendingPlan = (phase: number) => `---\ntitle: P\nstatus: in-progress\nphase: ${phase}\n---\nbody\n`;

describe('phase-close-core — version math', () => {
  it('nextPhaseVersion bumps the minor', () => {
    assert.strictEqual(nextPhaseVersion(4), '0.5.0');
    assert.strictEqual(nextPhaseVersion(5), '0.6.0');
  });
  it('isAtOrBeyond compares semver', () => {
    assert.strictEqual(isAtOrBeyond('0.5.0', '0.5.0'), true);
    assert.strictEqual(isAtOrBeyond('0.5.1', '0.5.0'), true);
    assert.strictEqual(isAtOrBeyond('0.4.9', '0.5.0'), false);
    assert.strictEqual(isAtOrBeyond('0.6.0', '0.5.0'), true);
  });
  it('parseVersion strips a leading v', () => {
    assert.deepStrictEqual(parseVersion('v0.5.1'), [0, 5, 1]);
  });
});

describe('phase-close-core — readiness & findPhasePlans', () => {
  it('finds completed phase plans by frontmatter and legacy prefix', () => {
    const root = makeVault({ version: '0.5.0', completed: {
      'ai-thing.md': completedPlan(5),
      'phase-5-overview.md': `---\nstatus: completed\n---\n`,  // legacy prefix, no phase field
      'other.md': completedPlan(4),
    }});
    const found = findPhasePlans(5, path.join(root, 'plans', 'completed'));
    assert.deepStrictEqual(found.sort(), ['ai-thing.md', 'phase-5-overview.md']);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('phaseReadiness: not ready while a phase plan is still pending', () => {
    const root = makeVault({ version: '0.5.0', completed: { 'done.md': completedPlan(5) }, pending: { 'wip.md': pendingPlan(5) } });
    const r = phaseReadiness(root, 5);
    assert.strictEqual(r.ready, false);
    assert.deepStrictEqual(r.pending, ['wip.md']);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('phaseReadiness: ready when all phase plans are completed', () => {
    const root = makeVault({ version: '0.5.0', completed: { 'done.md': completedPlan(5) } });
    assert.strictEqual(phaseReadiness(root, 5).ready, true);
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe('phase-close-core — closePhase', () => {
  it('refuses a phase with no completed plans', () => {
    const root = makeVault({ version: '0.5.0' });
    const r = closePhase(root, 5);
    assert.strictEqual(r.ok, false);
    assert.match(r.reason!, /No completed Phase 5 plans/);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('refuses a phase with a pending plan', () => {
    const root = makeVault({ version: '0.5.0', completed: { 'done.md': completedPlan(5) }, pending: { 'wip.md': pendingPlan(5) } });
    const r = closePhase(root, 5);
    assert.strictEqual(r.ok, false);
    assert.match(r.reason!, /still open/);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('bumps all three version files and never tags/pushes', () => {
    const root = makeVault({ version: '0.5.0', completed: { 'done.md': completedPlan(5) } });
    const r = closePhase(root, 5);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.version, '0.6.0');
    assert.deepStrictEqual(r.changed, ['VERSION', 'package.json', 'src/webui/package.json']);
    assert.strictEqual(fs.readFileSync(path.join(root, 'VERSION'), 'utf-8').trim(), '0.6.0');
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')).version, '0.6.0');
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(root, 'src', 'webui', 'package.json'), 'utf-8')).version, '0.6.0');
    assert.ok(r.tagCommand!.includes('git tag v0.6.0'), 'surfaces the tag command, does not run it');
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('is idempotent — refuses when already at/beyond target', () => {
    const root = makeVault({ version: '0.6.0', completed: { 'done.md': completedPlan(5) } });
    const r = closePhase(root, 5);
    assert.strictEqual(r.ok, false);
    assert.match(r.reason!, /already at or beyond/);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
