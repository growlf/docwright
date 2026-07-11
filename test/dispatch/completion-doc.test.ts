import * as assert from 'node:assert';
import * as yaml from 'js-yaml';
import { generateCompletionDoc } from '../../src/dispatch/completion-doc';

// #185/#136: generateCompletionDoc built frontmatter via raw string interpolation,
// so a title containing a colon/pipe/quote/# emitted YAML that js-yaml refused to
// load. These assert the serializer fix — every generated doc's frontmatter parses.

function parseFrontmatter(doc: string): Record<string, any> {
  const m = doc.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(m, 'doc must have a frontmatter block');
  return yaml.load(m![1]) as Record<string, any>;
}

function planWith(fm: string): string {
  return `---\n${fm}\n---\n\n# Body\ncontent\n`;
}

describe('generateCompletionDoc — YAML-safe frontmatter (#185/#136)', () => {
  const nasty = [
    'Wave C — intake UX: modal form',        // colon
    'Harden table-row parsing | all surfaces', // pipe
    'Fix the "quoted" thing',                  // quotes
    '#329 phase-close vs protected main',      // leading #
  ];

  for (const title of nasty) {
    it(`produces parseable YAML for title: ${JSON.stringify(title)}`, () => {
      const plan = planWith(`title: ${JSON.stringify(title)}\nauthor: NetYeti\ncreated: 2026-06-08\ntags: [a, b]`);
      const doc = generateCompletionDoc(plan, 'some-plan.md', '2026-07-11');
      // The whole point: this must not throw.
      const fm = parseFrontmatter(doc);
      assert.strictEqual(fm.title, title, 'title round-trips exactly');
      assert.strictEqual(fm.status, 'completed');
    });
  }

  it('preserves the source plan created date as a clean ISO value (#136 half)', () => {
    const plan = planWith('title: Simple\nauthor: A\ncreated: 2026-06-08\ntags: []');
    const fm = parseFrontmatter(generateCompletionDoc(plan, 'p.md', '2026-07-11'));
    assert.strictEqual(String(fm.created).slice(0, 10), '2026-06-08', 'created sourced from the plan, not a JS Date');
    assert.strictEqual(fm.completed_date, '2026-07-11');
  });

  it('serializes array tags and a special-character tag safely (#185 half)', () => {
    const plan = planWith('title: T\nauthor: A\ncreated: 2026-06-08\ntags:\n  - governance\n  - "bug: fix"');
    const fm = parseFrontmatter(generateCompletionDoc(plan, 'p.md', '2026-07-11'));
    assert.deepStrictEqual(fm.tags, ['governance', 'bug: fix'], 'tags round-trip incl. a colon-bearing tag');
  });

  it('emits tags: [] when the plan has no tags', () => {
    const plan = planWith('title: T\nauthor: A\ncreated: 2026-06-08');
    const fm = parseFrontmatter(generateCompletionDoc(plan, 'p.md', '2026-07-11'));
    assert.deepStrictEqual(fm.tags, [], 'no tags → empty list');
  });
});
