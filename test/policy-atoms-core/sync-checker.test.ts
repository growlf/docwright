import assert from 'assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { syncCheck } from '../../src/policy-atoms-core/sync-checker.js';

function writeAtomDir(
  base: string,
  id: string,
  opts: {
    kind?: string;
    ai_category?: string;
    scope?: string;
    synopsis?: string;
    withCheck?: boolean;
    withContext?: boolean;
    contextContent?: string;
  } = {},
) {
  const dir = path.join(base, id);
  fs.mkdirSync(dir, { recursive: true });

  const kind = opts.kind ?? 'deterministic';
  const ai_cat = opts.ai_category ?? (kind === 'deterministic' ? 'none' : 'reasoning');
  const scope = opts.scope ?? 'plan';
  const synopsis = opts.synopsis ?? `Synopsis for ${id} which is long enough to pass validation.`;

  fs.writeFileSync(
    path.join(dir, 'atom.yaml'),
    `id: ${id}\nkind: ${kind}\nscope: [${scope}]\nsynopsis: ${synopsis}\nversion: 1\nai_category: ${ai_cat}\n`,
    'utf8',
  );

  if (opts.withCheck ?? kind === 'deterministic') {
    fs.writeFileSync(path.join(dir, 'check.ts'), 'export function check() { return { pass: true, message: "ok", atom_id: "" }; }\n', 'utf8');
  }

  if (opts.withContext ?? kind === 'judgment') {
    const ctx = opts.contextContent ?? '## Rule\nThe rule.\n## Rationale\nWhy.\n## Examples\nExample.\n## Scope\nplan\n';
    fs.writeFileSync(path.join(dir, 'context.md'), ctx, 'utf8');
  }

  return dir;
}

describe('policy-atoms-core / sync-checker', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-sync-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns valid for non-existent policies dir with error', () => {
    const { valid, issues } = syncCheck('/tmp/does-not-exist-xyz-sync');
    assert.strictEqual(valid, false);
    assert.ok(issues.some(i => i.severity === 'error'));
  });

  it('passes a valid deterministic atom', () => {
    writeAtomDir(tmpDir, 'commit-format');
    const { valid, issues } = syncCheck(tmpDir);
    const errors = issues.filter(i => i.severity === 'error');
    assert.strictEqual(errors.length, 0, JSON.stringify(errors));
    assert.strictEqual(valid, true);
  });

  it('passes a valid judgment atom', () => {
    writeAtomDir(tmpDir, 'plan-adequacy', { kind: 'judgment', ai_category: 'reasoning' });
    const { valid, issues } = syncCheck(tmpDir);
    const errors = issues.filter(i => i.severity === 'error');
    assert.strictEqual(errors.length, 0, JSON.stringify(errors));
    assert.strictEqual(valid, true);
  });

  it('errors when deterministic atom is missing check.ts', () => {
    writeAtomDir(tmpDir, 'no-check', { withCheck: false });
    const { valid, issues } = syncCheck(tmpDir);
    assert.strictEqual(valid, false);
    assert.ok(issues.some(i => i.message.includes('missing check.ts')));
  });

  it('warns when deterministic atom is missing context.md', () => {
    writeAtomDir(tmpDir, 'no-context', { withContext: false });
    const { issues } = syncCheck(tmpDir);
    assert.ok(issues.some(i => i.severity === 'warning' && i.message.includes('context.md')));
  });

  it('errors when judgment atom is missing context.md', () => {
    writeAtomDir(tmpDir, 'no-ctx-judgment', { kind: 'judgment', ai_category: 'reasoning', withContext: false });
    const { valid, issues } = syncCheck(tmpDir);
    assert.strictEqual(valid, false);
    assert.ok(issues.some(i => i.message.includes('missing context.md') && i.severity === 'error'));
  });

  it('errors when judgment context.md is missing required sections', () => {
    writeAtomDir(tmpDir, 'incomplete-judgment', {
      kind: 'judgment',
      ai_category: 'reasoning',
      contextContent: '## Rule\nOnly has rule section.\n',
    });
    const { valid, issues } = syncCheck(tmpDir);
    assert.strictEqual(valid, false);
    assert.ok(issues.some(i => i.message.includes('## Rationale')));
    assert.ok(issues.some(i => i.message.includes('## Examples')));
    assert.ok(issues.some(i => i.message.includes('## Scope')));
  });

  it('errors when judgment atom has a check.ts (code not allowed)', () => {
    writeAtomDir(tmpDir, 'judgment-with-code', {
      kind: 'judgment',
      ai_category: 'reasoning',
      withCheck: true,
    });
    const { valid, issues } = syncCheck(tmpDir);
    assert.strictEqual(valid, false);
    assert.ok(issues.some(i => i.message.includes('must not have check.ts')));
  });

  it('errors when atom.yaml is missing', () => {
    fs.mkdirSync(path.join(tmpDir, 'orphan'), { recursive: true });
    const { valid, issues } = syncCheck(tmpDir);
    assert.strictEqual(valid, false);
    assert.ok(issues.some(i => i.message === 'atom.yaml not found'));
  });

  it('reports token count', () => {
    writeAtomDir(tmpDir, 'tok-atom');
    const { tokenCount } = syncCheck(tmpDir);
    assert.ok(typeof tokenCount === 'number');
    assert.ok(tokenCount > 0);
  });

  it('passes an empty policies directory', () => {
    const { valid, issues } = syncCheck(tmpDir);
    assert.strictEqual(valid, true);
    assert.strictEqual(issues.filter(i => i.severity === 'error').length, 0);
  });
});
