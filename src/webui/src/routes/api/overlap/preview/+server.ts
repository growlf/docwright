/**
 * POST /api/overlap/preview
 *
 * Pre-creation duplicate check for short description text (1–3 sentences).
 * Uses keyword overlap against proposal/plan titles, tags, and body first-paragraph
 * rather than the full Jaccard engine (which needs full document content to score well).
 *
 * Body: { description: string }
 * Response: { matches: Array<{path, title, score, type, reason}> }
 */
import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { parseFrontmatter, getFrontmatterTitle, stripFrontmatter } from '../../../../../../dispatch/frontmatter';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT ?? path.resolve(process.cwd(), '../..');
const SCAN_DIRS = ['proposals', 'proposals/approved', 'plans'];

// Common English stop-words to ignore when scoring keyword overlap
const STOP = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by','from',
  'is','are','was','were','be','been','being','have','has','had','do','does','did',
  'will','would','could','should','may','might','can','shall',
  'we','i','you','he','she','it','they','this','that','these','those',
  'not','no','so','if','as','up','out','about','into','than','then',
  'new','add','use','make','need','want','way','also','more','all','any',
]);

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w));
}

function score(descTokens: string[], raw: string): { score: number; reason: string } {
  const fm = parseFrontmatter(raw);
  const title = getFrontmatterTitle(raw);
  const tags: string[] = Array.isArray(fm.tags) ? fm.tags.map(String)
    : typeof fm.tags === 'string' ? fm.tags.split(',').map((t: string) => t.trim())
    : [];

  // First 150 chars of body as additional signal
  const body = stripFrontmatter(raw).slice(0, 200);

  const titleTokens  = tokenize(title);
  const tagTokens    = tags.flatMap(t => tokenize(t));
  const bodyTokens   = tokenize(body);

  const candidateSet = new Set([...titleTokens, ...tagTokens, ...bodyTokens]);
  const descSet = new Set(descTokens);

  const matched = descTokens.filter(w => candidateSet.has(w));
  if (matched.length === 0) return { score: 0, reason: '' };

  // Score: what fraction of the description's key terms appear in the candidate
  const coverage = matched.length / descSet.size;
  // Bonus: direct title word hits count double
  const titleHits = matched.filter(w => titleTokens.includes(w)).length;
  const adjusted = Math.min(1, coverage + titleHits * 0.1);

  const reason = titleHits > 0
    ? `Shares ${titleHits} title word${titleHits > 1 ? 's' : ''}: ${matched.slice(0, 4).join(', ')}`
    : `Shares keywords: ${matched.slice(0, 4).join(', ')}`;

  return { score: adjusted, reason };
}

export async function POST({ request }) {
  const body = await request.json().catch(() => null);
  const description: string = (body?.description ?? '').trim();
  if (description.length < 10) return json({ matches: [] });

  const descTokens = tokenize(description);
  if (descTokens.length === 0) return json({ matches: [] });

  const THRESHOLD = 0.25; // at least 25% of description keywords must appear in candidate
  const matches: Array<{ path: string; title: string; score: number; type: string; reason: string }> = [];

  for (const dir of SCAN_DIRS) {
    const full = path.join(REPO_ROOT, dir);
    if (!fs.existsSync(full)) continue;
    for (const name of fs.readdirSync(full)) {
      if (!name.endsWith('.md')) continue;
      const rel = `${dir}/${name}`;
      try {
        const raw = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8');
        if (/^subsumed_by:\s*.+/m.test(raw)) continue;
        if (/^status:\s*(completed|canceled)/m.test(raw)) continue;

        const { score: s, reason } = score(descTokens, raw);
        if (s < THRESHOLD) continue;

        matches.push({
          path: rel,
          title: getFrontmatterTitle(raw) || path.basename(rel, '.md'),
          score: s,
          type: rel.startsWith('plans/') ? 'plan' : 'proposal',
          reason,
        });
      } catch { /* skip */ }
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return json({ matches: matches.slice(0, 6) });
}
