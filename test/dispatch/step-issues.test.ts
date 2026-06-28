import assert from 'assert';
import { countSteps, replaceStepStatus } from '../../src/mcp/lib/steps';

// ---------------------------------------------------------------------------
// countSteps — 4-column table
// ---------------------------------------------------------------------------

describe('countSteps — 4-column table', () => {
  const header4 = [
    '## Implementation Steps',
    '',
    '| Step | Action | Details | Status |',
    '| --- | --- | --- | --- |',
  ].join('\n');

  it('all pending: total=2, completed=0', () => {
    const text = [
      header4,
      '| 1 | Do thing | Some details | ⏳ Pending |',
      '| 2 | Do other | More details | ⏳ Pending |',
    ].join('\n');
    const { total, completed } = countSteps(text);
    assert.strictEqual(total, 2);
    assert.strictEqual(completed, 0);
  });

  it('all done: total=2, completed=2', () => {
    const text = [
      header4,
      '| 1 | Do thing | Some details | ✅ Done |',
      '| 2 | Do other | More details | ✅ Done |',
    ].join('\n');
    const { total, completed } = countSteps(text);
    assert.strictEqual(total, 2);
    assert.strictEqual(completed, 2);
  });

  it('mixed: total=3, completed=1', () => {
    const text = [
      header4,
      '| 1 | Do thing | Some details | ✅ Done |',
      '| 2 | Do other | More details | ⏳ Pending |',
      '| 3 | Do last  | Final detail | ⏳ Pending |',
    ].join('\n');
    const { total, completed } = countSteps(text);
    assert.strictEqual(total, 3);
    assert.strictEqual(completed, 1);
  });
});

// ---------------------------------------------------------------------------
// countSteps — 6-column table
// ---------------------------------------------------------------------------

describe('countSteps — 6-column table', () => {
  const header6 = [
    '## Implementation Steps',
    '',
    '| Step | Action | Details | Status | Issue | Branch |',
    '| --- | --- | --- | --- | --- | --- |',
  ].join('\n');

  it('all pending: reads Status column, not Branch column', () => {
    const text = [
      header6,
      '| 1 | Do thing | Some details | ⏳ Pending | — | — |',
      '| 2 | Do other | More details | ⏳ Pending | — | — |',
    ].join('\n');
    const { total, completed } = countSteps(text);
    assert.strictEqual(total, 2);
    assert.strictEqual(completed, 0);
  });

  it('all done: correctly identifies ✅ in Status column (not Branch)', () => {
    const text = [
      header6,
      '| 1 | Do thing | Some details | ✅ Done | #41 | `feat/41-thing` |',
      '| 2 | Do other | More details | ✅ Done | #42 | `feat/42-other` |',
    ].join('\n');
    const { total, completed } = countSteps(text);
    assert.strictEqual(total, 2);
    assert.strictEqual(completed, 2);
  });

  it('mixed: counts only Status column ✅, ignores Branch values', () => {
    // Row 2 has no ✅ in Status but Branch column contains tick-like chars — must not count
    const text = [
      header6,
      '| 1 | Do thing | Some details | ✅ Done    | #42 | `feat/42-slug` |',
      '| 2 | Do other | More details | ⏳ Pending | —   | —              |',
      '| 3 | Do last  | Final detail | ⏳ Pending | —   | —              |',
    ].join('\n');
    const { total, completed } = countSteps(text);
    assert.strictEqual(total, 3);
    assert.strictEqual(completed, 1);
  });
});

// ---------------------------------------------------------------------------
// countSteps — tiered sections (### sub-headings within ## Implementation Steps)
// ---------------------------------------------------------------------------

