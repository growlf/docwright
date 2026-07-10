/**
 * GET /api/ai/bus-status — operator observability for the shared OpenCode /event
 * bus consumer (live-ai-visibility 3.6): connected, lastEventAt, reconnectCount,
 * eventsReceived, eventsRelayed. Surfaced on the vault status page.
 */
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { getBusStatus } from '$lib/server/opencode-events.js';

export const GET = requireAuth(async () => {
  return json(getBusStatus());
});
