/**
 * GET /api/ai/stream?session=<id>
 *
 * Authenticated per-session AI event stream (live-ai-visibility step 2.3).
 * requireAuth-wrapped; all logic lives in $lib/server/ai-stream so it is
 * testable without a running SvelteKit server. The owner key is the
 * authenticated user's `username` — the same identifier the producers (3.x)
 * pass to createOwnedSession({ user }).
 */
import { requireAuth } from '$lib/server/auth.js';
import { createAiStreamer } from '$lib/server/ai-stream.js';

// One streamer per server process (holds the per-user concurrency counter).
const streamer = createAiStreamer();

export const GET = requireAuth(async ({ url, locals }) => {
  return streamer.open(url.searchParams.get('session'), locals.user!.username);
});
