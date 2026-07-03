import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { scanPlugins } from '$lib/server/plugins.js';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

const SEARCH_DIRS = [
  'proposals',
  'proposals/approved',
  'plans',
  'plans/completed',
  'policies',
  'policies/core',
  'policies/program-areas',
  'docs',
  'docs/SOPs',
];

const TYPE_MAP: Record<string, string> = {
  'proposals/approved': 'approved-proposal',
  'proposals': 'proposal',
  'plans/completed': 'completed-plan',
  'plans': 'plan',
  'policies/core': 'policy',
  'policies/program-areas': 'policy',
  'policies': 'policy',
  'docs/SOPs': 'sop',
  'docs': 'doc',
};

interface SearchResult {
  path: string;
  title: string;
  type: string;
  excerpt: string;
  score: number;
  badge?: string;
  badgeColor?: string;
  tags?: string[];
}

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

function extractTitle(content: string, filename: string): string {
  const m = content.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  if (m) return m[1].trim();
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return filename.replace(/\.md$/, '').replace(/-/g, ' ');
}

function extractExcerpt(content: string, query: string, maxLen = 160): string {
  const lower = content.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return content.slice(0, maxLen).replace(/\n/g, ' ') + '…';
  const start = Math.max(0, idx - 60);
  const end = Math.min(content.length, idx + query.length + 100);
  const snippet = content.slice(start, end).replace(/\n+/g, ' ').trim();
  return (start > 0 ? '…' : '') + snippet + (end < content.length ? '…' : '');
}

function scoreMatch(content: string, title: string, query: string): number {
  const q = query.toLowerCase();
  const t = title.toLowerCase();
  const c = content.toLowerCase();
  let score = 0;
  if (t.includes(q)) score += 10;
  const bodyMatches = (c.match(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  score += bodyMatches;
  return score;
}

export async function GET({ url, fetch }: { url: URL; fetch: typeof window.fetch }) {
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length < 2) return json({ results: [] });

  const isTagSearch = q.startsWith('#') || q.startsWith('tag:');
  const targetTag = isTagSearch 
    ? (q.startsWith('#') ? q.slice(1) : q.slice(4)).trim().toLowerCase()
    : '';

  const results: SearchResult[] = [];

  // Query active plugins that have search capability
  try {
    const activePlugins = scanPlugins().filter(p => p.manifest.hasSearch);
    for (const plugin of activePlugins) {
      const res = await fetch(`/api/plugin/${plugin.manifest.name}/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const pluginResults = await res.json();
        for (const pr of pluginResults) {
          results.push({
            path: pr.route,
            title: pr.title,
            type: plugin.manifest.name,
            excerpt: pr.excerpt,
            score: 8, // Set a solid priority score for plugin matches
            badge: pr.badge,
            badgeColor: pr.badgeColor,
          });
        }
      }
    }
  } catch (e) {
    console.error('[DocWright] Failed to search plugins:', e);
  }

  for (const dir of SEARCH_DIRS) {
    const fullDir = path.join(REPO_ROOT, dir);
    if (!fs.existsSync(fullDir)) continue;

    for (const file of fs.readdirSync(fullDir)) {
      if (!file.endsWith('.md') || file === 'misc.md') continue;
      const fullPath = path.join(fullDir, file);
      let content: string;
      try { content = fs.readFileSync(fullPath, 'utf-8'); } catch { continue; }

      const title = extractTitle(content, file);
      const fileTags = parseTags(content);

      let score = 0;
      if (isTagSearch) {
        if (fileTags.map(t => t.toLowerCase()).includes(targetTag)) {
          score = 100;
        } else {
          continue;
        }
      } else {
        score = scoreMatch(content, title, q);
        if (score === 0) continue;
      }

      results.push({
        path: path.join(dir, file),
        title,
        type: TYPE_MAP[dir] ?? 'doc',
        excerpt: extractExcerpt(content, isTagSearch ? targetTag : q),
        score,
        tags: fileTags,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);

  return json({ results: results.slice(0, 30) });
}
