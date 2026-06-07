import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { getGateDefinition, getGatesForTransition, evaluateGate, getScheduleGatesForDocument, isOverdue, getLastGateDate, parseCadence } from '../../../../../dispatch/gates';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

// Cache gate definitions from profile.json
let gateDefsCache: { gates: any[]; at: number } | null = null;
function getGateDefs(): any[] {
  const profilePath = path.join(REPO_ROOT, 'src', 'profiles', 'org-operations', 'profile.json');
  if (!fs.existsSync(profilePath)) return [];
  if (gateDefsCache && Date.now() - gateDefsCache.at < 30000) return gateDefsCache.gates;
  try {
    const raw = fs.readFileSync(profilePath, 'utf-8');
    const profile = JSON.parse(raw);
    const gates = getGateDefinition(profile);
    gateDefsCache = { gates, at: Date.now() };
    return gates;
  } catch {
    return [];
  }
}

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

const PRIORITY_RANK: Record<string, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
};
function byPriority(a: { priority: string }, b: { priority: string }): number {
  return (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99);
}

function asList(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string' && val) return [val];
  return [];
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
    depends_on: asList(fm.depends_on),
    proposal_source: asList(fm.proposal_source),
  };
}

let cache: { data: any; at: number } | null = null;

export function GET() {
  // 2-second cache to smooth rapid SSE-triggered refreshes
  if (cache && Date.now() - cache.at < 2000) return json(cache.data);

  // Approved proposal paths referenced by existing plans.
  // Normalize to always include .md so the set check matches actual file paths.
  const referencedByPlan = new Set<string>();
  for (const { fm } of [...readDir(path.join(REPO_ROOT, 'plans')), ...readDir(path.join(REPO_ROOT, 'plans', 'completed'))]) {
    const ps = fm.proposal_source;
    const sources: string[] = Array.isArray(ps) ? ps : ps ? [String(ps)] : [];
    for (const s of sources) {
      const norm = s.trim();
      referencedByPlan.add(norm.endsWith('.md') ? norm : norm + '.md');
    }
  }

  // Open proposals (proposals/ — not approved, not deferred) — sorted by priority
  const open = readDir(path.join(REPO_ROOT, 'proposals'))
    .filter(({ path: p, fm }) =>
      !p.includes('misc.md') &&
      fm.approved !== true &&
      fm.deferred !== true
    )
    .map(({ path: p, fm }) => entry(p, fm))
    .sort(byPriority);

  // Deferred proposals — sorted by priority
  const deferred = readDir(path.join(REPO_ROOT, 'proposals'))
    .filter(({ fm }) => fm.deferred === true)
    .map(({ path: p, fm }) => entry(p, fm))
    .sort(byPriority);

  // Approved proposals not yet promoted to a plan — sorted by priority
  // Check both proposals/approved/ AND proposals/ (files with approved: true not yet moved)
  const approvedPending = [
    ...readDir(path.join(REPO_ROOT, 'proposals', 'approved'))
      .filter(({ path: p }) => p.endsWith('.md')),
    ...readDir(path.join(REPO_ROOT, 'proposals'))
      .filter(({ path: p, fm }) =>
        p.endsWith('.md') && fm.approved === true
      ),
  ].filter(({ path: p, fm }) =>
    !referencedByPlan.has(p) &&
    !fm.consumed_by &&           // proposal already has a plan via consumed_by field
    fm.deferred !== true &&
    fm.approved === true &&
    !p.includes('phase-0-spike-decision')
  ).map(({ path: p, fm }) => entry(p, fm))
   .sort(byPriority);

  // Active plans — in-progress first, then approved, both sorted by priority within group
  const active = readDir(path.join(REPO_ROOT, 'plans'))
    .filter(({ fm }) => ['approved', 'in-progress'].includes(String(fm.status ?? '')))
    .map(({ path: p, fm }) => entry(p, fm))
    .sort((a, b) => {
      // in-progress before approved
      const statusOrder = (s: string) => s === 'in-progress' ? 0 : 1;
      const sd = statusOrder(a.status) - statusOrder(b.status);
      return sd !== 0 ? sd : byPriority(a, b);
    });

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

  // Gate scanning
  const gates = getGateDefs();
  const pendingGates: Array<{ path: string; title: string; gate_id: string; reason: string; gate_status: string; reviewer: string; reviews: number }> = [];
  const waivedGates: Array<{ path: string; title: string; gate_id: string; note: string }> = [];
  const overdueGates: Array<{ path: string; title: string; gate_id: string; next_review: string; document_type: string }> = [];

  if (gates.length > 0) {
    const allLifecycleDocs = [
      ...readDir(path.join(REPO_ROOT, 'plans')),
      ...readDir(path.join(REPO_ROOT, 'plans', 'completed')),
      ...readDir(path.join(REPO_ROOT, 'proposals', 'approved')),
      ...readDir(path.join(REPO_ROOT, 'proposals')),
    ];
    for (const doc of allLifecycleDocs) {
      // Transition-triggered gates
      const matched = getGatesForTransition(gates, {
        document_type: doc.fm.type || 'plan',
        from: doc.fm.status,
        to: doc.fm._next_status,
        phase: doc.fm.phase,
      });
      for (const gate of matched) {
        const result = evaluateGate(gate, doc.fm);
        const title = String(doc.fm.title ?? doc.path.replace(/^.*\//, '').replace('.md', ''));
        if (result.blocked) {
          pendingGates.push({
            path: doc.path,
            title,
            gate_id: gate.id,
            reason: result.reason ?? '',
            gate_status: doc.fm.gate_status ?? 'pending',
            reviewer: Array.isArray(doc.fm[gate.reviewer_field])
              ? doc.fm[gate.reviewer_field].join(', ')
              : String(doc.fm[gate.reviewer_field] ?? ''),
            reviews: result.reviews.length,
          });
        }
        if (doc.fm.gate_status === 'waived') {
          waivedGates.push({
            path: doc.path,
            title,
            gate_id: gate.id,
            note: doc.fm.gate_note ?? '',
          });
        }
      }

      // Schedule-triggered gates (Phase 1b) — check for overdue reviews
      const scheduleGates = getScheduleGatesForDocument(gates, doc.fm);
      for (const gate of scheduleGates) {
        if (isOverdue(gate, doc.fm)) {
          const lastDate = getLastGateDate(doc.fm);
          const cadenceMs = parseCadence(gate.cadence!);
          const nextReview = lastDate && cadenceMs
            ? new Date(lastDate.getTime() + cadenceMs).toISOString().slice(0, 10)
            : 'initial review needed';
          overdueGates.push({
            path: doc.path,
            title: String(doc.fm.title ?? doc.path.replace(/^.*\//, '').replace('.md', '')),
            gate_id: gate.id,
            next_review: nextReview,
            document_type: doc.fm.type ?? doc.fm._type ?? '',
          });
        }
      }
    }
  }

  const vaultName = path.basename(REPO_ROOT);

  const data = {
    vaultName,
    version,
    currentPhase,
    phasePlans,
    proposals: { open, approved_pending: approvedPending, deferred },
    plans: { active, completed_count: completedCount },
    gates: { pending: pendingGates, waived: waivedGates, overdue: overdueGates },
  };
  cache = { data, at: Date.now() };
  return json(data);
}
