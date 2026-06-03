import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

export function GET() {
  const brandFile = path.join(REPO_ROOT, 'brand.json');
  if (!fs.existsSync(brandFile)) return new Response(null, { status: 404 });

  try {
    const cfg = JSON.parse(fs.readFileSync(brandFile, 'utf-8'));
    if (!cfg.logoPath) return new Response(null, { status: 404 });
    const full = path.join(REPO_ROOT, String(cfg.logoPath));
    if (!full.startsWith(REPO_ROOT) || !fs.existsSync(full)) return new Response(null, { status: 404 });
    const svg = fs.readFileSync(full, 'utf-8');
    return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
  } catch {
    return new Response(null, { status: 404 });
  }
}
