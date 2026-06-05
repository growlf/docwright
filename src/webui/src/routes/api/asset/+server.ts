import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

const MIME: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  pdf: 'application/pdf',
};

export function GET({ url }) {
  const filePath = url.searchParams.get('path');
  if (!filePath) return new Response('missing path', { status: 400 });

  const resolved = path.resolve(REPO_ROOT, filePath);
  if (!resolved.startsWith(REPO_ROOT)) return new Response('forbidden', { status: 403 });
  if (!fs.existsSync(resolved)) return new Response('not found', { status: 404 });

  const ext = resolved.split('.').pop()?.toLowerCase() ?? '';
  const contentType = MIME[ext] ?? 'application/octet-stream';
  const data = fs.readFileSync(resolved);

  return new Response(data, {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' },
  });
}
