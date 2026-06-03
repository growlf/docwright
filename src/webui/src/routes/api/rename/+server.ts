import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

export async function POST({ request }) {
  const body = await request.json().catch(() => null);
  if (!body?.from || !body?.to)
    return json({ error: 'missing from/to' }, { status: 400 });

  const { from, to } = body as { from: string; to: string };

  const absFrom = path.resolve(REPO_ROOT, from);
  const absTo   = path.resolve(REPO_ROOT, to);

  if (!absFrom.startsWith(REPO_ROOT + path.sep) || !absTo.startsWith(REPO_ROOT + path.sep))
    return json({ error: 'invalid path' }, { status: 403 });

  if (!fs.existsSync(absFrom))
    return json({ error: 'not found' }, { status: 404 });

  if (fs.existsSync(absTo))
    return json({ error: 'conflict — file already exists' }, { status: 409 });

  fs.mkdirSync(path.dirname(absTo), { recursive: true });

  // Use git mv to preserve history; fall back to fs.rename for untracked files
  const result = spawnSync('git', ['mv', absFrom, absTo], { cwd: REPO_ROOT });
  if (result.status !== 0) {
    try { fs.renameSync(absFrom, absTo); }
    catch (e: any) { return json({ error: e.message }, { status: 500 }); }
  }

  return json({ path: to });
}
