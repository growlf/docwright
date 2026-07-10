/**
 * GET /api/ai/presence — authenticated SSE stream of the current user's live-AI
 * presence (live-ai-visibility 3.6). Taps the whole /event bus, filters to the
 * user's owned sessions, and emits `{busy, count}` whenever it changes. Feeds the
 * toolbar busy/idle chip.
 */
import { requireAuth } from '$lib/server/auth.js';
import { subscribeAll, unsubscribeAll, type OpencodeEvent } from '$lib/server/opencode-events.js';
import { getSession } from '$lib/server/ai-sessions.js';
import { createPresenceTracker } from '$lib/server/ai-presence.js';

export const GET = requireAuth(async ({ locals }) => {
  const user = locals.user!;
  const tracker = createPresenceTracker((sid) => getSession(sid)?.owner === user.username);
  const enc = new TextEncoder();

  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  function write(chunk: string): void {
    if (closed || !controller) return;
    try {
      controller.enqueue(enc.encode(chunk));
    } catch {
      closed = true;
    }
  }
  function emit(): void {
    write(`data: ${JSON.stringify(tracker.snapshot())}\n\n`);
  }
  const onEvent = (e: OpencodeEvent) => {
    if (tracker.apply(e)) emit();
  };

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
      write(': connected\n\n');
      emit(); // initial state
      subscribeAll(onEvent);
      heartbeat = setInterval(() => write(': keepalive\n\n'), 15_000);
      (heartbeat as unknown as { unref?: () => void }).unref?.();
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribeAll(onEvent);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});
