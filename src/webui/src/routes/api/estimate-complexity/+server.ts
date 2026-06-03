import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

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

function countTableRows(body: string): number {
  // Count rows in markdown tables (excluding header and separator rows)
  let rows = 0;
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && !trimmed.includes('---') && !/^\|[\s-]+\|/.test(trimmed)) {
      rows++;
    }
  }
  return Math.max(0, rows - 1); // subtract header row
}

function countHeadings(body: string): number {
  return (body.match(/^#{1,3} /gm) ?? []).length;
}

function countDependencies(raw: string): number {
  const match = raw.match(/^depends_on:\s*\n((?:\s+-\s+.+\n?)+)/m);
  if (!match) return 0;
  return (match[1].match(/^\s+-/gm) ?? []).length;
}

function wordCount(body: string): number {
  return body.split(/\s+/).filter(Boolean).length;
}

export function GET({ url }) {
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

  const bodyMatch = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  const body = bodyMatch ? bodyMatch[1] : raw;
  const bodyLower = body.toLowerCase();
  const rawLower = raw.toLowerCase();

  const deps      = countDependencies(raw);
  const tableRows = countTableRows(body);
  const headings  = countHeadings(body);
  const words     = wordCount(body);

  const highHits = HIGH_KEYWORDS.filter(k => bodyLower.includes(k));
  const lowHits  = LOW_KEYWORDS.filter(k => bodyLower.includes(k));

  // Deferred proposals are inherently lower-stakes to estimate
  const isDeferred = rawLower.includes('deferred: true');

  let score = 0; // negative = low, positive = high

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
    const factors = [];
    if (tableRows >= 5) factors.push(`${tableRows} implementation steps`);
    if (deps >= 1) factors.push(`${deps} dependenc${deps === 1 ? 'y' : 'ies'}`);
    if (highHits.length) factors.push(`keywords: ${highHits.slice(0, 2).join(', ')}`);
    if (words >= 600) factors.push(`${words} words`);
    reason = 'High: ' + (factors.join('; ') || 'broad scope');
  } else if (score <= 0) {
    complexity = 'low';
    const factors = [];
    if (tableRows <= 2) factors.push('few implementation steps');
    if (deps === 0) factors.push('no dependencies');
    if (lowHits.length) factors.push(`keywords: ${lowHits.slice(0, 2).join(', ')}`);
    if (words <= 150) factors.push('short proposal');
    reason = 'Low: ' + (factors.join('; ') || 'narrow scope');
  } else {
    complexity = 'medium';
    reason = `Medium: score ${score} (${tableRows} steps, ${deps} deps, ${words} words)`;
  }

  return json({ complexity, reason, score });
}
