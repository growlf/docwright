/**
 * executor-live — the LIVE StepTransport for the plan executor (live-ai 3.5).
 *
 * Injected into the executor's runStepSession by /api/plan-execute when
 * LIVE_AI_EXECUTOR is on. The executor's control flow (retries, timeout, marker
 * parsing, WAITING follow-ups) is unchanged — this only swaps HOW a session is
 * created and a turn is sent:
 *   - createSession → an OWNED session (ai-sessions registry) so the panel may
 *     stream it via /api/ai/stream under the executing user's ownership.
 *   - send → prompt_async (events flow on the /event bus) + await session.idle,
 *     with a private activity model accumulating the turn so we can hand the
 *     executor the final assistant text for STEP DONE / WAITING / STEP FAILED
 *     marker parsing. The browser renders the same turn live via its own
 *     independent /api/ai/stream subscription.
 */

import type { StepTransport } from '../../../../executor/session';
import { createOwnedSession } from './ai-sessions';
import { sendPromptAsync, waitForIdle } from './plan-review-live';
import { subscribe, unsubscribe, type OpencodeEvent } from './opencode-events';
import { createActivityModel, textFor } from '../agent-activity-model';

export interface LiveExecutorOpts {
  /** Owning user (must match whoever opens /api/ai/stream). */
  owner: string;
  /** Plan path recorded on the owned session. */
  docPath?: string | null;
  /** "provider/modelID" from opencode.json, if any. */
  model?: string;
  /** Per-turn idle timeout ms — pass the executor's stepTimeout so long steps
   *  aren't cut short by waitForIdle's short default. */
  idleTimeoutMs?: number;
}

export function createLiveExecutorTransport(opts: LiveExecutorOpts): StepTransport {
  let modelObj: { id: string; providerID: string } | undefined;
  if (opts.model) {
    const s = opts.model.indexOf('/');
    if (s > 0) modelObj = { providerID: opts.model.slice(0, s), id: opts.model.slice(s + 1) };
  }

  return {
    async createSession() {
      const rec = await createOwnedSession({
        user: opts.owner,
        feature: 'executor',
        docPath: opts.docPath ?? null,
        model: modelObj,
      });
      return rec.sessionID;
    },
    async send(sessionId, text) {
      // Private model captures THIS turn's events for marker parsing; a fresh one
      // per send so multi-turn (WAITING follow-up) reads only the latest turn.
      const model = createActivityModel();
      const cb = (e: OpencodeEvent) => model.apply(e);
      subscribe(sessionId, cb);
      try {
        await sendPromptAsync(sessionId, text);
        await waitForIdle(sessionId, opts.idleTimeoutMs);
      } finally {
        unsubscribe(sessionId, cb);
      }
      return textFor(model.state(), 'assistant');
    },
  };
}
