import { execSync } from 'node:child_process';
import path from 'node:path';
import { json } from '@sveltejs/kit';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

export async function POST({ url }) {
  const filePath = url.searchParams.get('path');
  if (!filePath) return json({ error: 'missing path' }, { status: 400 });

  try {
    execSync('git restore ' + JSON.stringify(filePath), { cwd: REPO_ROOT });
    return json({ ok: true, path: filePath });
  } catch (e: any) {
    return json({ error: 'restore failed: ' + e.message }, { status: 500 });
  }
}
