import { json } from '@sveltejs/kit';
import { getStatus, getLog, startOpenCode, stopOpenCode } from '$lib/server/opencode-manager';

/** GET /api/opencode-process — current status */
export function GET() {
  return json({ status: getStatus(), log: getLog() });
}

/** POST /api/opencode-process — start or stop */
export async function POST({ request }) {
  const { action } = await request.json().catch(() => ({ action: 'start' }));

  if (action === 'stop') {
    const status = getStatus();
    if (status !== 'running-ours') {
      return json({ ok: false, message: 'Cannot stop: OpenCode was not started by DocWright' }, { status: 400 });
    }
    stopOpenCode();
    return json({ ok: true, status: getStatus(), message: 'OpenCode stopped' });
  }

  // Default: start
  const result = await startOpenCode();
  return json(result, { status: result.ok ? 200 : 503 });
}
