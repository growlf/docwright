import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

export async function POST({ url }) {
  const dirPath = url.searchParams.get('path');
  if (!dirPath) return json({ error: 'missing path' }, { status: 400 });

  const resolved = path.resolve(REPO_ROOT, dirPath);
  if (!resolved.startsWith(REPO_ROOT)) return json({ error: 'invalid path' }, { status: 403 });

  if (fs.existsSync(resolved)) return json({ error: 'already exists' }, { status: 409 });

  fs.mkdirSync(resolved, { recursive: true });
  return json({ ok: true, path: dirPath });
}
