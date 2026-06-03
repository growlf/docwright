import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

// Search order: active first, then archived
const SEARCH_DIRS = [
  'proposals',
  'proposals/approved',
  'plans',
  'plans/completed',
  'docs',
  'docs/SOPs',
  'policies',
  'policies/core',
];

export function GET({ url }) {
  const name = url.searchParams.get('name');
  if (!name) return json({ path: null });

  const slug = name.toLowerCase().replace(/\.md$/, '');

  for (const dir of SEARCH_DIRS) {
    const full = path.join(REPO_ROOT, dir);
    if (!fs.existsSync(full)) continue;
    for (const file of fs.readdirSync(full)) {
      if (!file.endsWith('.md')) continue;
      const stem = file.replace(/\.md$/, '').toLowerCase();
      if (stem === slug) {
        return json({ path: path.join(dir, file) });
      }
    }
  }

  return json({ path: null });
}
