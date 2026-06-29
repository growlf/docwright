import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';

const REPO = process.env.DOCWRIGHT_ROOT ?? resolve(process.cwd(), '../..');

export const POST = requireAuth(async () => {
  // Stage all tracked modifications (git add -u — does not add untracked files)
  const result = spawnSync('git', ['add', '-u'], {
    cwd: REPO,
    encoding: 'utf-8',
  });

  if (result.status !== 0) {
    const output = (result.stdout + result.stderr).trim();
    return json({ error: output || 'Stage failed' }, { status: 422 });
  }

  return json({ ok: true });
});
