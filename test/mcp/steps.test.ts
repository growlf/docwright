import * as assert from 'node:assert';
import { splitTableRow, countSteps, hasPendingSteps, replaceStepStatus } from '../../src/mcp/lib/steps';

// Escaped pipes (`\|`) inside a table cell are literal content, not column
// boundaries. The naive line.split('|') miscounted such rows: the Status
// column shifted, so a ✅ Done row read as pending and blocked
// transition_to_completed (found on the separate-dev-tracking plan, whose
// step 6 contains `channel: dev\|beta\|stable`).

const PLAN_WITH_ESCAPED_PIPES = `---
title: "Test"
status: completed
---

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Plain step | Nothing special | ✅ Done |
| 2 | Channel field | \`channel: dev\\|beta\\|stable\` field, orthogonal to version | ✅ Done |
| 3 | Another step | More \\| escaped \\| pipes | ✅ Done |
`;

describe('Step table parsing', () => {
  describe('splitTableRow', () => {
    it('splits on unescaped pipes only', () => {
      const cells = splitTableRow('| 1 | a\\|b | ✅ Done |');
      assert.deepEqual(cells, ['', ' 1 ', ' a\\|b ', ' ✅ Done ', '']);
    });

    it('is lossless when rejoined with "|"', () => {
      const line = '| 2 | `dev\\|beta\\|stable` | ⏳ Pending |';
      assert.equal(splitTableRow(line).join('|'), line);
    });

    it('behaves like split("|") when there are no escapes', () => {
      const line = '| 1 | plain | ✅ Done |';
      assert.deepEqual(splitTableRow(line), line.split('|'));
    });
  });

  describe('countSteps with escaped pipes', () => {
    it('does not shift the Status column on rows containing \\|', () => {
      const { total, completed } = countSteps(PLAN_WITH_ESCAPED_PIPES);
      assert.equal(total, 3);
      assert.equal(completed, 3);
    });

    it('hasPendingSteps is false when every row is ✅ Done', () => {
      assert.equal(hasPendingSteps(PLAN_WITH_ESCAPED_PIPES), false);
    });

    it('still detects a genuinely pending row containing \\|', () => {
      const pending = PLAN_WITH_ESCAPED_PIPES.replace(
        '| 2 | Channel field | `channel: dev\\|beta\\|stable` field, orthogonal to version | ✅ Done |',
        '| 2 | Channel field | `channel: dev\\|beta\\|stable` field, orthogonal to version | ⏳ Pending |',
      );
      assert.equal(hasPendingSteps(pending), true);
    });
  });

  describe('replaceStepStatus with escaped pipes', () => {
    it('updates the Status cell, not a cell shifted by \\|', () => {
      const { text, found } = replaceStepStatus(PLAN_WITH_ESCAPED_PIPES, 'Channel field', '⏳ Pending');
      assert.equal(found, true);
      assert.ok(text.includes('| 2 | Channel field | `channel: dev\\|beta\\|stable` field, orthogonal to version | ⏳ Pending |'));
      const { total, completed } = countSteps(text);
      assert.equal(total, 3);
      assert.equal(completed, 2);
    });
  });
});
