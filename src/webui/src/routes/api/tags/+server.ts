import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

const SCAN_DIRS = [
  'proposals', 'proposals/approved',
  'plans', 'plans/completed',
  'policies', 'policies/core', 'policies/program-areas',
  'docs', 'docs/SOPs',
];

function parseTags(raw: string): string[] {
  const m = raw.match(/^---\n[\s\S]*?\n---/);
  if (!m) return [];
  const fm = m[0];
  const tagsBlock = fm.match(/^tags:\s*\n((?:\s+-\s+.+\n?)*)/m);
  if (tagsBlock) {
    return tagsBlock[1]
      .split('\n')
      .map(l => l.replace(/^\s+-\s*/, '').trim())
      .filter(Boolean);
  }
  const inline = fm.match(/^tags:\s*\[(.+)\]/m);
  if (inline) {
    return inline[1].split(',').map(t => t.replace(/["'\s]/g, '')).filter(Boolean);
  }
  return [];
}

let cache: { data: any; at: number } | null = null;

export function GET() {
  if (cache && Date.now() - cache.at < 10_000) return json(cache.data);

  const counts = new Map<string, number>();

  for (const dir of SCAN_DIRS) {
    const fullDir = path.join(REPO_ROOT, dir);
    if (!fs.existsSync(fullDir)) continue;
    for (const file of fs.readdirSync(fullDir)) {
      if (!file.endsWith('.md')) continue;
      try {
        const raw = fs.readFileSync(path.join(fullDir, file), 'utf-8');
        for (const tag of parseTags(raw)) {
          counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
      } catch { /* skip */ }
    }
  }

  const tags = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => ({ tag, count }));

  const data = { tags };
  cache = { data, at: Date.now() };
  return json(data);
}
