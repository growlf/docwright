import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { rebuildRelationships } from '../../../../../dispatch/relationships';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

function isLifecycleDoc(filePath: string): boolean {
  return /^(proposals\/|plans\/)/.test(filePath);
}

function isPlanDoc(filePath: string): boolean {
  return /^plans\/(?!completed\/)/.test(filePath);
}

function hasTestingPlan(content: string): boolean {
  const m = content.match(/^##\s+Testing Plan\s*\n([\s\S]*?)(?=^##\s|\n*$)/m);
  if (!m) return false;
  const section = m[1].trim();
  return section !== '' && section !== '_Add test plan during implementation._';
}

function updateTestsDefined(filePath: string, resolved: string, content: string): void {
  if (!isPlanDoc(filePath)) return;
  const testsVal = hasTestingPlan(content) ? 'true' : 'false';
  // Replace or add tests_defined in frontmatter
  const raw = fs.readFileSync(resolved, 'utf-8');
  const updated = raw.replace(/^(tests_defined:\s*).+$/m, `$1${testsVal}`);
  if (updated !== raw) fs.writeFileSync(resolved, updated);
}

export async function POST({ url, request }) {
  const filePath = url.searchParams.get('path');
  if (!filePath) return json({ error: 'missing path' }, { status: 400 });

  const resolved = path.resolve(REPO_ROOT, filePath);
  if (!resolved.startsWith(REPO_ROOT)) return json({ error: 'invalid path' }, { status: 403 });

  const { content } = await request.json();
  if (content === undefined) return json({ error: 'missing content' }, { status: 400 });

  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(resolved, content, 'utf-8');

  // Auto-detect tests_defined for plan docs
  updateTestsDefined(filePath, resolved, content);

  // Trigger async relationship map rebuild for lifecycle docs
  if (isLifecycleDoc(filePath)) {
    setTimeout(() => {
      try { rebuildRelationships(REPO_ROOT); }
      catch { /* non-blocking — don't break the save response */ }
    }, 0);
  }

  return json({ ok: true, path: filePath });
}
