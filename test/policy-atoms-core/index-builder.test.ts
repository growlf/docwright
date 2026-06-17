import assert from 'assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildIndex } from '../../src/policy-atoms-core/index-builder.js';

function makeAtom(dir: string, id: string, overrides: Record<string, unknown> = {}) {
  fs.mkdirSync(path.join(dir, id), { recursive: true });
  const fm = {
    id,
    kind: 'deterministic',
    scope: ['git-commit'],
    synopsis: `${id} synopsis for testing the index builder.`,
    version: 1,
    ai_category: 'none',
    ...overrides,
  };
  const yaml = Object.entries(fm)
    .map(([k, v]) => Array.isArray(v) ? `${k}: [${(v as string[]).join(', ')}]` : `${k}: ${v}`)
    .join('\n');
  fs.writeFileSync(path.join(dir, id, 'atom.yaml'), yaml, 'utf8');
}

describe('policy-atoms-core / index-builder', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-atoms-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty index for empty policies dir', () => {
    const { index, errors } = buildIndex({ policiesDir: tmpDir });
    assert.strictEqual(index.atoms.length, 0);
    assert.strictEqual(errors.length, 0);
  });

  it('returns error for non-existent directory', () => {
    const { errors } = buildIndex({ policiesDir: '/tmp/does-not-exist-xyz' });
    assert.ok(errors.length > 0);
  });

  it('builds index from valid atoms', () => {
    makeAtom(tmpDir, 'commit-format');
    makeAtom(tmpDir, 'frontmatter-validate', { scope: '[proposal, plan]', kind: 'deterministic', ai_category: 'none' });
    const { index, errors } = buildIndex({ policiesDir: tmpDir });
    assert.strictEqual(errors.length, 0, JSON.stringify(errors));
    assert.strictEqual(index.atoms.length, 2);
    assert.ok(index.atoms.some(a => a.id === 'commit-format'));
    assert.ok(index.atoms.some(a => a.id === 'frontmatter-validate'));
  });

  it('silently skips directories without atom.yaml (non-atom dirs)', () => {
    // e.g. policies/core/ for prose docs — should not cause errors
    fs.mkdirSync(path.join(tmpDir, 'core'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'core', 'some-policy.md'), '# Policy', 'utf8');
    const { index, errors } = buildIndex({ policiesDir: tmpDir });
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(index.atoms.length, 0);
  });

  it('records error for invalid atom frontmatter', () => {
    makeAtom(tmpDir, 'bad-atom', { id: 'BadID' }); // invalid id format
    const { errors } = buildIndex({ policiesDir: tmpDir });
    assert.ok(errors.length > 0);
  });

  it('includes token_count in index', () => {
    makeAtom(tmpDir, 'commit-format');
    const { index } = buildIndex({ policiesDir: tmpDir });
    assert.ok(typeof index.token_count === 'number');
    assert.ok(index.token_count > 0);
  });
});
