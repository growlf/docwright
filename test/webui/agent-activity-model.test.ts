/**
 * Unit tests for the AgentActivityView state model (live-ai-visibility 3.1):
 * fixture-driven ordering + progressive growth, lossy-fixture self-heal
 * (byte-identical convergence per Constraint 9), and bus-gap convergence.
 */
import assert from 'assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  createActivityModel,
  reduceEvents,
  textFor,
  reasoningText,
  type ActivityState,
} from '../../src/webui/src/lib/agent-activity-model';
import type { OpencodeEvent } from '../../src/webui/src/lib/server/opencode-events';

const FIX = path.resolve(__dirname, '../fixtures/opencode-events');
function loadEvents(name: string): OpencodeEvent[] {
  return fs
    .readFileSync(path.join(FIX, name), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

describe('agent-activity-model — fixture ordering & roles', () => {
  it('renders parts in first-seen order with correct roles (plain-text)', () => {
    const state = reduceEvents(loadEvents('plain-text.jsonl'));
    const types = state.parts.map((p) => p.type);
    assert.deepStrictEqual(types, ['text', 'step-start', 'reasoning', 'text', 'step-finish']);
    // first text part is the user prompt, the later one the assistant answer
    const textParts = state.parts.filter((p) => p.type === 'text');
    assert.strictEqual(textParts[0].role, 'user');
    assert.strictEqual(textParts[1].role, 'assistant');
    assert.strictEqual(state.status, 'idle', 'session.idle → idle');
    assert.ok(textFor(state, 'assistant').length > 0, 'assistant answer present');
    assert.ok(reasoningText(state).length > 0, 'reasoning present');
  });

  it('captures the tool lifecycle final state (tool-use)', () => {
    const state = reduceEvents(loadEvents('tool-use.jsonl'));
    const tools = state.parts.filter((p) => p.type === 'tool');
    assert.ok(tools.length >= 1, 'at least one tool part');
    // tool parts reconcile to their terminal snapshot state
    assert.ok(tools.every((t) => t.toolState === 'completed'), 'tools end completed');
    assert.ok(tools.some((t) => t.tool === 'glob' || t.tool === 'read'), 'named tools present');
  });
});

describe('agent-activity-model — progressive growth', () => {
  it('assistant text grows incrementally, not all-at-once', () => {
    const events = loadEvents('plain-text.jsonl');
    const model = createActivityModel();
    const lengths: number[] = [];
    for (const e of events) {
      model.apply(e);
      lengths.push(textFor(model.state(), 'assistant').length);
    }
    const final = lengths[lengths.length - 1];
    assert.ok(final > 0, 'ends non-empty');
    // non-decreasing
    for (let i = 1; i < lengths.length; i++) {
      assert.ok(lengths[i] >= lengths[i - 1], `length must not shrink at ${i}`);
    }
    // progressive: there is at least one mid-stream sample strictly between 0 and final
    assert.ok(
      lengths.some((l) => l > 0 && l < final),
      'text appears in partial increments (not a single jump to final)',
    );
    // and distinct growth values (more than 2) — genuine streaming
    assert.ok(new Set(lengths.filter((l) => l > 0)).size >= 3, 'multiple distinct growth steps');
  });
});

describe('agent-activity-model — lossy self-heal (Constraint 9)', () => {
  it('lossy stream converges byte-identically to the lossless render', () => {
    const lossless = reduceEvents(loadEvents('plain-text.jsonl'));
    const lossy = reduceEvents(loadEvents('plain-text-lossy.jsonl'));

    // sanity: the lossy fixture really did drop deltas
    const rawLossless = loadEvents('plain-text.jsonl').filter((e) => e.type === 'message.part.delta').length;
    const rawLossy = loadEvents('plain-text-lossy.jsonl').filter((e) => e.type === 'message.part.delta').length;
    assert.ok(rawLossy < rawLossless, `lossy has fewer deltas (${rawLossy} < ${rawLossless})`);

    // the whole render tree is identical
    assert.deepStrictEqual(
      normalize(lossy),
      normalize(lossless),
      'lossy render tree matches lossless',
    );
    // and the assistant answer text is byte-identical and non-empty
    assert.strictEqual(textFor(lossy, 'assistant'), textFor(lossless, 'assistant'));
    assert.ok(textFor(lossless, 'assistant').length > 0);
  });

  function normalize(s: ActivityState) {
    // compare the render-relevant shape, independent of transient flags
    return s.parts.map((p) => ({ id: p.id, role: p.role, type: p.type, text: p.text, tool: p.tool, toolState: p.toolState }));
  }
});

describe('agent-activity-model — bus-gap convergence', () => {
  it('flags a gap, then clears + converges on the next snapshot', () => {
    const model = createActivityModel();
    // user message + assistant message roles
    model.apply({ type: 'message.updated', properties: { info: { id: 'm1', role: 'assistant' } } });
    // partial streaming via deltas
    model.apply({ type: 'message.part.delta', properties: { sessionID: 's', messageID: 'm1', partID: 'p1', field: 'text', delta: 'Hel' } });
    assert.strictEqual(model.state().busGap, false);

    // reconnect gap — some deltas may have been missed
    model.apply({ type: 'bus-gap', properties: { reason: 'reconnected' } });
    assert.strictEqual(model.state().busGap, true, 'gap flagged');

    // the authoritative snapshot arrives and reconciles the full text
    model.apply({
      type: 'message.part.updated',
      properties: { part: { id: 'p1', messageID: 'm1', type: 'text', text: 'Hello, world!' } },
    });
    const st = model.state();
    assert.strictEqual(st.busGap, false, 'gap cleared by snapshot');
    assert.strictEqual(textFor(st, 'assistant'), 'Hello, world!', 'text converged to snapshot despite missed deltas');
  });
});
