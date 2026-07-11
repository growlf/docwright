import * as assert from 'node:assert';
import { splitTableRow, extractPlanSteps, escapeTableCell } from '../../src/dispatch/completion-gate';
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

describe('extractPlanSteps — code-span pipe in Details (the plan-review corruption)', () => {
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
    '## Next section',
  ].join('\n');

  it('parses a Details cell with a code-span pipe into the correct columns', () => {
    const steps = extractPlanSteps(plan);
    assert.strictEqual(steps.length, 2, 'both rows parsed');
    assert.strictEqual(steps[0].number, '1');
    assert.strictEqual(steps[0].action, 'Wire the report API');
    // the whole code span stays in details — the pipe does NOT split the column
    assert.strictEqual(steps[0].details, 'accepts `category: bug|feature` literal');
    assert.strictEqual(steps[1].action, 'Second step');
  });

  it('stops at the end of the Implementation Steps table', () => {
    const steps = extractPlanSteps(plan);
    assert.ok(!steps.some(s => s.action.includes('Next section')));
  });
});

describe('escapeTableCell — write-side pipe escaping', () => {
  it('escapes a literal pipe so the cell survives splitTableRow round-trip', () => {
    const change = 'renamed status open|new to new';
    const row = `| 2026-07-11 | ${escapeTableCell(change)} | agent |`;
    const cells = splitTableRow(row).slice(1, -1).map(c => c.trim());
    assert.strictEqual(cells.length, 3, 'exactly 3 columns — the pipe did not add one');
    assert.strictEqual(cells[1], 'renamed status open\\|new to new');
  });

  it('is idempotent — an already-escaped pipe is not double-escaped', () => {
    assert.strictEqual(escapeTableCell('a\\|b'), 'a\\|b');
    assert.strictEqual(escapeTableCell('a|b'), 'a\\|b');
    assert.strictEqual(escapeTableCell(escapeTableCell('a|b|c')), 'a\\|b\\|c');
  });
});
