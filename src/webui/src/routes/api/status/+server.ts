import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

// Simple frontmatter parser — handles strings, booleans, and block arrays
function parseFm(raw: string): Record<string, any> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, any> = {};
  const lines = match[1].split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.startsWith('#')) { i++; continue; }
    const colonIdx = line.indexOf(':');
    if (colonIdx <= 0) { i++; continue; }
    const key = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trim();
    if (rest === '' || rest === '[]') {
      i++;
      const arr: string[] = [];
      if (rest !== '[]') {
        while (i < lines.length && /^\s+-\s/.test(lines[i])) {
          arr.push(lines[i].replace(/^\s+-\s*/, '').trim());
          i++;
        }
      }
      result[key] = arr;
      continue;
    }
    let val: any = rest.replace(/^["']|["']$/g, '');
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    result[key] = val;
    i++;
  }
  return result;
}

function readDir(dir: string): Array<{ path: string; fm: Record<string, any> }> {
  const results: Array<{ path: string; fm: Record<string, any> }> = [];
  if (!fs.existsSync(dir)) return results;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const full = path.join(dir, name);
    try {
      const raw = fs.readFileSync(full, 'utf-8');
      results.push({ path: path.relative(REPO_ROOT, full), fm: parseFm(raw) });
    } catch { /* skip */ }
  }
  return results;
}

function entry(p: string, fm: Record<string, any>) {
  return {
    path: p,
    title: String(fm.title ?? p.replace(/^.*\//, '').replace(/\.md$/, '')),
    created: String(fm.created ?? ''),
    tags: Array.isArray(fm.tags) ? fm.tags : [],
    category: Array.isArray(fm.category) && fm.category.length > 0
      ? fm.category
      : Array.isArray(fm.tags) ? fm.tags : [],
    complexity: String(fm.complexity ?? ''),
    status: String(fm.status ?? ''),
    priority: String(fm.priority ?? ''),
    assigned_to: String(fm.assigned_to ?? ''),
  };
}

let cache: { data: any; at: number } | null = null;

export function GET() {
  // 2-second cache to smooth rapid SSE-triggered refreshes
  if (cache && Date.now() - cache.at < 2000) return json(cache.data);

  // Approved proposal paths referenced by existing plans
  const referencedByPlan = new Set<string>();
  for (const { fm } of [...readDir(path.join(REPO_ROOT, 'plans')), ...readDir(path.join(REPO_ROOT, 'plans', 'completed'))]) {
    const ps = fm.proposal_source;
    const sources: string[] = Array.isArray(ps) ? ps : ps ? [String(ps)] : [];
    for (const s of sources) referencedByPlan.add(s);
  }

  // Open proposals (proposals/ — not approved, not deferred)
  const open = readDir(path.join(REPO_ROOT, 'proposals'))
    .filter(({ path: p, fm }) =>
      !p.includes('misc.md') &&
      fm.approved !== true &&
      fm.deferred !== true
    )
    .map(({ path: p, fm }) => entry(p, fm));

  // Deferred proposals
  const deferred = readDir(path.join(REPO_ROOT, 'proposals'))
    .filter(({ fm }) => fm.deferred === true)
    .map(({ path: p, fm }) => entry(p, fm));

  // Approved proposals not yet promoted to a plan
  const approvedPending = readDir(path.join(REPO_ROOT, 'proposals', 'approved'))
    .filter(({ path: p, fm }) =>
      !referencedByPlan.has(p) &&
      fm.deferred !== true &&
      fm.approved === true &&
      !p.includes('phase-0-spike-decision')
    )
    .map(({ path: p, fm }) => entry(p, fm));

  // Active plans
  const active = readDir(path.join(REPO_ROOT, 'plans'))
    .filter(({ fm }) => ['approved', 'in-progress'].includes(String(fm.status ?? '')))
    .map(({ path: p, fm }) => entry(p, fm));

  const completedCount = readDir(path.join(REPO_ROOT, 'plans', 'completed')).length;

  // Phase/roadmap data
  // Current phase: highest `phase:` value among active or completed plans
  const allPlans = [
    ...readDir(path.join(REPO_ROOT, 'plans')),
    ...readDir(path.join(REPO_ROOT, 'plans', 'completed')),
  ];
  let currentPhase = 1;
  for (const { fm } of allPlans) {
    const p = parseInt(String(fm.phase ?? '0'), 10);
    if (!isNaN(p) && p > currentPhase) currentPhase = p;
  }
  // Phase plans: phase-level planning docs (phase-N-* names), excluding completed/canceled stubs
  const phasePlans = readDir(path.join(REPO_ROOT, 'plans'))
    .filter(({ path: p, fm }) =>
      /phase-\d/.test(p) &&
      !['completed', 'canceled', 'proposal'].includes(String(fm.status ?? ''))
    )
    .map(({ path: p, fm }) => ({
      path: p,
      title: String(fm.title ?? p.replace(/^.*\//, '').replace(/\.md$/, '')),
      status: String(fm.status ?? 'draft'),
      phase: parseInt(String(fm.phase ?? '0'), 10) || null,
    }))
    .sort((a, b) => (a.phase ?? 99) - (b.phase ?? 99));

  // VERSION file
  let version = '';
  try { version = fs.readFileSync(path.join(REPO_ROOT, 'VERSION'), 'utf-8').trim(); } catch { /* ok */ }

  const vaultName = path.basename(REPO_ROOT);

  const data = {
    vaultName,
    version,
    currentPhase,
    phasePlans,
    proposals: { open, approved_pending: approvedPending, deferred },
    plans: { active, completed_count: completedCount },
  };
  cache = { data, at: Date.now() };
  return json(data);
}
