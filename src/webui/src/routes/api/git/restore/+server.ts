import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';

const REPO = process.env.DOCWRIGHT_ROOT ?? resolve(process.cwd(), '../..');

export const POST = requireAuth(async ({ request }) => {
  let body: { paths?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(body?.paths) || body.paths.length === 0) {
    return json({ error: 'paths array required' }, { status: 400 });
  }

  const paths = (body.paths as unknown[])
    .filter((p): p is string => typeof p === 'string')
    .filter(p => {
      if (p.startsWith('/')) return false;
      const abs = join(REPO, p);
      return abs.startsWith(REPO + '/');
    });

  if (paths.length === 0) {
    return json({ ok: true, restored: 0 });
  }

  // If staged flag is true: git restore --staged -- <paths>
  // Otherwise: git checkout HEAD -- <paths> (reverts working tree)
  const isStaged = !!(body as any)?.staged;
  const args = isStaged
    ? ['restore', '--staged', '--', ...paths]
    : ['checkout', 'HEAD', '--', ...paths];

  const result = spawnSync('git', args, {
    cwd: REPO,
    encoding: 'utf-8',
  });

  if (result.status !== 0) {
    const output = (result.stdout + result.stderr).trim();
    return json({ error: output || 'Restore failed' }, { status: 422 });
  }

  return json({ ok: true, restored: paths.length });
});
