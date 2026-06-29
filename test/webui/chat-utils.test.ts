import assert from 'node:assert/strict';
import {
  flattenTree,
  relativeTime,
  dayGroup,
  detectMention,
  filterMention,
  accumulateUsage,
  truncate,
  FileItem,
  TreeItem,
  UsageInfo,
} from '../../src/webui/src/lib/chat-utils';

// ── flattenTree ──────────────────────────────────────────────────────────────

describe('flattenTree', () => {

  it('flattens a simple file list', () => {
    const input: TreeItem[] = [
      { name: 'foo.md', path: 'foo.md', type: 'file' },
      { name: 'bar.md', path: 'bar.md', type: 'file' },
    ];
    assert.deepEqual(flattenTree(input), [
      { name: 'foo.md', path: 'foo.md' },
      { name: 'bar.md', path: 'bar.md' },
    ]);
  });

  it('flattens nested directories', () => {
    const input: TreeItem[] = [
      { name: 'docs', path: 'docs', type: 'dir', children: [
        { name: 'a.md', path: 'docs/a.md', type: 'file' },
        { name: 'sub', path: 'docs/sub', type: 'dir', children: [
          { name: 'b.md', path: 'docs/sub/b.md', type: 'file' },
        ]},
      ]},
      { name: 'c.md', path: 'c.md', type: 'file' },
    ];
    assert.deepEqual(flattenTree(input), [
      { name: 'a.md', path: 'docs/a.md' },
      { name: 'b.md', path: 'docs/sub/b.md' },
      { name: 'c.md', path: 'c.md' },
    ]);
  });

  it('returns empty for empty input', () => {
    assert.deepEqual(flattenTree([]), []);
  });
});

// ── relativeTime ─────────────────────────────────────────────────────────────

describe('relativeTime', () => {

  it('returns empty for falsy input', () => {
    assert.equal(relativeTime(''), '');
    assert.equal(relativeTime(undefined), '');
  });

  it('returns just now for <1 minute', () => {
    const recent = new Date(Date.now() - 30000).toISOString();
    assert.equal(relativeTime(recent), 'just now');
  });

  it('returns Xm ago for <1 hour', () => {
    const d = new Date(Date.now() - 120000).toISOString();
    assert.equal(relativeTime(d), '2m ago');
  });

  it('returns Xh ago for <24 hours', () => {
    const d = new Date(Date.now() - 3600000 * 3).toISOString();
    assert.equal(relativeTime(d), '3h ago');
  });

  it('returns Xd ago for <7 days', () => {
    const d = new Date(Date.now() - 86400000 * 2).toISOString();
    assert.equal(relativeTime(d), '2d ago');
  });

  it('returns date for >7 days', () => {
    const d = new Date(Date.now() - 86400000 * 10).toISOString();
    const result = relativeTime(d);
    // Should be a locale date string, not a relative string
    assert.ok(!result.includes('ago'));
    assert.ok(result.length > 0);
  });
});

// ── dayGroup ─────────────────────────────────────────────────────────────────

describe('dayGroup', () => {

  it('returns older for falsy input', () => {
    assert.equal(dayGroup(''), 'older');
    assert.equal(dayGroup(undefined), 'older');
  });

  it('returns today for recent timestamp', () => {
    const d = new Date().toISOString();
    assert.equal(dayGroup(d), 'today');
  });

  it('returns today for 1 minute before midnight today', () => {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const d = new Date(todayMidnight + 60000).toISOString(); // 1 min into today
    assert.equal(dayGroup(d), 'today');
  });

  it('returns yesterday for 1 second before midnight today', () => {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const d = new Date(todayMidnight - 1000).toISOString(); // 1s before today
    assert.equal(dayGroup(d), 'yesterday');
  });

  it('returns older for 1 second before midnight yesterday', () => {
    const now = new Date();
    const yesterdayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - 86400000;
    const d = new Date(yesterdayMidnight - 1000).toISOString();
    assert.equal(dayGroup(d), 'older');
  });
});

// ── detectMention ────────────────────────────────────────────────────────────

