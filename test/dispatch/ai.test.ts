import assert from 'assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { KeywordEngine, parseSections, stripFrontmatter, getFrontmatterTitle } from '../../src/dispatch/ai';
import type { GatePreReviewResult } from '../../src/dispatch/ai';

function makeVault(docs: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-ai-'));
  for (const [rel, content] of Object.entries(docs)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

describe('AI engine — KeywordEngine', () => {
  it('parseSections splits markdown by headings', () => {
    const body = '## Problem\nsome problem\n\n## Solution\nsome solution\n';
    const sections = parseSections(body);
    assert.strictEqual(sections.length, 2);
    assert.strictEqual(sections[0].heading, 'Problem');
    assert.ok(sections[0].content.includes('some problem'));
    assert.strictEqual(sections[1].heading, 'Solution');
  });

  it('stripFrontmatter removes YAML front matter', () => {
    const raw = '---\ntitle: Test\n---\n## Body\ncontent';
    const body = stripFrontmatter(raw);
    assert.ok(!body.includes('title:'));
    assert.ok(body.includes('## Body'));
  });

  it('getFrontmatterTitle extracts title field', () => {
    assert.strictEqual(getFrontmatterTitle('---\ntitle: My Doc\n---\n'), 'My Doc');
    assert.strictEqual(getFrontmatterTitle('---\ntitle: "Quoted"\n---\n'), 'Quoted');
    assert.strictEqual(getFrontmatterTitle('no frontmatter'), '');
  });

  it('findSimilar returns results above threshold', async () => {
    const root = makeVault({
      'proposals/target.md': '---\ntitle: Rename document\n---\n## Problem\nCannot rename a document in the sidebar\n## Solution\nAdd inline rename to file tree',
      'proposals/related.md': '---\ntitle: File rename UX\n---\n## Problem\nNo way to rename files from the sidebar tree\n## Solution\nDouble-click filename to rename',
      'proposals/unrelated.md': '---\ntitle: Network topology\n---\n## Problem\nIP addressing for the data centre',
    });
    const engine = new KeywordEngine(0.05);
    const results = await engine.findSimilar('proposals/target.md', [
      'proposals/related.md', 'proposals/unrelated.md',
    ], root);
    assert.ok(results.length >= 1, 'should find at least one related doc');
    assert.ok(results[0].score > 0, 'score should be positive');
    // related should score higher than unrelated
    const relatedScore   = results.find(r => r.path === 'proposals/related.md')?.score ?? 0;
    const unrelatedScore = results.find(r => r.path === 'proposals/unrelated.md')?.score ?? 0;
    assert.ok(relatedScore >= unrelatedScore, 'related should score >= unrelated');
    fs.rmSync(root, { recursive: true });
  });

  it('findSimilar excludes the target file itself', async () => {
    const root = makeVault({
      'proposals/a.md': '---\ntitle: A\n---\n## Problem\nfoo bar baz',
      'proposals/b.md': '---\ntitle: B\n---\n## Problem\nfoo bar baz',
    });
    const engine = new KeywordEngine(0.0);
    const results = await engine.findSimilar('proposals/a.md', ['proposals/a.md', 'proposals/b.md'], root);
    assert.ok(!results.some(r => r.path === 'proposals/a.md'), 'should not include target');
    fs.rmSync(root, { recursive: true });
  });
});

describe('KeywordEngine — gatePreReview', () => {
  const engine = new KeywordEngine();

  it('returns ready when no pending steps', async () => {
    const body = '## Steps\n| 1 | Do thing | ✅ |\n| 2 | Do other | ✅ |';
    const result = await engine.gatePreReview('gate-1', 'Plan completion gate', 'Test Plan', body, []);
    assert.equal(result.readiness, 'ready');
    assert.equal(result.concerns.length, 0);
    assert.ok(result.summary.length > 0, 'summary should not be empty');
  });

  it('returns needs-work when pending steps exist', async () => {
    const body = '## Steps\n| 1 | Done | ✅ |\n| 2 | Pending | ⏳ |\n| 3 | Pending | ⏳ |';
    const result = await engine.gatePreReview('gate-1', 'Plan completion gate', 'Test Plan', body, []);
    assert.equal(result.readiness, 'needs-work');
    assert.ok(result.concerns.some(c => c.includes('2')), 'should report count of pending steps');
    assert.ok(result.incomplete_items.length > 0, 'should list incomplete items');
  });

  it('summary includes step counts', async () => {
    const body = '## Steps\n| 1 | Done | ✅ |\n| 2 | Also done | ✅ |\n| 3 | Pending | ⏳ |';
    const result = await engine.gatePreReview('gate-1', 'Gate', 'Doc', body, []);
    assert.ok(result.summary.includes('2'), 'summary should mention completed count');
    assert.ok(result.summary.includes('1'), 'summary should mention pending count');
  });

  it('ignores optional aiPrompt parameter gracefully', async () => {
    const body = '## Steps\n| 1 | Done | ✅ |';
    const result = await engine.gatePreReview(
      'gate-1', 'Gate', 'Doc', body, [],
      'Custom AI prompt that keyword engine ignores'
    );
    assert.equal(result.readiness, 'ready');
  });

  it('scopeDocs parameter does not cause errors', async () => {
    const body = '## Steps\n| 1 | Done | ✅ |';
    const scope = [
      { path: 'proposals/related.md', title: 'Related', excerpt: 'Some related content' },
    ];
    const result = await engine.gatePreReview('gate-1', 'Gate', 'Doc', body, scope);
    assert.ok(result, 'should return a result with scope docs present');
  });

  it('result conforms to GatePreReviewResult interface', async () => {
    const body = '## Steps\n| 1 | Done | ✅ |';
    const result: GatePreReviewResult = await engine.gatePreReview('gate-1', 'Gate', 'Doc', body, []);
    assert.ok(typeof result.summary === 'string');
    assert.ok(Array.isArray(result.concerns));
    assert.ok(Array.isArray(result.incomplete_items));
    assert.ok(['ready', 'needs-work', 'blocked'].includes(result.readiness));
  });
});
