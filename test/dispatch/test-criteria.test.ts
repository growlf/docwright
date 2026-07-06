import assert from 'assert';
import {
  extractPlanSteps,
  stepsChanged,
  removePhantomStepDuplicates,
  syncTestCriteria,
} from '../../src/dispatch/test-criteria';

const PLAN = `---
title: "Criteria fixture"
status: in-progress
---

# Criteria fixture

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | First thing | details | ✅ Done |
| 2 | Second thing | details | ⏳ Pending |

## Testing Plan

### Step Verification

- [x] Step 1: First thing
- [ ] Step 2: Second thing

## Document History

| Date | Change | Author |
|------|--------|--------|
`;

describe('stepsChanged (#148 save gate)', () => {
  it('false when content differs but the step table is identical', () => {
    const edited = PLAN.replace('# Criteria fixture', '# Criteria fixture\n\nNew overview prose.');
    assert.strictEqual(stepsChanged(PLAN, edited), false);
  });

  it('false when only a step Status cell changes', () => {
    const done = PLAN.replace('| 2 | Second thing | details | ⏳ Pending |', '| 2 | Second thing | details | ✅ Done |');
    assert.strictEqual(stepsChanged(PLAN, done), false);
  });

  it('true when a step action is reworded', () => {
    const reworded = PLAN.replace('| 2 | Second thing |', '| 2 | Second thing, expanded |');
    assert.strictEqual(stepsChanged(PLAN, reworded), true);
  });

  it('true when a step is added or removed', () => {
    const added = PLAN.replace(
      '| 2 | Second thing | details | ⏳ Pending |',
      '| 2 | Second thing | details | ⏳ Pending |\n| 3 | Third thing | details | ⏳ Pending |',
    );
    assert.strictEqual(stepsChanged(PLAN, added), true);
    assert.strictEqual(stepsChanged(added, PLAN), true);
  });
});

describe('removePhantomStepDuplicates (#148 sweep)', () => {
  it('removes an unchecked step line whose number has a checked counterpart', () => {
    const corrupted = PLAN.replace(
      '## Testing Plan\n',
      '## Testing Plan\n\n- [ ] Step 1: First thing (stale wording)\n',
    );
    const { content, removed } = removePhantomStepDuplicates(corrupted);
    assert.deepStrictEqual(removed, ['- [ ] Step 1: First thing (stale wording)']);
    assert.ok(content.includes('- [x] Step 1: First thing'));
    // The legitimately-unchecked Step 2 (no checked counterpart) survives
    assert.ok(content.includes('- [ ] Step 2: Second thing'));
  });

  it('no-op on a clean plan', () => {
    const { content, removed } = removePhantomStepDuplicates(PLAN);
    assert.deepStrictEqual(removed, []);
    assert.strictEqual(content, PLAN);
  });

  it('ignores checkbox lines outside the Testing Plan section', () => {
    const withGate = PLAN.replace(
      '## Document History',
      '## Rollout\n\n- [ ] Step 1: unrelated rollout box\n\n## Document History',
    );
    const { removed } = removePhantomStepDuplicates(withGate);
    assert.deepStrictEqual(removed, []);
  });
});

describe('syncTestCriteria (existing semantics)', () => {
  it('adds a criterion for a new step, never removes existing ones', () => {
    const added = PLAN.replace(
      '| 2 | Second thing | details | ⏳ Pending |',
      '| 2 | Second thing | details | ⏳ Pending |\n| 3 | Third thing | details | ⏳ Pending |',
    );
    const synced = syncTestCriteria(added, 'Criteria fixture');
    assert.ok(synced.includes('- [ ] Step 3: Third thing'));
    assert.ok(synced.includes('- [x] Step 1: First thing'));
  });

  it('extractPlanSteps reads the fixture table', () => {
    assert.deepStrictEqual(extractPlanSteps(PLAN).map(s => s.number), ['1', '2']);
  });
});
