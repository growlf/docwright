import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';

const REPO = process.env.DOCWRIGHT_ROOT ?? resolve(process.cwd(), '../..');

export const POST = requireAuth(async ({ request }) => {
  // Optional selective staging: { paths: string[] }
  // Without paths: git add -u (stage all tracked modifications)
  let paths: string[] | null = null;
  try {
    const body = await request.json();
    if (Array.isArray(body?.paths) && body.paths.length > 0) {
      paths = (body.paths as unknown[])
        .filter((p): p is string => typeof p === 'string')
        .filter(p => {
          if (p.startsWith('/')) return false;
          const abs = join(REPO, p);
          return abs.startsWith(REPO + '/');
        });
    }
  } catch { /* no body — use git add -u */ }

  const args = paths ? ['add', '--', ...paths] : ['add', '-u'];
  const result = spawnSync('git', args, { cwd: REPO, encoding: 'utf-8' });

  if (result.status !== 0) {
    const output = (result.stdout + result.stderr).trim();
    return json({ error: output || 'Stage failed' }, { status: 422 });
  }

  return json({ ok: true });
});
