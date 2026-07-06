import * as assert from 'node:assert';
import {
  createTurndown,
  createMarkdownIt,
  splitFrontmatter,
  buildRawFromText,
  applyFrontmatterEdits,
} from '../../src/webui/src/lib/markdown-roundtrip';

/**
 * #149 — the WYSIWYG editor must round-trip governance markdown without
 * corruption: task lists survive, bullets stay `-`, literal underscores are
 * not escaped, and frontmatter is reattached byte-identical (never
 * re-serialized).
 */

const td = createTurndown();
const md = createMarkdownIt();

function roundTrip(markdown: string): string {
  return td.turndown(md.render(markdown));
}

describe('WYSIWYG round-trip (#149)', () => {
  it('task-list checkboxes survive', () => {
    const src = '- [x] Step 1: done thing\n- [ ] Step 2: open thing';
    const out = roundTrip(src);
    assert.ok(out.includes('- [x] Step 1: done thing'), out);
    assert.ok(out.includes('- [ ] Step 2: open thing'), out);
  });

  it('bullets keep the - marker', () => {
    const out = roundTrip('- alpha\n- beta');
    assert.ok(/^- alpha/m.test(out), out);
    assert.ok(!out.includes('* '), `bullets rewritten to *: ${out}`);
  });

  it('literal underscores are not escaped', () => {
    const out = roundTrip('The `author_role` field and tests_defined flag.');
    assert.ok(out.includes('tests_defined'), out);
    assert.ok(!out.includes('\\_'), `underscores escaped: ${out}`);
  });

  it('tables with snake_case cells survive', () => {
    const src = [
      '| Field | Meaning |',
      '| --- | --- |',
      '| tests_defined | gate input |',
      '| author_role | audit record |',
    ].join('\n');
    const out = roundTrip(src);
    assert.ok(out.includes('tests_defined'), out);
    assert.ok(!out.includes('\\_'), `underscores escaped in table: ${out}`);
  });

  it('headings and emphasis are stable', () => {
    const out = roundTrip('## Testing Plan\n\nSome _emphasis_ and **bold**.');
    assert.ok(out.includes('## Testing Plan'), out);
    assert.ok(out.includes('_emphasis_'), out);
    assert.ok(out.includes('**bold**'), out);
  });
});

describe('Frontmatter is never re-serialized (#149)', () => {
  // Deliberately hostile to naive parsers: comments, quoted colons, block
  // list, trailing spaces preserved inside a quoted value.
  const FM = [
    '# governance header comment',
    'title: "Colon: kept exactly"',
    'status: in-progress',
    'tags:',
    '  - alpha',
    '  - beta',
    "note: 'single quotes  padded'",
    'approved: false',
  ].join('\n');
  const RAW = `---\n${FM}\n---\n# Body\n\nText.\n`;

  it('splitFrontmatter keeps the original text block verbatim', () => {
    const parsed = splitFrontmatter(RAW);
    assert.strictEqual(parsed.fmText, FM);
    assert.strictEqual(parsed.frontmatter?.status, 'in-progress');
    assert.deepStrictEqual(parsed.frontmatter?.tags, ['alpha', 'beta']);
  });

  it('body-only save reattaches the block byte-identical', () => {
    const parsed = splitFrontmatter(RAW);
    const rebuilt = buildRawFromText(parsed.fmText, parsed.body);
    assert.strictEqual(rebuilt, RAW);
  });

  it('a single field edit touches only that field', () => {
    const parsed = splitFrontmatter(RAW);
    const edited = applyFrontmatterEdits(parsed.fmText!, parsed.frontmatter!, {
      ...parsed.frontmatter,
      status: 'completed',
    });
    assert.strictEqual(edited, FM.replace('status: in-progress', 'status: completed'));
  });

  it('an array edit replaces only the block list', () => {
    const parsed = splitFrontmatter(RAW);
    const edited = applyFrontmatterEdits(parsed.fmText!, parsed.frontmatter!, {
      ...parsed.frontmatter,
      tags: ['alpha', 'beta', 'gamma'],
    });
    assert.ok(edited.includes('tags:\n  - alpha\n  - beta\n  - gamma'), edited);
    assert.ok(edited.includes('# governance header comment'), 'comment lost');
    assert.ok(edited.includes('title: "Colon: kept exactly"'), 'quoting lost');
  });

  it('client-injected _path never reaches the block', () => {
    const parsed = splitFrontmatter(RAW);
    const edited = applyFrontmatterEdits(parsed.fmText!, parsed.frontmatter!, {
      ...parsed.frontmatter,
      _path: 'plans/somewhere.md',
    });
    assert.strictEqual(edited, FM);
  });

  it('no-change edit is a byte-identical no-op', () => {
    const parsed = splitFrontmatter(RAW);
    const edited = applyFrontmatterEdits(parsed.fmText!, parsed.frontmatter!, {
      ...parsed.frontmatter,
    });
    assert.strictEqual(edited, FM);
  });
});
