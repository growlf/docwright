/**
 * Step 4 — manager/project separation tests.
 * Verifies that two independent policies/ directories use the same engine
 * with no cross-contamination between their atom sets.
 */
import assert from 'assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildIndex } from '../../src/policy-atoms-core/index-builder.js';
import { route } from '../../src/policy-atoms-core/router.js';
import { syncCheck } from '../../src/policy-atoms-core/sync-checker.js';

function writeAtom(
  policiesDir: string,
  id: string,
  opts: { scope?: string; kind?: string; ai_category?: string } = {},
) {
  const dir = path.join(policiesDir, id);
  fs.mkdirSync(dir, { recursive: true });
  const kind = opts.kind ?? 'deterministic';
  const scope = opts.scope ?? 'plan';
  const ai_cat = opts.ai_category ?? (kind === 'deterministic' ? 'none' : 'reasoning');
  fs.writeFileSync(
    path.join(dir, 'atom.yaml'),
    `id: ${id}\nkind: ${kind}\nscope: [${scope}]\nsynopsis: Synopsis for ${id} in isolation tests.\nversion: 1\nai_category: ${ai_cat}\n`,
    'utf8',
  );
  if (kind === 'deterministic') {
    fs.writeFileSync(path.join(dir, 'check.ts'), `export function check() { return { pass: true, message: 'ok', atom_id: '${id}' }; }\n`, 'utf8');
  } else {
    fs.writeFileSync(
      path.join(dir, 'context.md'),
      `## Rule\nRule text.\n## Rationale\nWhy.\n## Examples\nExample.\n## Scope\n${scope}\n`,
      'utf8',
    );
  }
}

describe('Step 4 / multi-vault isolation', () => {
  let vaultA: string;
  let vaultB: string;

  beforeEach(() => {
    vaultA = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-vault-a-'));
    vaultB = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-vault-b-'));
  });

  afterEach(() => {
    fs.rmSync(vaultA, { recursive: true, force: true });
    fs.rmSync(vaultB, { recursive: true, force: true });
  });

  it('two vaults have completely independent atom sets', () => {
    writeAtom(vaultA, 'vault-a-rule', { scope: 'git-commit' });
    writeAtom(vaultB, 'vault-b-rule', { scope: 'plan' });

    const indexA = buildIndex({ policiesDir: vaultA }).index;
    const indexB = buildIndex({ policiesDir: vaultB }).index;

    assert.strictEqual(indexA.atoms.length, 1);
    assert.strictEqual(indexB.atoms.length, 1);
    assert.strictEqual(indexA.atoms[0].id, 'vault-a-rule');
    assert.strictEqual(indexB.atoms[0].id, 'vault-b-rule');

    // No cross-contamination
    assert.ok(!indexA.atoms.some(a => a.id === 'vault-b-rule'));
    assert.ok(!indexB.atoms.some(a => a.id === 'vault-a-rule'));
  });

  it('router operates independently on each vault\'s index', () => {
    writeAtom(vaultA, 'a-git-rule', { scope: 'git-commit' });
    writeAtom(vaultA, 'a-plan-rule', { scope: 'plan' });
    writeAtom(vaultB, 'b-plan-rule', { scope: 'plan' });

    const indexA = buildIndex({ policiesDir: vaultA }).index;
    const indexB = buildIndex({ policiesDir: vaultB }).index;

    const routeA = route(indexA, 'git-commit');
    const routeB = route(indexB, 'git-commit');

    // Vault A has a git-commit rule; vault B does not
    assert.ok(routeA.atomIds.includes('a-git-rule'));
    assert.strictEqual(routeB.atomIds.length, 0);

    // Plan scope: each vault sees only its own
    const planA = route(indexA, 'plan');
    const planB = route(indexB, 'plan');
    assert.ok(planA.atomIds.includes('a-plan-rule'));
    assert.ok(!planA.atomIds.includes('b-plan-rule'));
    assert.ok(planB.atomIds.includes('b-plan-rule'));
    assert.ok(!planB.atomIds.includes('a-plan-rule'));
  });

  it('sync-checker validates each vault independently', () => {
    writeAtom(vaultA, 'valid-atom');
    // Vault B has an invalid atom (missing check.ts for deterministic)
    fs.mkdirSync(path.join(vaultB, 'invalid-atom'), { recursive: true });
    fs.writeFileSync(
      path.join(vaultB, 'invalid-atom', 'atom.yaml'),
      'id: invalid-atom\nkind: deterministic\nscope: [plan]\nsynopsis: This atom is missing its check file.\nversion: 1\nai_category: none\n',
      'utf8',
    );

    const resultA = syncCheck(vaultA);
    const resultB = syncCheck(vaultB);

    assert.strictEqual(resultA.valid, true, 'vault A should be valid');
    assert.strictEqual(resultB.valid, false, 'vault B should be invalid');
    assert.ok(resultB.issues.some(i => i.atomId === 'invalid-atom'));
    // Vault A's valid state is not affected by vault B's invalid state
    assert.ok(!resultA.issues.some(i => i.atomId === 'invalid-atom'));
  });

  it('a shared DocWright engine builds independent indexes from two policies dirs', () => {
    writeAtom(vaultA, 'shared-id-atom', { scope: 'plan' });
    writeAtom(vaultB, 'shared-id-atom', { scope: 'git-commit' }); // same ID, different scope

    const indexA = buildIndex({ policiesDir: vaultA }).index;
    const indexB = buildIndex({ policiesDir: vaultB }).index;

    // Same engine, different data — scopes are independent even if IDs collide
    assert.strictEqual(indexA.atoms.find(a => a.id === 'shared-id-atom')?.scope[0], 'plan');
    assert.strictEqual(indexB.atoms.find(a => a.id === 'shared-id-atom')?.scope[0], 'git-commit');
  });

  it('non-atom subdirectories in policies/ are skipped in both vaults', () => {
    writeAtom(vaultA, 'real-atom');
    fs.mkdirSync(path.join(vaultA, 'core'), { recursive: true });
    fs.writeFileSync(path.join(vaultA, 'core', 'policy.md'), '# Prose policy', 'utf8');
    writeAtom(vaultB, 'another-atom');
    fs.mkdirSync(path.join(vaultB, 'core'), { recursive: true });

    const indexA = buildIndex({ policiesDir: vaultA }).index;
    const indexB = buildIndex({ policiesDir: vaultB }).index;

    assert.strictEqual(indexA.atoms.length, 1);
    assert.strictEqual(indexB.atoms.length, 1);
    assert.strictEqual(indexA.atoms[0].id, 'real-atom');
    assert.strictEqual(indexB.atoms[0].id, 'another-atom');
  });
});
