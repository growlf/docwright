import assert from 'assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { resolve, nullOrgSourceHook, nullJudgmentDispatchHook } from '../../src/policy-atoms-core/resolver.js';

function writeAtom(dir: string, id: string, extra: Record<string, unknown> = {}) {
  const atomDir = path.join(dir, id);
  fs.mkdirSync(atomDir, { recursive: true });
  const fm = {
    id,
    kind: 'deterministic',
    scope: ['plan'],
    synopsis: `Synopsis for ${id} used in resolver tests.`,
    version: 1,
    ai_category: 'none',
    ...extra,
  };
  const yaml = Object.entries(fm)
    .map(([k, v]) => Array.isArray(v) ? `${k}: [${(v as string[]).join(', ')}]` : `${k}: ${v}`)
    .join('\n');
  fs.writeFileSync(path.join(atomDir, 'atom.yaml'), yaml, 'utf8');
  return atomDir;
}

describe('policy-atoms-core / resolver', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-resolver-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolves a simple atom with no context or check', async () => {
    writeAtom(tmpDir, 'my-atom');
    const { atoms, errors } = await resolve(['my-atom'], { policiesDir: tmpDir });
    assert.strictEqual(errors.length, 0, JSON.stringify(errors));
    assert.strictEqual(atoms.length, 1);
    assert.strictEqual(atoms[0].frontmatter.id, 'my-atom');
    assert.strictEqual(atoms[0].context, undefined);
    assert.strictEqual(atoms[0].check, undefined);
  });

  it('loads context.md when present', async () => {
    const atomDir = writeAtom(tmpDir, 'ctx-atom');
    fs.writeFileSync(path.join(atomDir, 'context.md'), '# Context\nFull rule prose.', 'utf8');
    const { atoms, errors } = await resolve(['ctx-atom'], { policiesDir: tmpDir });
    assert.strictEqual(errors.length, 0);
    assert.ok(atoms[0].context?.includes('Full rule prose'));
  });

  it('loads check.js (compiled) when present', async () => {
    const atomDir = writeAtom(tmpDir, 'check-atom');
    // Resolver loads check.js (compiled artifact); check.ts is the source
    // validated by the sync-checker but not loaded by the resolver directly.
    fs.writeFileSync(path.join(atomDir, 'check.js'),
      `export function check() { return { pass: true, message: 'ok', atom_id: 'check-atom' }; }\n`,
      'utf8',
    );
    const { atoms, errors } = await resolve(['check-atom'], { policiesDir: tmpDir });
    assert.strictEqual(errors.length, 0, JSON.stringify(errors));
    assert.ok(typeof atoms[0].check === 'function');
    const result = await (atoms[0].check as Function)({ frontmatter: {}, filePath: '', content: '', vaultRoot: '' });
    assert.strictEqual(result.pass, true);
  });

  it('has no check when only check.ts exists (not compiled yet)', async () => {
    const atomDir = writeAtom(tmpDir, 'ts-only-atom');
    // check.ts exists (source) but no check.js (not compiled) — resolver skips it
    fs.writeFileSync(path.join(atomDir, 'check.ts'), '// source only\n', 'utf8');
    const { atoms, errors } = await resolve(['ts-only-atom'], { policiesDir: tmpDir });
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(atoms[0].check, undefined);
  });

  it('reports error for missing atom.yaml', async () => {
    fs.mkdirSync(path.join(tmpDir, 'ghost-atom'), { recursive: true });
    const { errors } = await resolve(['ghost-atom'], { policiesDir: tmpDir });
    assert.ok(errors.length > 0);
    assert.ok(errors[0].error.includes('atom.yaml not found'));
  });

  it('resolves multiple atoms', async () => {
    writeAtom(tmpDir, 'atom-a');
    writeAtom(tmpDir, 'atom-b');
    const { atoms, errors } = await resolve(['atom-a', 'atom-b'], { policiesDir: tmpDir });
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(atoms.length, 2);
  });

  it('applies org_source_hook override', async () => {
    writeAtom(tmpDir, 'overridden-atom');
    const hook = async (id: string) => id === 'overridden-atom' ? { version: 99 } : null;
    const { atoms } = await resolve(['overridden-atom'], { policiesDir: tmpDir }, { orgSource: hook });
    assert.strictEqual(atoms[0].frontmatter.version, 99);
  });

  it('null hooks do not affect resolution', async () => {
    writeAtom(tmpDir, 'plain-atom');
    const { atoms, errors } = await resolve(
      ['plain-atom'],
      { policiesDir: tmpDir },
      { orgSource: nullOrgSourceHook, judgmentDispatch: nullJudgmentDispatchHook },
    );
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(atoms[0].frontmatter.id, 'plain-atom');
  });

  it('returns empty arrays for empty id list', async () => {
    const { atoms, errors } = await resolve([], { policiesDir: tmpDir });
    assert.strictEqual(atoms.length, 0);
    assert.strictEqual(errors.length, 0);
  });
});
