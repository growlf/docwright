import assert from 'assert';
import { parsePlanSteps, readPlanSteps } from '../../src/executor/plan-parser';

describe('plan-parser', () => {
  describe('parsePlanSteps', () => {
    it('parses a standard plan with 3 steps', () => {
      const content = `# Test Plan

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | First step | Do the first thing | ⏳ Pending |
| 2 | Second step | Do the second thing | ✅ Done |
| 3 | Third step | Do the third thing | ⏳ Pending |

## Next Section
`;
      const steps = parsePlanSteps(content);
      assert.strictEqual(steps.length, 3);
      assert.strictEqual(steps[0].stepNumber, 1);
      assert.strictEqual(steps[0].action, 'First step');
      assert.strictEqual(steps[0].details, 'Do the first thing');
      assert.strictEqual(steps[0].status, 'pending');
      assert.strictEqual(steps[1].stepNumber, 2);
      assert.strictEqual(steps[1].status, 'done');
      assert.strictEqual(steps[2].stepNumber, 3);
      assert.strictEqual(steps[2].status, 'pending');
    });

    it('returns empty array when no Implementation Steps section', () => {
      const content = '# No Steps\n\nJust some text.\n';
      assert.deepStrictEqual(parsePlanSteps(content), []);
    });

    it('returns empty array when Implementation Steps table is empty (no rows)', () => {
      const content = `# Empty Table

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |

## Next Section
`;
      assert.deepStrictEqual(parsePlanSteps(content), []);
    });

    it('handles escaped pipes in cells', () => {
      const content = `# Plan

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | left\\|right split | Contains a \\| pipe | ✅ Done |

## Next
`;
      const steps = parsePlanSteps(content);
      assert.strictEqual(steps.length, 1);
      assert.strictEqual(steps[0].action, 'left|right split');
      assert.strictEqual(steps[0].details, 'Contains a | pipe');
    });

    it('handles steps with missing details column', () => {
      const content = `# Plan

## Implementation Steps

| Step | Action | Status |
| --- | --- | --- |
| 1 | Just an action | ⏳ Pending |

## Next
`;
      const steps = parsePlanSteps(content);
      assert.strictEqual(steps.length, 1);
      assert.strictEqual(steps[0].stepNumber, 1);
      assert.strictEqual(steps[0].action, 'Just an action');
      assert.strictEqual(steps[0].details, '');
      assert.strictEqual(steps[0].status, 'pending');
    });

    it('assigns sequential numbers for unparseable step numbers', () => {
      const content = `# Plan

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| foo | Invalid number | details | ⏳ Pending |

## Next
`;
      const steps = parsePlanSteps(content);
      assert.strictEqual(steps.length, 1);
      assert.strictEqual(steps[0].stepNumber, 1);
    });

    it('detects all status types', () => {
      const content = `# Plan

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Pending | desc | ⏳ Pending |
| 2 | Done | desc | ✅ Done |
| 3 | Unknown | desc | Something else |

## Next
`;
      const steps = parsePlanSteps(content);
      assert.strictEqual(steps[0].status, 'pending');
      assert.strictEqual(steps[1].status, 'done');
      assert.strictEqual(steps[2].status, 'unknown');
    });

    it('parses the actual auto-plan-executor plan correctly', () => {
      const fs = require('node:fs');
      const content = fs.readFileSync('plans/auto-plan-executor.md', 'utf-8');
      const steps = parsePlanSteps(content);
      assert.strictEqual(steps.length, 9);
      assert.strictEqual(steps[0].stepNumber, 1);
      assert.strictEqual(steps[0].action.includes('Parsing engine'), true);
      // Step 1 may be done if orchestrated plan already executed it
      assert.ok(steps[0].status === 'done' || steps[0].status === 'pending');
      assert.strictEqual(steps[8].stepNumber, 9);
      assert.strictEqual(steps[8].action.includes('Test suite'), true);
      assert.strictEqual(steps[8].status, 'pending');
    });
  });

  describe('readPlanSteps', () => {
    it('throws descriptive error for missing file', () => {
      assert.throws(
        () => readPlanSteps('/nonexistent/plan.md'),
        /Cannot read plan file/
      );
    });

    it('reads and parses a real plan file', () => {
      const steps = readPlanSteps('plans/auto-plan-executor.md');
      assert.strictEqual(steps.length, 9);
      assert.strictEqual(steps[0].stepNumber, 1);
    });
  });
});
