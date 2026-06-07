import assert from 'assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { KeywordEngine, OpenCodeEngine, parseSections, stripFrontmatter, getFrontmatterTitle } from '../../src/dispatch/ai';
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

describe('KeywordEngine — fillProposal and critiqueDocument', () => {
  const engine = new KeywordEngine();

  it('fillProposal returns body with offline stub appended', async () => {
    const result = await engine.fillProposal({ title: 'My Proposal' }, '## Problem\nsome content');
    assert.ok(result.includes('## Problem'), 'should include original body');
    assert.ok(result.includes('unavailable'), 'should indicate AI is unavailable');
  });

  it('critiqueDocument returns stub message', async () => {
    const result = await engine.critiqueDocument('## Problem\nsome content');
    assert.ok(typeof result === 'string', 'should return a string');
    assert.ok(result.includes('unavailable'), 'should indicate AI is unavailable');
  });
});

// callSession makes two sequential fetches: (1) POST /session → {id}, (2) POST /session/{id}/message → {parts}
// This helper mocks both calls in sequence.
function mockCallSession(responseText: string, opts?: { failOn?: 'session' | 'message' | 'network' }) {
  let callCount = 0;
  globalThis.fetch = async (url: any, fetchOpts: any) => {
    callCount++;
    if (opts?.failOn === 'network') throw new Error('ECONNREFUSED');
    if (callCount === 1) {
      // Session create
      if (opts?.failOn === 'session') return new Response('error', { status: 500 });
      return new Response(JSON.stringify({ id: 'ses_test123' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    // Message send
    if (opts?.failOn === 'message') return new Response('error', { status: 500 });
    return new Response(JSON.stringify({
      parts: [{ type: 'step-start' }, { type: 'text', text: responseText }, { type: 'step-finish' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  return { getCallCount: () => callCount };
}

describe('OpenCodeEngine — fillProposal and critiqueDocument', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('fillProposal returns the LLM response text on success', async () => {
    mockCallSession('## Problem\nAI improved content here.');
    const engine = new OpenCodeEngine('http://localhost:4096');
    const result = await engine.fillProposal({ title: 'My Proposal', tags: ['ui'] }, '## Problem\noriginal');
    assert.ok(result.includes('AI improved content'), 'should return the LLM text');
  });

  it('fillProposal sends a prompt containing the body in the message call', async () => {
    let capturedMessageBody = '';
    let callCount = 0;
    globalThis.fetch = async (_url: any, opts: any) => {
      callCount++;
      if (callCount === 1) return new Response(JSON.stringify({ id: 'ses_test' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      capturedMessageBody = opts.body;
      return new Response(JSON.stringify({ parts: [{ type: 'text', text: 'ok' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const engine = new OpenCodeEngine('http://localhost:4096');
    await engine.fillProposal({ title: 'T', tags: [] }, '## Section\noriginal body content');
    const parsed = JSON.parse(capturedMessageBody);
    const promptText = parsed.parts[0].text;
    assert.ok(promptText.includes('original body content'), 'prompt should contain the body');
    assert.ok(promptText.includes('governance document assistant'), 'prompt should set the AI role');
  });

  it('fillProposal falls back to KeywordEngine stub on session create error', async () => {
    mockCallSession('', { failOn: 'session' });
    const engine = new OpenCodeEngine('http://localhost:4096');
    const result = await engine.fillProposal({ title: 'T' }, '## Original\nbody');
    assert.ok(result.includes('unavailable'), 'should fall back to stub');
  });

  it('fillProposal falls back to KeywordEngine stub on network error', async () => {
    mockCallSession('', { failOn: 'network' });
    const engine = new OpenCodeEngine('http://localhost:4096');
    const result = await engine.fillProposal({ title: 'T' }, '## Original\nbody');
    assert.ok(result.includes('unavailable'), 'should fall back to stub');
  });

  it('critiqueDocument returns the LLM critique text on success', async () => {
    mockCallSession('### Cross-cutting ⚠️ warn\n- **Finding:** missing rollback');
    const engine = new OpenCodeEngine('http://localhost:4096');
    const result = await engine.critiqueDocument('## Problem\nsome proposal content');
    assert.ok(result.includes('missing rollback'), 'should return the LLM critique');
  });

  it('critiqueDocument sends a prompt containing the document content', async () => {
    let capturedMessageBody = '';
    let callCount = 0;
    globalThis.fetch = async (_url: any, opts: any) => {
      callCount++;
      if (callCount === 1) return new Response(JSON.stringify({ id: 'ses_test' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      capturedMessageBody = opts.body;
      return new Response(JSON.stringify({ parts: [{ type: 'text', text: 'critique' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const engine = new OpenCodeEngine('http://localhost:4096');
    await engine.critiqueDocument('## Problem\nunique content marker xyz');
    const parsed = JSON.parse(capturedMessageBody);
    const promptText = parsed.parts[0].text;
    assert.ok(promptText.includes('unique content marker xyz'), 'prompt should contain document content');
    assert.ok(promptText.includes('governance document reviewer'), 'prompt should set the AI role');
  });

  it('critiqueDocument falls back to KeywordEngine stub on error', async () => {
    mockCallSession('', { failOn: 'network' });
    const engine = new OpenCodeEngine('http://localhost:4096');
    const result = await engine.critiqueDocument('## Problem\nsome content');
    assert.ok(result.includes('unavailable'), 'should fall back to stub');
  });

  it('critiqueDocument truncates very long documents to avoid huge prompts', async () => {
    let capturedMessageBody = '';
    let callCount = 0;
    globalThis.fetch = async (_url: any, opts: any) => {
      callCount++;
      if (callCount === 1) return new Response(JSON.stringify({ id: 'ses_test' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      capturedMessageBody = opts.body;
      return new Response(JSON.stringify({ parts: [{ type: 'text', text: 'critique' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const engine = new OpenCodeEngine('http://localhost:4096');
    await engine.critiqueDocument('x'.repeat(10000));
    const parsed = JSON.parse(capturedMessageBody);
    const promptText = parsed.parts[0].text;
    assert.ok(promptText.length < 8000, 'prompt should be bounded even for large documents');
  });
});

describe('KeywordEngine — fillProposal + critiqueDocument offline behavior', () => {
  const engine = new KeywordEngine();

  it('fillProposal preserves the original body in the stub response', async () => {
    const body = '## Problem\nThe widget is broken.';
    const result = await engine.fillProposal({ title: 'Widget Fix' }, body);
    assert.ok(result.includes('broken'), 'original body content should be present in stub');
  });

  it('critiqueDocument returns a non-empty stub string', async () => {
    const result = await engine.critiqueDocument('## Problem\nSomething needs fixing.');
    assert.ok(result.length > 0, 'stub should return non-empty string');
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
