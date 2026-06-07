import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

const DEFAULT_REL = {
  auto_detect_on_create: true,
  auto_detect_on_update: true,
  auto_detect_on_approval: true,
  similarity_threshold: 0.35,
  show_plan_button: true,
};

export async function GET() {
  // Try active profile (vault root or bundled)
  const vaultPath = path.join(REPO_ROOT, 'profile.json');
  const bundledPath = path.resolve(REPO_ROOT, 'src/profiles/org-operations/profile.json');

  let profile: any = null;
  for (const p of [vaultPath, bundledPath]) {
    if (fs.existsSync(p)) {
      try { profile = JSON.parse(fs.readFileSync(p, 'utf-8')); break; }
      catch { /* try next */ }
    }
  }

  const rel = profile?.relationshipEngine ?? DEFAULT_REL;
  return json({
    features: profile?.features ?? {},
    relationshipEngine: rel,
  });
}
