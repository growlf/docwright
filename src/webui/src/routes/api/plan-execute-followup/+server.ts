import { json } from '@sveltejs/kit';
import { resolveWaiting, rejectWaiting } from '../../../../../executor/waiting';

export async function POST({ request }) {
  const { sessionId, message, error } = await request.json();
  if (!sessionId) return json({ error: 'missing sessionId' }, { status: 400 });

  if (error) {
    const found = rejectWaiting(sessionId, error);
    if (!found) return json({ error: 'no waiting prompt found for session' }, { status: 404 });
    return json({ ok: true });
  }

  if (!message) return json({ error: 'missing message' }, { status: 400 });

  const found = resolveWaiting(sessionId, message);
  if (!found) return json({ error: 'no waiting prompt found for session' }, { status: 404 });
  return json({ ok: true });
}
