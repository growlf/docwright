import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

function scan(dir: string, base: string, all: boolean): any[] {
  const entries: any[] = [];
  try {
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith('.') || name === 'node_modules') continue;
      const full = path.join(dir, name);
      const rel = base ? `${base}/${name}` : name;
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        const children = scan(full, rel, all);
        if (children.length > 0) entries.push({ name, path: rel, type: 'dir', children });
      } else if (all || name.endsWith('.md')) {
        entries.push({ name, path: rel, type: 'file' });
      }
    }
  } catch { /* ignore unreadable entries */ }
  return entries;
}

export function GET({ url }) {
  const all = url.searchParams.get('all') === '1';
  return json(scan(REPO_ROOT, '', all));
}
