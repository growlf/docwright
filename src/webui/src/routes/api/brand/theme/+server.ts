import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

export function GET() {
  const themePath = path.join(REPO_ROOT, 'brand', 'theme.css');
  if (!themePath.startsWith(REPO_ROOT) || !fs.existsSync(themePath)) {
    // Return empty CSS with long cache so the browser doesn't hammer this
    return new Response('', {
      headers: {
        'Content-Type': 'text/css',
        'Cache-Control': 'public, max-age=60',
      },
    });
  }
  const css = fs.readFileSync(themePath, 'utf-8');
  return new Response(css, {
    headers: {
      'Content-Type': 'text/css',
      'Cache-Control': 'no-cache', // theme changes should reflect immediately
    },
  });
}
