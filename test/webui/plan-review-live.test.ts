/**
 * Unit tests for the live plan-review orchestration (live-ai-visibility 3.2):
 * prompt building from a plan, and the sequential one-session run (idle awaited
 * between turns, reviewer persona on the first turn only). Network is injected.
 */
import assert from 'assert';
import { buildReviewPrompts, runLiveReview, type ReviewPrompt } from '../../src/webui/src/lib/server/plan-review-live';

const PLAN_WITH_STEPS = `---
title: Sample Plan
status: approved
priority: high
---

# Sample Plan

## Implementation Steps

| # | Action | Details | Status |
| --- | --- | --- | --- |
| 1.1 | Do the first thing | wire the helper | ⏳ Pending |
| 1.2 | Do the second thing | add the route | ⏳ Pending |

## Testing Plan

- unit tests for the helper

## Risk Assessment

- low risk, additive
`;

const PLAN_NO_STEPS = `---
title: Idea Doc
status: draft
---

# Idea Doc

Some freeform prose describing an idea without a step table.
`;

describe('plan-review-live — buildReviewPrompts', () => {
  it('emits one prompt per step, per present section, then overview (last)', () => {
    const prompts = buildReviewPrompts(PLAN_WITH_STEPS);
    const keys = prompts.map((p) => p.key);
    assert.deepStrictEqual(keys, ['step-1.1', 'step-1.2', 'testing', 'risk', 'overview']);
    assert.strictEqual(prompts[prompts.length - 1].key, 'overview', 'overview is last');
    // step prompt carries the step action + details
    assert.ok(prompts[0].prompt.includes('Do the first thing'));
    assert.ok(prompts[0].prompt.includes('wire the helper'));
    // absent Rollback section produces no prompt
    assert.ok(!keys.includes('rollback'));
    // overview references the plan title + status
    assert.ok(prompts[4].prompt.includes('Sample Plan'));
  });

  it('falls back to holistic analysis prompts when there is no step table', () => {
    const prompts = buildReviewPrompts(PLAN_NO_STEPS);
    const keys = prompts.map((p) => p.key);
    assert.deepStrictEqual(keys, ['goal', 'steps', 'gaps', 'preconditions', 'overview']);
  });
});

describe('plan-review-live — runLiveReview', () => {
  it('sends prompts sequentially, awaiting idle between each, in order', async () => {
    const prompts: ReviewPrompt[] = [
      { key: 'a', label: 'A', prompt: 'PA' },
      { key: 'b', label: 'B', prompt: 'PB' },
      { key: 'c', label: 'C', prompt: 'PC' },
    ];
    const trace: string[] = [];
    let outstanding = 0; // must be 0 between a send and its idle (no interleave)

    await runLiveReview('ses_x', prompts, {
      systemPrompt: 'You are a reviewer.',
      send: async (sid, text) => {
        assert.strictEqual(sid, 'ses_x');
        assert.strictEqual(outstanding, 0, 'previous turn must have gone idle before the next send');
        outstanding++;
        trace.push(`send:${text.split('\n').pop()}`); // last line = the prompt body
      },
      awaitIdle: async () => {
        assert.strictEqual(outstanding, 1, 'idle awaited only after a send');
        outstanding--;
        trace.push('idle');
      },
    });

    assert.deepStrictEqual(trace, ['send:PA', 'idle', 'send:PB', 'idle', 'send:PC', 'idle']);
  });

  it('prepends the reviewer persona to the FIRST prompt only', async () => {
    const sent: string[] = [];
    await runLiveReview(
      'ses_y',
      [
        { key: 'a', label: 'A', prompt: 'FIRST' },
        { key: 'b', label: 'B', prompt: 'SECOND' },
      ],
      {
        systemPrompt: 'PERSONA',
        send: async (_sid, text) => void sent.push(text),
        awaitIdle: async () => {},
      },
    );
    assert.ok(sent[0].startsWith('PERSONA\n\n'), 'first prompt is persona-prefixed');
    assert.ok(sent[0].includes('FIRST'));
    assert.strictEqual(sent[1], 'SECOND', 'later prompts are not persona-prefixed');
  });

  it('reports each turn via onTurn', async () => {
    const turns: number[] = [];
    await runLiveReview(
      'ses_z',
      [{ key: 'a', label: 'A', prompt: 'x' }, { key: 'b', label: 'B', prompt: 'y' }],
      { send: async () => {}, awaitIdle: async () => {}, onTurn: (i) => turns.push(i) },
    );
    assert.deepStrictEqual(turns, [0, 1]);
  });
});
