import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

export const DELETE = requireAuth(async ({ url }) => {
  const filePath = url.searchParams.get('path');
  if (!filePath) return json({ error: 'missing path' }, { status: 400 });

  const resolved = path.resolve(REPO_ROOT, filePath);
  if (!resolved.startsWith(REPO_ROOT)) return json({ error: 'invalid path' }, { status: 403 });
  if (!fs.existsSync(resolved)) return json({ error: 'not found' }, { status: 404 });

  fs.unlinkSync(resolved);
  return json({ ok: true, path: filePath });
});
