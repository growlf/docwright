import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { json } from '@sveltejs/kit';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

export function GET({ url }) {
  const filePath = url.searchParams.get('path');
  if (!filePath) return json({ error: 'missing path' }, { status: 400 });

  const resolved = path.resolve(REPO_ROOT, filePath);
  if (!resolved.startsWith(REPO_ROOT)) return json({ error: 'invalid path' }, { status: 403 });
  if (!fs.existsSync(resolved)) return json({ error: 'not found' }, { status: 404 });

  const content = fs.readFileSync(resolved, 'utf-8');
  const etag = `"${createHash('sha256').update(content).digest('hex').slice(0, 16)}"`;

  return new Response(JSON.stringify({ path: filePath, content }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ETag: etag,
      'Cache-Control': 'no-cache',
    },
  });
}
