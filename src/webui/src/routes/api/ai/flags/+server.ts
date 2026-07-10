/**
 * GET /api/ai/flags — reports the LIVE_AI_* surface flags to the client. Only
 * `chat` is client-consumed (ChatPanel talks to OpenCode directly via the proxy,
 * so it must decide client-side whether to send via prompt_async); the other
 * surfaces are gated server-side in their own routes. Booleans only — not
 * sensitive, no auth needed. (live-ai-visibility 3.3)
 */
import { json } from '@sveltejs/kit';

const on = (v: string | undefined, defaultOn: boolean) => {
  const s = (v ?? '').toLowerCase();
  if (defaultOn) return !['0', 'false', 'off', 'no'].includes(s);
  return ['1', 'true', 'on', 'yes'].includes(s);
};

export function GET() {
  return json({
    // chat: default ON after its live smoke passed (2026-07-10); LIVE_AI_CHAT=0 reverts.
    chat: on(process.env.LIVE_AI_CHAT, true),
    review: on(process.env.LIVE_AI_REVIEW, true),
    improve: on(process.env.LIVE_AI_IMPROVE, true),
    executor: on(process.env.LIVE_AI_EXECUTOR, true),
  });
}