describe('detectMention', () => {

  it('returns -1 for empty text', () => {
    assert.equal(detectMention('', 0), -1);
  });

  it('finds @ at start of string', () => {
    assert.equal(detectMention('@foo', 4), 0);
  });

  it('finds @ after whitespace', () => {
    assert.equal(detectMention('hello @foo', 10), 6);
  });

  it('returns -1 for @ mid-word (not a mention)', () => {
    assert.equal(detectMention('hello@foo', 10), -1);
  });

  it('returns -1 when cursor is before @', () => {
    assert.equal(detectMention('@foo', 0), -1);
  });

  it('returns -1 when there is space after @', () => {
    assert.equal(detectMention('@ foo', 4), -1);
  });

  it('finds @ after newline', () => {
    assert.equal(detectMention('hello\n@foo', 10), 6);
  });

  it('returns correct position with partial query', () => {
    assert.equal(detectMention('@fo', 3), 0);
  });
});

// ── filterMention ────────────────────────────────────────────────────────────

describe('filterMention', () => {

  const files: FileItem[] = [
    { name: 'README.md', path: 'README.md' },
    { name: 'CHANGELOG.md', path: 'CHANGELOG.md' },
    { name: 'proposals.md', path: 'docs/proposals.md' },
    { name: 'index.ts', path: 'src/index.ts' },
    { name: 'config.json', path: 'config/config.json' },
  ];

  it('returns all files capped at 50 when query is empty', () => {
    const result = filterMention('', files);
    assert.equal(result.length, files.length);
  });

  it('filters by filename', () => {
    const result = filterMention('readme', files);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'README.md');
  });

  it('filters by path', () => {
    const result = filterMention('src/', files);
    assert.equal(result.length, 1);
    assert.equal(result[0].path, 'src/index.ts');
  });

  it('is case-insensitive', () => {
    const result = filterMention('README', files);
    assert.equal(result.length, 1);
  });

  it('caps at max results', () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ name: `file${i}.md`, path: `file${i}.md` }));
    const result = filterMention('', many, 50);
    assert.equal(result.length, 50);
  });

  it('returns empty for no matches', () => {
    const result = filterMention('zzznonexistent', files);
    assert.equal(result.length, 0);
  });
});

// ── accumulateUsage ──────────────────────────────────────────────────────────

describe('accumulateUsage', () => {

  it('adds usage for a new session', () => {
    const map = accumulateUsage(new Map(), 's1', 100, 50, 0.01);
    assert.equal(map.get('s1')!.inputTokens, 100);
    assert.equal(map.get('s1')!.outputTokens, 50);
    assert.equal(map.get('s1')!.cost, 0.01);
  });

  it('accumulates into existing session', () => {
    const m1 = accumulateUsage(new Map(), 's1', 100, 50, 0.01);
    const m2 = accumulateUsage(m1, 's1', 200, 30, 0.02);
    assert.equal(m2.get('s1')!.inputTokens, 300);
    assert.equal(m2.get('s1')!.outputTokens, 80);
    assert.equal(m2.get('s1')!.cost, 0.03);
  });

  it('tracks multiple sessions independently', () => {
    const m1 = accumulateUsage(new Map(), 's1', 100, 50, 0.01);
    const m2 = accumulateUsage(m1, 's2', 10, 5, 0.001);
    assert.equal(m2.get('s1')!.inputTokens, 100);
    assert.equal(m2.get('s2')!.outputTokens, 5);
  });

  it('does not mutate the input map', () => {
    const original = new Map([['s1', { inputTokens: 10, outputTokens: 5, cost: 0.001 }]]);
    const result = accumulateUsage(original, 's1', 5, 5, 0.001);
    assert.equal(original.get('s1')!.inputTokens, 10);
    assert.equal(result.get('s1')!.inputTokens, 15);
  });
});

// ── truncate ─────────────────────────────────────────────────────────────────

describe('truncate', () => {

  it('returns "New Chat" for undefined title', () => {
    assert.equal(truncate(undefined), 'New Chat');
  });

  it('returns short titles unchanged', () => {
    assert.equal(truncate('Hello'), 'Hello');
  });

  it('truncates long titles with ellipsis', () => {
    const long = 'a'.repeat(40);
    assert.equal(truncate(long), 'a'.repeat(32) + '…');
  });

  it('respects custom max length', () => {
    assert.equal(truncate('hello world', 5), 'hello…');
  });
});
