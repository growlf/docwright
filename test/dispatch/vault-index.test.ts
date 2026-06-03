import assert from 'assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { buildIndex, readIndex, writeIndex, parseFrontmatter } from '../../src/dispatch/vault-index';

function makeVault(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-idx-'));
  fs.mkdirSync(path.join(root, 'proposals'));
  fs.mkdirSync(path.join(root, 'plans'));
  fs.writeFileSync(path.join(root, 'proposals', 'alpha.md'),
    '---\ntitle: Alpha\napproved: false\nauthor: Test\ncreated: 2026-01-01\n---\n## Body\n');
  fs.writeFileSync(path.join(root, 'proposals', 'beta.md'),
    '---\ntitle: Beta\napproved: true\nassigned_to: NetYeti\n---\n');
  fs.writeFileSync(path.join(root, 'plans', 'gamma.md'),
    '---\ntitle: Gamma\nstatus: approved\ntags:\n  - engine\n  - test\n---\n');
  return root;
}

describe('Vault index', () => {
  it('parseFrontmatter handles scalars and arrays', () => {
    const raw = '---\ntitle: Test\napproved: true\ntags:\n  - a\n  - b\n---\nbody';
    const fm = parseFrontmatter(raw);
    assert.strictEqual(fm.title, 'Test');
    assert.strictEqual(fm.approved, true);
    assert.deepStrictEqual(fm.tags, ['a', 'b']);
  });

  it('buildIndex finds all markdown files in scan dirs', () => {
    const root = makeVault();
    const index = buildIndex(root);
    const keys = Object.keys(index);
    assert.ok(keys.some(k => k.includes('alpha.md')), 'alpha.md missing');
    assert.ok(keys.some(k => k.includes('beta.md')),  'beta.md missing');
    assert.ok(keys.some(k => k.includes('gamma.md')), 'gamma.md missing');
    fs.rmSync(root, { recursive: true });
  });

  it('buildIndex parses frontmatter correctly', () => {
    const root = makeVault();
    const index = buildIndex(root);
    const alpha = Object.values(index).find(e => e.path.includes('alpha.md'));
    assert.ok(alpha);
    assert.strictEqual(alpha.fm.title, 'Alpha');
    assert.strictEqual(alpha.fm.approved, false);
    const gamma = Object.values(index).find(e => e.path.includes('gamma.md'));
    assert.ok(gamma);
    assert.deepStrictEqual(gamma.fm.tags, ['engine', 'test']);
    fs.rmSync(root, { recursive: true });
  });

  it('writeIndex and readIndex round-trip correctly', () => {
    const root = makeVault();
    const built = buildIndex(root);
    writeIndex(root, built);
    const read = readIndex(root);
    assert.strictEqual(Object.keys(read).length, Object.keys(built).length);
    fs.rmSync(root, { recursive: true });
  });
});
