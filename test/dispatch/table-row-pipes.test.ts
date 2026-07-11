import * as assert from 'node:assert';
import { splitTableRow } from '../../src/dispatch/completion-gate';
import { replaceStepStatus } from '../../src/mcp/lib/steps';

// Regression: a Details cell containing a raw `|` inside an inline code span
// (e.g. `category: bug|feature`) desynced the column count — update_step then
// replaced the wrong cell and left/duplicated the Status cell.
describe('splitTableRow — cell-boundary pipes only', () => {
  it('splits a normal row and round-trips via join', () => {
    const line = '| 1 | Action | Details | ⏳ Pending |';
    const parts = splitTableRow(line);
    assert.deepStrictEqual(parts, ['', ' 1 ', ' Action ', ' Details ', ' ⏳ Pending ', '']);
    assert.strictEqual(parts.join('|'), line);
  });

  it('does NOT split on a backslash-escaped pipe', () => {
    const line = '| 1 | a \\| b | ⏳ Pending |';
    const parts = splitTableRow(line);
    // the escaped pipe stays inside its cell (not a column boundary)
    assert.deepStrictEqual(parts, ['', ' 1 ', ' a \\| b ', ' ⏳ Pending ', '']);
    assert.strictEqual(parts.join('|'), line);
  });

  it('does NOT split on a raw pipe inside an inline code span', () => {
    const line = '| 1 | Action | takes `category: bug|feature` here | ⏳ Pending |';
    const parts = splitTableRow(line);
    // 4 columns + 2 empty sentinels = 6 cells; the code-span pipe is preserved
    assert.strictEqual(parts.length, 6);
    assert.strictEqual(parts[3], ' takes `category: bug|feature` here ');
    assert.strictEqual(parts.join('|'), line);     // exact round-trip
  });
});

describe('replaceStepStatus — code-span pipe in Details (the update_step corruption)', () => {
  const plan = [
    '# Plan',
    '',
    '## Implementation Steps',
    '',
    '| # | Action | Details | Status |',
    '| --- | --- | --- | --- |',
    '| 1 | Wire the report API | accepts `category: bug|feature` literal | ⏳ Pending |',
    '| 2 | Second step | nothing special | ⏳ Pending |',
    '',
  ].join('\n');

  it('marks the right step done without corrupting the code-span cell or duplicating Status', () => {
    const { text, found } = replaceStepStatus(plan, 'Wire the report API', '✅ Done');
    assert.ok(found, 'step should be found');
    const row = text.split('\n').find(l => l.includes('Wire the report API'))!;
    const cells = splitTableRow(row).slice(1, -1).map(c => c.trim());
    assert.deepStrictEqual(cells, ['1', 'Wire the report API', 'accepts `category: bug|feature` literal', '✅ Done']);
    // exactly one Status-shaped cell — no leftover ⏳ Pending, no extra column
    assert.strictEqual((row.match(/✅ Done/g) || []).length, 1);
    assert.strictEqual(row.includes('⏳ Pending'), false);
    // the OTHER step is untouched
    assert.ok(text.includes('| 2 | Second step | nothing special | ⏳ Pending |'));
  });
});
