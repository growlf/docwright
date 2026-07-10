/**
 * Unit tests for the live-Improve extraction path (live-ai-visibility 3.4):
 * assistantMessageTexts (pull per-turn answers out of the streamed event log)
 * and stripAIWrapper (clean the improved body before Apply).
 */
import assert from 'assert';
import { reduceEvents, assistantMessageTexts, type ActivityState } from '../../src/webui/src/lib/agent-activity-model';
import { stripAIWrapper } from '../../src/webui/src/lib/ai-text';
import type { OpencodeEvent } from '../../src/webui/src/lib/server/opencode-events';

/** Build a session event log with two assistant turns (improve, critique). */
function twoTurnEvents(): OpencodeEvent[] {
  const ev: OpencodeEvent[] = [];
  // turn 0 — improve
  ev.push({ type: 'message.updated', properties: { info: { id: 'm0', role: 'assistant' } } });
  ev.push({ type: 'message.part.delta', properties: { messageID: 'm0', partID: 'p0', field: 'text', delta: '## Problem\n' } });
  ev.push({ type: 'message.part.updated', properties: { part: { id: 'p0', messageID: 'm0', type: 'text', text: '## Problem\nImproved body.' } } });
  ev.push({ type: 'session.idle', properties: { sessionID: 's' } });
  // turn 1 — critique
  ev.push({ type: 'message.updated', properties: { info: { id: 'm1', role: 'assistant' } } });
  ev.push({ type: 'message.part.updated', properties: { part: { id: 'p1', messageID: 'm1', type: 'text', text: 'Critique: add security section.' } } });
  ev.push({ type: 'session.idle', properties: { sessionID: 's' } });
  return ev;
}

describe('live-improve — assistantMessageTexts', () => {
  it('returns one entry per assistant turn, in order', () => {
    const state: ActivityState = reduceEvents(twoTurnEvents());
    const msgs = assistantMessageTexts(state);
    assert.strictEqual(msgs.length, 2);
    assert.strictEqual(msgs[0], '## Problem\nImproved body.');
    assert.strictEqual(msgs[1], 'Critique: add security section.');
  });

  it('full-mode extraction: improved = turn 0 (cleaned), critique = turn 1', () => {
    const msgs = assistantMessageTexts(reduceEvents(twoTurnEvents()));
    const improved = stripAIWrapper(msgs[0] ?? '');
    const critique = (msgs[1] ?? '').trim();
    assert.ok(improved.startsWith('## Problem'));
    assert.strictEqual(critique, 'Critique: add security section.');
  });

  it('critique-mode extraction: critique = turn 0, improved empty', () => {
    // one-turn log
    const ev: OpencodeEvent[] = [
      { type: 'message.updated', properties: { info: { id: 'm0', role: 'assistant' } } },
      { type: 'message.part.updated', properties: { part: { id: 'p0', messageID: 'm0', type: 'text', text: 'Just a critique.' } } },
      { type: 'session.idle', properties: { sessionID: 's' } },
    ];
    const msgs = assistantMessageTexts(reduceEvents(ev));
    assert.strictEqual(msgs.length, 1);
    assert.strictEqual((msgs[0] ?? '').trim(), 'Just a critique.');
  });
});

describe('live-improve — stripAIWrapper', () => {
  it('unwraps a whole-response markdown code fence', () => {
    assert.strictEqual(stripAIWrapper('```markdown\n## A\nbody\n```'), '## A\nbody');
    assert.strictEqual(stripAIWrapper('```\n## A\nbody\n```'), '## A\nbody');
  });

  it('strips a short preamble before the first heading', () => {
    assert.strictEqual(stripAIWrapper("Sure, here's the improved body:\n\n## Problem\nx"), '## Problem\nx');
  });

  it('leaves clean markdown untouched', () => {
    assert.strictEqual(stripAIWrapper('## Problem\nAlready clean.'), '## Problem\nAlready clean.');
  });

  it('is null/undefined safe', () => {
    assert.strictEqual(stripAIWrapper(undefined as any), '');
    assert.strictEqual(stripAIWrapper(''), '');
  });
});
