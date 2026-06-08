import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { getAIEngine } from '../../../../../dispatch/ai';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

function parseFrontmatter(raw: string): Record<string, any> {
  const fm: Record<string, any> = {};
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return fm;
  let curKey = '';
  let curArr: string[] | null = null;
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w[\w_-]*):\s*(.*)/);
    if (kv) {
      if (curArr && curKey) fm[curKey] = curArr;
      curArr = null;
      curKey = kv[1];
      const val = kv[2].trim();
      if (val === '') {
        curArr = [];
      } else if (val === 'true') fm[curKey] = true;
      else if (val === 'false') fm[curKey] = false;
      else fm[curKey] = val;
    } else if (curArr !== null && line.match(/^\s+-\s+/)) {
      curArr.push(line.replace(/^\s+-\s+/, '').trim());
    } else if (curArr !== null && curKey) {
      fm[curKey] = curArr;
      curArr = null;
    }
  }
  if (curArr && curKey) fm[curKey] = curArr;
  return fm;
}

export async function GET({ url }) {
  const docPath = url.searchParams.get('path');
  if (!docPath) return json({ error: 'path required' }, { status: 400 });

  const full = path.join(REPO_ROOT, docPath);
  if (!full.startsWith(REPO_ROOT)) return json({ error: 'invalid path' }, { status: 400 });

  let raw: string;
  try {
    raw = fs.readFileSync(full, 'utf-8');
  } catch {
    return json({ error: 'not found' }, { status: 404 });
  }

  const fm = parseFrontmatter(raw);

  const bodyMatch = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  const body = bodyMatch ? bodyMatch[1] : raw;

  // Try AI engine when available; fall back to heuristic
  try {
    const engine = getAIEngine(REPO_ROOT);
    const result = await engine.estimateComplexity(body, fm);
    return json({
      complexity: result.complexity,
      reason: result.reasoning,
      confidence: result.confidence,
      ai: true,
    });
  } catch {
    // Heuristic fallback
    const bodyLower = body.toLowerCase();
    const rawLower = raw.toLowerCase();

    const countTableRows = (s: string) => {
      let rows = 0;
      for (const line of s.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('|') && !trimmed.includes('---') && !/^\|[\s-]+\|/.test(trimmed)) rows++;
      }
      return Math.max(0, rows - 1);
    };

    const deps = Array.isArray(fm.depends_on) ? fm.depends_on.length : 0;
    const tableRows = countTableRows(body);
    const headings = (body.match(/^#{1,3} /gm) ?? []).length;
    const words = body.split(/\s+/).filter(Boolean).length;

    const HIGH_KEYWORDS = [
      'refactor', 'rewrite', 'unified', 'architecture', 'migration',
      'dispatch module', 'all profiles', 'all templates', 'all bundled',
      'new module', 'phase gate', 'acl', 'multi-vault', 'infrastructure',
      'overhaul', 'rebuild', 'replace entire', 'full system',
    ];
    const LOW_KEYWORDS = [
      'tooltip', 'add field', 'hide ', 'filter ', 'quick fix', 'one-line',
      'single line', 'small ', 'minor ', 'typo', 'label', 'placeholder',
      'rename ', 'css ', 'colour', 'color ', 'icon ',
    ];

    const highHits = HIGH_KEYWORDS.filter(k => bodyLower.includes(k));
    const lowHits  = LOW_KEYWORDS.filter(k => bodyLower.includes(k));
    const isDeferred = rawLower.includes('deferred: true');

    let score = 0;
    if (tableRows >= 10) score += 2;
    else if (tableRows >= 5) score += 1;
    else if (tableRows <= 2) score -= 1;
    if (deps >= 3) score += 2;
    else if (deps >= 1) score += 1;
    if (words >= 600) score += 1;
    if (words <= 150) score -= 1;
    if (headings >= 8) score += 1;
    score += highHits.length * 2;
    score -= lowHits.length;
    if (isDeferred) score -= 1;

    let complexity: string;
    let reason: string;

    if (score >= 3) {
      complexity = 'high';
      const factors: string[] = [];
      if (tableRows >= 5) factors.push(`${tableRows} implementation steps`);
      if (deps >= 1) factors.push(`${deps} dependenc${deps === 1 ? 'y' : 'ies'}`);
      if (highHits.length) factors.push(`keywords: ${highHits.slice(0, 2).join(', ')}`);
      if (words >= 600) factors.push(`${words} words`);
      reason = 'High: ' + (factors.join('; ') || 'broad scope');
    } else if (score <= 0) {
      complexity = 'low';
      const factors: string[] = [];
      if (tableRows <= 2) factors.push('few implementation steps');
      if (deps === 0) factors.push('no dependencies');
      if (lowHits.length) factors.push(`keywords: ${lowHits.slice(0, 2).join(', ')}`);
      if (words <= 150) factors.push('short proposal');
      reason = 'Low: ' + (factors.join('; ') || 'narrow scope');
    } else {
      complexity = 'medium';
      reason = `Medium: score ${score} (${tableRows} steps, ${deps} deps, ${words} words)`;
    }

    return json({ complexity, reason, score, ai: false });
  }
}
