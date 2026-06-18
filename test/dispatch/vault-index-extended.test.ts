import assert from 'assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  buildIndex,
  readIndex,
  writeIndex,
  rebuildIfStale,
  getDocument,
  getDocumentEdges,
  getBacklinksFor,
  queryDocuments,
  getAllEdges,
  inferDocType,
} from '../../src/dispatch/vault-index';

function makeVault(docs: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-vi-'));
  for (const [rel, content] of Object.entries(docs)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

describe('vault-index (extended)', () => {

  describe('buildIndex', () => {
    it('indexes files in all scan dirs', () => {
      const root = makeVault({
        'proposals/foo.md': '---\ntitle: Foo\n---\n',
        'plans/bar.md':     '---\ntitle: Bar\nstatus: in-progress\n---\n',
        'docs/baz.md':      '---\ntitle: Baz\n---\n',
      });
      const idx = buildIndex(root);
      assert.ok(idx['proposals/foo.md'], 'proposal indexed');
      assert.ok(idx['plans/bar.md'],     'plan indexed');
      assert.ok(idx['docs/baz.md'],      'doc indexed');
    });

    it('populates contentHash for each entry', () => {
      const root = makeVault({ 'proposals/foo.md': '---\ntitle: Foo\n---\n' });
      const idx = buildIndex(root);
      const entry = idx['proposals/foo.md'];
      assert.ok(entry.contentHash, 'contentHash should be set');
      assert.equal(entry.contentHash.length, 16, 'sha256 slice is 16 chars');
    });

    it('extracts wikilink edges from document body', () => {
      const root = makeVault({
        'proposals/foo.md': '---\ntitle: Foo\n---\nSee [[bar]] and [[baz#section|Baz]] for context.\n',
      });
      const idx = buildIndex(root);
      const edges = idx['proposals/foo.md'].edges.filter(e => e.type === 'wikilink');
      const targets = edges.map(e => e.target);
      assert.ok(targets.includes('bar'), 'should find [[bar]]');
      assert.ok(targets.includes('baz'), 'should find [[baz#section|Baz]] stem');
    });

    it('extracts frontmatter cross-ref edges', () => {
      const root = makeVault({
        'plans/bar.md': '---\ntitle: Bar\nproposal_source: proposals/foo.md\nrelated_to:\n  - proposals/other.md\n---\n',
      });
      const idx = buildIndex(root);
      const edges = idx['plans/bar.md'].edges;
      assert.ok(edges.some(e => e.type === 'proposal_source' && e.target === 'proposals/foo.md'));
      assert.ok(edges.some(e => e.type === 'related_to' && e.target === 'proposals/other.md'));
    });

    it('does not duplicate the same wikilink target', () => {
      const root = makeVault({
        'proposals/foo.md': '---\ntitle: Foo\n---\n[[bar]] and [[bar]] again.\n',
      });
      const idx = buildIndex(root);
      const wl = idx['proposals/foo.md'].edges.filter(e => e.type === 'wikilink' && e.target === 'bar');
      assert.equal(wl.length, 1, 'duplicate wikilinks should be deduped');
    });
  });

  describe('inferDocType', () => {
    it('returns proposal for proposals/', () => assert.equal(inferDocType('proposals/foo.md'), 'proposal'));
    it('returns plan for plans/',         () => assert.equal(inferDocType('plans/bar.md'),     'plan'));
    it('returns doc for docs/',           () => assert.equal(inferDocType('docs/baz.md'),      'doc'));
    it('returns policy for policies/',    () => assert.equal(inferDocType('policies/p.md'),   'policy'));
    it('returns research for research/',  () => assert.equal(inferDocType('research/r.md'),   'research'));
  });

  describe('persistence', () => {
    it('writeIndex + readIndex round-trips correctly', () => {
      const root = makeVault({ 'proposals/foo.md': '---\ntitle: Foo\n---\n' });
      const idx = buildIndex(root);
      writeIndex(root, idx);
      const loaded = readIndex(root);
      assert.deepEqual(Object.keys(loaded), Object.keys(idx));
      assert.equal(loaded['proposals/foo.md'].fm.title, 'Foo');
    });

    it('rebuildIfStale detects a changed file', () => {
      const root = makeVault({ 'proposals/foo.md': '---\ntitle: Foo\n---\n' });
      const idx = buildIndex(root);
      writeIndex(root, idx);
      // Touch the file to update mtime
      const abs = path.join(root, 'proposals/foo.md');
      fs.writeFileSync(abs, '---\ntitle: Foo Updated\n---\n');
      const rebuilt = rebuildIfStale(root);
      assert.equal(rebuilt['proposals/foo.md'].fm.title, 'Foo Updated');
    });

    it('rebuildIfStale detects a new file', () => {
      const root = makeVault({ 'proposals/foo.md': '---\ntitle: Foo\n---\n' });
      const idx = buildIndex(root);
      writeIndex(root, idx);
      fs.writeFileSync(path.join(root, 'proposals/bar.md'), '---\ntitle: Bar\n---\n');
      const rebuilt = rebuildIfStale(root);
      assert.ok(rebuilt['proposals/bar.md'], 'new file should appear in index');
    });
  });

  describe('query API', () => {
    let root: string;
    let idx: ReturnType<typeof buildIndex>;

    before(() => {
      root = makeVault({
        'proposals/alpha.md':          '---\ntitle: Alpha\napproved: false\ntags:\n  - ux\n  - sidebar\nphase: 1\nauthor: NetYeti\n---\n',
        'proposals/approved/beta.md':  '---\ntitle: Beta\napproved: true\ntags:\n  - api\nphase: 2\nauthor: NetYeti\n---\n',
        'plans/gamma.md':              '---\ntitle: Gamma\nstatus: in-progress\ntags:\n  - ux\nphase: 1\nauthor: Alice\n---\n',
        'plans/completed/delta.md':    '---\ntitle: Delta\nstatus: completed\ntags:\n  - api\nphase: 2\nauthor: Alice\n---\n',
      });
      idx = buildIndex(root);
    });

    it('getDocument finds by exact path', () => {
      const e = getDocument(idx, 'proposals/alpha.md');
      assert.ok(e, 'should find by path');
      assert.equal(e!.fm.title, 'Alpha');
    });

    it('getDocument finds by slug', () => {
      const e = getDocument(idx, 'alpha');
      assert.ok(e, 'should find by slug');
      assert.equal(e!.fm.title, 'Alpha');
    });

    it('getDocument returns null for unknown', () => {
      assert.equal(getDocument(idx, 'does-not-exist'), null);
    });

    it('getDocumentEdges returns edges for a doc', () => {
      const root2 = makeVault({
        'proposals/foo.md': '---\ntitle: Foo\nrelated_to:\n  - plans/bar.md\n---\nSee [[baz]] too.\n',
        'plans/bar.md':     '---\ntitle: Bar\n---\n',
      });
      const i = buildIndex(root2);
      const edges = getDocumentEdges(i, 'proposals/foo.md');
      assert.ok(edges.some(e => e.type === 'related_to'), 'should have related_to edge');
      assert.ok(edges.some(e => e.type === 'wikilink' && e.target === 'baz'), 'should have wikilink edge');
    });

    it('getBacklinksFor finds all docs pointing to a target', () => {
      const root2 = makeVault({
        'proposals/foo.md': '---\ntitle: Foo\nrelated_to:\n  - plans/bar.md\n---\n',
        'docs/ref.md':      '---\ntitle: Ref\n---\nSee [[bar]] here.\n',
        'plans/bar.md':     '---\ntitle: Bar\n---\n',
      });
      const i = buildIndex(root2);
      const backrefs = getBacklinksFor(i, 'plans/bar.md');
      const paths = backrefs.map(e => e.path);
      assert.ok(paths.includes('proposals/foo.md'), 'related_to backlink');
      assert.ok(paths.includes('docs/ref.md'), 'wikilink [[bar]] backlink');
    });

    it('queryDocuments filters by docType (inferred)', () => {
      const plans = queryDocuments(idx, { docType: 'plan' });
      assert.ok(plans.every(e => e.path.startsWith('plans/')));
      assert.ok(plans.length >= 2);
    });

    it('queryDocuments filters by status', () => {
      const completed = queryDocuments(idx, { status: 'completed' });
      assert.ok(completed.length >= 1);
      assert.ok(completed.every(e => e.fm.status === 'completed'));
    });

    it('queryDocuments filters by phase', () => {
      const phase1 = queryDocuments(idx, { phase: 1 });
      assert.ok(phase1.length >= 2);
      assert.ok(phase1.every(e => String(e.fm.phase) === '1'));
    });

    it('queryDocuments filters by tag', () => {
      const ux = queryDocuments(idx, { tags: 'ux' });
      assert.ok(ux.length >= 2);
      assert.ok(ux.every(e => {
        const tags = Array.isArray(e.fm.tags) ? e.fm.tags : [];
        return tags.includes('ux');
      }));
    });

    it('queryDocuments filters by author', () => {
      const alice = queryDocuments(idx, { author: 'Alice' });
      assert.ok(alice.every(e => e.fm.author === 'Alice'));
    });

    it('getAllEdges returns edges from all documents', () => {
      const root2 = makeVault({
        'proposals/a.md': '---\ntitle: A\nrelated_to:\n  - proposals/b.md\n---\n',
        'proposals/b.md': '---\ntitle: B\n---\nSee [[a]] here.\n',
      });
      const i = buildIndex(root2);
      const edges = getAllEdges(i);
      assert.ok(edges.length >= 2, 'should have at least the related_to and wikilink edges');
    });
  });

});