describe('countSteps — tiered sections', () => {
  it('counts steps across both tiers correctly', () => {
    const text = [
      '## Implementation Steps',
      '',
      '### Tier 1',
      '',
      '| Step | Action | Details | Status | Issue | Branch |',
      '| --- | --- | --- | --- | --- | --- |',
      '| 1 | First  | Details | ✅ Done    | #10 | `feat/10-first` |',
      '',
      '### Tier 2',
      '',
      '| Step | Action | Details | Status | Issue | Branch |',
      '| --- | --- | --- | --- | --- | --- |',
      '| 2 | Second | Details | ⏳ Pending | —   | —               |',
    ].join('\n');
    const { total, completed } = countSteps(text);
    assert.strictEqual(total, 2);
    assert.strictEqual(completed, 1);
  });

  it('stops counting when a new ## section begins after Implementation Steps', () => {
    const text = [
      '## Implementation Steps',
      '',
      '| Step | Action | Details | Status | Issue | Branch |',
      '| --- | --- | --- | --- | --- | --- |',
      '| 1 | In scope | Details | ✅ Done | — | — |',
      '',
      '## Testing Plan',
      '',
      '| Step | Action | Details | Status | Issue | Branch |',
      '| --- | --- | --- | --- | --- | --- |',
      '| 2 | Out of scope | Details | ⏳ Pending | — | — |',
    ].join('\n');
    const { total, completed } = countSteps(text);
    // Only the row under Implementation Steps should be counted
    assert.strictEqual(total, 1);
    assert.strictEqual(completed, 1);
  });
});

// ---------------------------------------------------------------------------
// replaceStepStatus — 4-column
// ---------------------------------------------------------------------------

describe('replaceStepStatus — 4-column', () => {
  const makePlan4 = () => [
    '## Implementation Steps',
    '',
    '| Step | Action | Details | Status |',
    '| --- | --- | --- | --- |',
    '| 1 | Do thing | Some details | ⏳ Pending |',
    '| 2 | Do other | More details | ⏳ Pending |',
  ].join('\n');

  it('replaces the last (Status) column on the matched row and returns found=true', () => {
    const { text, found } = replaceStepStatus(makePlan4(), '| 1 |', '✅ Done');
    assert.ok(found, 'should report found=true');
    const lines = text.split('\n');
    const row1 = lines.find(l => l.startsWith('| 1 |'))!;
    assert.ok(row1.includes('✅ Done'), 'Status column should contain ✅ Done');
    // Original status value should be gone
    assert.ok(!row1.includes('⏳ Pending'), 'old status should be replaced');
  });

  it('returns found=false when stepMatch is not present in the section', () => {
    const { found } = replaceStepStatus(makePlan4(), '| 99 |', '✅ Done');
    assert.strictEqual(found, false);
  });

  it('does not modify other rows when replacing step 1', () => {
    const { text } = replaceStepStatus(makePlan4(), '| 1 |', '✅ Done');
    const lines = text.split('\n');
    const row2 = lines.find(l => l.startsWith('| 2 |'))!;
    assert.ok(row2.includes('⏳ Pending'), 'row 2 should be unchanged');
  });
});

// ---------------------------------------------------------------------------
// replaceStepStatus — 6-column
// ---------------------------------------------------------------------------

