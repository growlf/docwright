/**
 * ai-stream — the core of the authenticated per-session AI event stream.
 *
 * Live AI Visibility plan (live-ai-visibility-event-relay.md) step 2.3. Relays a
 * single OpenCode session's events (from the 2.1 bus) to one browser over SSE,
 * gated by ownership (2.2) and a per-user concurrency cap. The SvelteKit route
 * (routes/api/ai/stream/+server.ts) is a thin requireAuth wrapper around this;
 * all logic lives here so it is unit/integration-testable without the $lib alias
 * or a running SvelteKit server.
 *
 * Guarantees:
 *  - 400 if no session param, 403 unless the session's recorded owner matches the
 *    authenticated user, 429 once the user holds `maxPerUser` concurrent streams.
 *  - Only that session's events reach the client (filtered by the bus per
 *    sessionID) — no cross-session bleed, order preserved.
 *  - 15s `: keepalive` comments + `X-Accel-Buffering: no` so proxies don't kill
 *    the idle connection (plan Constraint 5).
 *  - On client disconnect the stream's cancel() unsubscribes from the bus and
 *    releases the user's slot — no leaked listeners, no cap leak.
 */

import { getSession as getOwnedSession } from './ai-sessions';
import { subscribe as busSubscribe, unsubscribe as busUnsubscribe, type OpencodeEvent } from './opencode-events';

type EventCb = (event: OpencodeEvent) => void;

export interface AiStreamerDeps {
  /** Ownership lookup (default: shared ai-sessions registry). */
  getSession?: (id: string) => { owner: string } | undefined;
  /** Bus subscribe (default: shared opencode-events bus). */
  subscribe?: (id: string, cb: EventCb) => void;
  /** Bus unsubscribe (default: shared opencode-events bus). */
  unsubscribe?: (id: string, cb: EventCb) => void;
  /** Keepalive interval ms (default 15_000). */
  keepaliveMs?: number;
  /** Max concurrent streams per user (default 5). */
  maxPerUser?: number;
}

export interface AiStreamer {
  /** Open a stream for `username` on `sessionID`; returns the SSE Response or an error Response. */
  open(sessionID: string | null | undefined, username: string): Response;
  /** Current open-stream count for a user (observability/tests). */
  activeCount(username: string): number;
}

const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

export function createAiStreamer(deps: AiStreamerDeps = {}): AiStreamer {
  const getSession = deps.getSession ?? getOwnedSession;
  const subscribe = deps.subscribe ?? busSubscribe;
  const unsubscribe = deps.unsubscribe ?? busUnsubscribe;
  const keepaliveMs = deps.keepaliveMs ?? 15_000;
  const maxPerUser = deps.maxPerUser ?? 5;

  // Per-user concurrent-stream counter (single-process; plan Constraint 8).
  const active = new Map<string, number>();

  function open(sessionID: string | null | undefined, username: string): Response {
    if (!sessionID) return new Response('missing session parameter', { status: 400 });

    const owned = getSession(sessionID);
    if (!owned || owned.owner !== username) {
      // Do not distinguish "unknown" from "not yours" — both are 403.
      return new Response('forbidden', { status: 403 });
    }

    const current = active.get(username) ?? 0;
    if (current >= maxPerUser) {
      return new Response('too many concurrent streams', { status: 429 });
    }
    // Reserve the slot now (deterministic across rapid opens).
    active.set(username, current + 1);

    const enc = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let closed = false;
    let released = false;

    function write(chunk: string): void {
      if (closed || !controller) return;
      try {
        controller.enqueue(enc.encode(chunk));
      } catch {
        closed = true;
      }
    }

    const onEvent: EventCb = (evt) => {
      write(`data: ${JSON.stringify(evt)}\n\n`);
    };

    function release(): void {
      if (released) return;
      released = true;
      closed = true;
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      unsubscribe(sessionID as string, onEvent);
      const c = (active.get(username) ?? 1) - 1;
      if (c <= 0) active.delete(username);
      else active.set(username, c);
    }

    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        controller = ctrl;
        write(`: connected ${sessionID}\n\n`);
        subscribe(sessionID as string, onEvent);
        heartbeat = setInterval(() => write(`: keepalive\n\n`), keepaliveMs);
        (heartbeat as unknown as { unref?: () => void }).unref?.();
      },
      cancel() {
        // Client disconnected — clean up listeners and free the slot.
        release();
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  }

  function activeCount(username: string): number {
    return active.get(username) ?? 0;
  }

  return { open, activeCount };
}
