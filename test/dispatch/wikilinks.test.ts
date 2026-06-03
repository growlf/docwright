import assert from 'assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { resolveWikilink, findBacklinks, updateWikilinks } from '../../src/dispatch/wikilinks';
import { VaultIndex } from '../../src/dispatch/vault-index';

function makeIndex(entries: Record<string, object>): VaultIndex {
  return Object.fromEntries(
    Object.entries(entries).map(([p, fm]) => [p, { path: p, fm, mtime: 0 }])
  );
}

describe('Wikilink resolver', () => {
  it('resolves [[stem]] to exact path in index', () => {
    const index = makeIndex({
      'proposals/alpha.md': { title: 'Alpha' },
      'plans/beta.md':      { title: 'Beta'  },
    });
    assert.strictEqual(resolveWikilink('[[alpha]]', 'plans/beta.md', index), 'proposals/alpha.md');
    assert.strictEqual(resolveWikilink('[[beta]]',  'proposals/alpha.md', index), 'plans/beta.md');
  });

  it('resolves [[stem#anchor]] stripping the anchor', () => {
    const index = makeIndex({ 'docs/guide.md': { title: 'Guide' } });
    assert.strictEqual(resolveWikilink('[[guide#section-1]]', 'proposals/a.md', index), 'docs/guide.md');
  });

  it('resolves [[stem|alias]] stripping the alias', () => {
    const index = makeIndex({ 'docs/guide.md': { title: 'Guide' } });
    assert.strictEqual(resolveWikilink('[[guide|read the guide]]', 'proposals/a.md', index), 'docs/guide.md');
  });

  it('returns null for unknown wikilink', () => {
    const index = makeIndex({ 'proposals/alpha.md': { title: 'Alpha' } });
    assert.strictEqual(resolveWikilink('[[nonexistent]]', 'any.md', index), null);
  });

  it('findBacklinks finds files referencing the target', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-wl-'));
    fs.mkdirSync(path.join(root, 'proposals'));
    fs.writeFileSync(path.join(root, 'proposals', 'a.md'), '---\ntitle: A\n---\nSee [[target]] for details');
    fs.writeFileSync(path.join(root, 'proposals', 'b.md'), '---\ntitle: B\n---\nNo references here');
    const index = makeIndex({
      'proposals/a.md': { title: 'A' },
      'proposals/b.md': { title: 'B' },
    });
    const links = findBacklinks('proposals/target.md', root, index);
    assert.ok(links.includes('proposals/a.md'), 'a.md should be a backlink');
    assert.ok(!links.includes('proposals/b.md'), 'b.md should not be a backlink');
    fs.rmSync(root, { recursive: true });
  });

  it('updateWikilinks rewrites [[old]] to [[new]] in place', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-wl2-'));
    fs.mkdirSync(path.join(root, 'proposals'));
    fs.writeFileSync(path.join(root, 'proposals', 'referrer.md'),
      '---\ntitle: R\n---\nSee [[old-name]] and also [[old-name|alias]]');
    const index = makeIndex({ 'proposals/referrer.md': { title: 'R' } });
    const updated = updateWikilinks(root, 'proposals/old-name.md', 'proposals/new-name.md', index);
    assert.ok(updated.includes('proposals/referrer.md'));
    const content = fs.readFileSync(path.join(root, 'proposals', 'referrer.md'), 'utf-8');
    assert.ok(content.includes('[[new-name]]'), 'should contain [[new-name]]');
    assert.ok(content.includes('[[new-name|alias]]'), 'should preserve alias');
    assert.ok(!content.includes('[[old-name]]'), 'should not contain [[old-name]]');
    fs.rmSync(root, { recursive: true });
  });
});