describe('replaceStepStatus — 6-column', () => {
  const makePlan6 = () => [
    '## Implementation Steps',
    '',
    '| Step | Action | Details | Status | Issue | Branch |',
    '| --- | --- | --- | --- | --- | --- |',
    '| 1 | Do thing | Some details | ⏳ Pending | — | — |',
    '| 2 | Do other | More details | ⏳ Pending | #42 | `feat/42-slug` |',
  ].join('\n');

  it('replaces Status column, not Branch column, and returns found=true', () => {
    const { text, found } = replaceStepStatus(makePlan6(), '| 1 |', '✅ Done');
    assert.ok(found, 'should report found=true');
    const lines = text.split('\n');
    const row1 = lines.find(l => l.startsWith('| 1 |'))!;
    assert.ok(row1.includes('✅ Done'), 'Status cell should be updated');
    assert.ok(!row1.includes('⏳ Pending'), 'old status should be gone');
  });

  it('branch value is preserved after status replacement on row with branch data', () => {
    const { text, found } = replaceStepStatus(makePlan6(), '| 2 |', '✅ Done');
    assert.ok(found, 'should report found=true');
    const lines = text.split('\n');
    const row2 = lines.find(l => l.startsWith('| 2 |'))!;
    assert.ok(row2.includes('✅ Done'), 'Status cell should be updated');
    assert.ok(row2.includes('`feat/42-slug`'), 'Branch value should still be present after replacement');
    assert.ok(row2.includes('#42'), 'Issue value should still be present after replacement');
  });

  it('does not touch the Branch column when replacing Status', () => {
    // Verify the Branch column index is not shifted by the replacement
    const original = makePlan6();
    const { text } = replaceStepStatus(original, '| 2 |', '🔄 In Progress');
    const origRow = original.split('\n').find(l => l.startsWith('| 2 |'))!;
    const newRow = text.split('\n').find(l => l.startsWith('| 2 |'))!;
    const origCells = origRow.split('|').slice(1, -1).map(c => c.trim());
    const newCells = newRow.split('|').slice(1, -1).map(c => c.trim());
    // Branch is index 5 (0-based in cells array)
    assert.strictEqual(origCells[5], newCells[5], 'Branch cell must be unchanged');
    // Issue is index 4
    assert.strictEqual(origCells[4], newCells[4], 'Issue cell must be unchanged');
    // Status is index 3 — should have changed
    assert.notStrictEqual(origCells[3], newCells[3], 'Status cell must have changed');
  });
});

// ---------------------------------------------------------------------------
// replaceStepStatus — step match
// ---------------------------------------------------------------------------

describe('replaceStepStatus — step match', () => {
  const makePlan = () => [
    '## Implementation Steps',
    '',
    '| Step | Action | Details | Status | Issue | Branch |',
    '| --- | --- | --- | --- | --- | --- |',
    '| 1 | Alpha | Detail A | ⏳ Pending | — | — |',
    '| 10 | Beta  | Detail B | ⏳ Pending | — | — |',
    '| 11 | Gamma | Detail C | ⏳ Pending | — | — |',
  ].join('\n');

  it('matches by step number substring in the row — step 1', () => {
    const { text, found } = replaceStepStatus(makePlan(), '| 1 |', '✅ Done');
    assert.ok(found);
    const lines = text.split('\n');
    const row1 = lines.find(l => / 1 \|/.test(l) && l.includes('Alpha'))!;
    assert.ok(row1, 'step 1 row should exist');
    assert.ok(row1.includes('✅ Done'), 'step 1 should be updated');
  });

  it('step 10 match does not affect step 1', () => {
    const { text, found } = replaceStepStatus(makePlan(), '| 10 |', '✅ Done');
    assert.ok(found);
    const lines = text.split('\n');
    const row1 = lines.find(l => l.includes('Alpha'))!;
    const row10 = lines.find(l => l.includes('Beta'))!;
    assert.ok(row1.includes('⏳ Pending'), 'step 1 should be untouched');
    assert.ok(row10.includes('✅ Done'), 'step 10 should be updated');
  });

  it('step 11 match does not affect step 1 or step 10', () => {
    const { text, found } = replaceStepStatus(makePlan(), '| 11 |', '✅ Done');
    assert.ok(found);
    const lines = text.split('\n');
    const row1 = lines.find(l => l.includes('Alpha'))!;
    const row10 = lines.find(l => l.includes('Beta'))!;
    const row11 = lines.find(l => l.includes('Gamma'))!;
    assert.ok(row1.includes('⏳ Pending'), 'step 1 should be untouched');
    assert.ok(row10.includes('⏳ Pending'), 'step 10 should be untouched');
    assert.ok(row11.includes('✅ Done'), 'step 11 should be updated');
  });

  it('returns found=false for a step number not present in the table', () => {
    const { found } = replaceStepStatus(makePlan(), '| 99 |', '✅ Done');
    assert.strictEqual(found, false);
  });
});
