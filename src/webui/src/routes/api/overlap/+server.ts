import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

const THRESHOLD = 0.10;

const STOP = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with',
  'is','are','was','were','be','been','being','have','has','had','do','does',
  'did','will','would','could','should','may','might','shall','can','its',
  'this','that','these','those','we','i','you','they','it','he','she','not',
  'by','as','from','when','if','then','than','so','into','about','also',
  'each','which','who','what','how','all','any','some','more','just','like',
  'plan','proposal','proposals','plans','document','file','page','doc',
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/```[\s\S]*?```/g, '') // strip code blocks
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOP.has(w))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function parseFrontmatterTitle(raw: string): string {
  const m = raw.match(/^---\n[\s\S]*?^title:\s*["']?([^\n"']+)["']?/m);
  return m ? m[1].trim() : '';
}

function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\n[\s\S]*?\n---\n/, '');
}

function parseSections(body: string): Array<{ heading: string; content: string }> {
  const sections: Array<{ heading: string; content: string }> = [];
  const lines = body.split('\n');
  let current: { heading: string; lines: string[] } | null = null;
  for (const line of lines) {
    const m = line.match(/^#{1,3}\s+(.+)/);
    if (m) {
      if (current && current.lines.join('').trim())
        sections.push({ heading: current.heading, content: current.lines.join('\n').trim() });
      current = { heading: m[1], lines: [] };
    } else {
      current?.lines.push(line);
    }
  }
  if (current && current.lines.join('').trim())
    sections.push({ heading: current.heading, content: current.lines.join('\n').trim() });
  return sections;
}

function scanDir(dir: string, exclude: string, results: Array<{ path: string; raw: string }>) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(REPO_ROOT, full);
    if (rel === exclude) continue;
    if (name.startsWith('.')) continue;
    if (fs.statSync(full).isDirectory()) continue;
    if (!name.endsWith('.md')) continue;
    try {
      const raw = fs.readFileSync(full, 'utf-8');
      // Skip subsumed proposals and completed/canceled plans
      if (/^subsumed_by:\s*.+/m.test(raw)) continue;
      if (/^status:\s*(completed|canceled)/m.test(raw)) continue;
      results.push({ path: rel, raw });
    } catch { /* skip unreadable */ }
  }
}

function collectCandidates(exclude: string): Array<{ path: string; raw: string }> {
  const results: Array<{ path: string; raw: string }> = [];
  // Scan open proposals, approved proposals (not yet subsumed), and active plans
  scanDir(path.join(REPO_ROOT, 'proposals'), exclude, results);
  scanDir(path.join(REPO_ROOT, 'proposals', 'approved'), exclude, results);
  scanDir(path.join(REPO_ROOT, 'plans'), exclude, results);
  // Exclude completed plans directory entirely
  return results;
}

export function GET({ url }) {
  const filePath = url.searchParams.get('path');
  if (!filePath) return json({ error: 'missing path' }, { status: 400 });

  const resolved = path.resolve(REPO_ROOT, filePath);
  if (!resolved.startsWith(REPO_ROOT)) return json({ error: 'invalid path' }, { status: 403 });
  if (!fs.existsSync(resolved)) return json({ error: 'not found' }, { status: 404 });

  const targetRaw = fs.readFileSync(resolved, 'utf-8');
  const targetBody = stripFrontmatter(targetRaw);
  const targetWords = tokenize(parseFrontmatterTitle(targetRaw) + ' ' + targetBody);

  const candidates = collectCandidates(filePath);
  const matches = candidates
    .map(({ path: p, raw }) => {
      const body = stripFrontmatter(raw);
      const words = tokenize(parseFrontmatterTitle(raw) + ' ' + body);
      const score = jaccard(targetWords, words);
      return { path: p, title: parseFrontmatterTitle(raw), score, sections: parseSections(body) };
    })
    .filter(m => m.score >= THRESHOLD)
    .sort((a, b) => b.score - a.score);

  return json({ matches });
}
