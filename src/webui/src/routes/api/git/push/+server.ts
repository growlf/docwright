import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';

const REPO = process.env.DOCWRIGHT_ROOT ?? resolve(process.cwd(), '../..');

export const POST = requireAuth(async () => {
  const result = spawnSync('git', ['push'], {
    cwd: REPO,
    encoding: 'utf-8',
  });

  const output = (result.stdout + result.stderr).trim();

  if (result.status !== 0) {
    const hint = output.includes('non-fast-forward')
      ? 'Rejected — remote has changes. Pull first.'
      : output.includes('no upstream')
      ? 'No upstream configured for this branch.'
      : output;
    return json({ error: hint }, { status: 422 });
  }

  return json({ ok: true, output });
});
