import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

export function GET() {
  const brandFile = path.join(REPO_ROOT, 'brand.json');
  let name = path.basename(REPO_ROOT);
  let logoPath: string | null = null;

  if (fs.existsSync(brandFile)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(brandFile, 'utf-8'));
      if (cfg.name) name = String(cfg.name);
      if (cfg.logoPath) {
        const full = path.join(REPO_ROOT, String(cfg.logoPath));
        if (full.startsWith(REPO_ROOT) && fs.existsSync(full)) {
          logoPath = String(cfg.logoPath);
        }
      }
    } catch { /* malformed brand.json — use defaults */ }
  }

  return json({ name, logoPath, vaultPath: REPO_ROOT });
}
