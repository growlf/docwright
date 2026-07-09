import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { json } from '@sveltejs/kit';
import { getGateDefinition, getGatesForTransition, evaluateGate, getScheduleGatesForDocument, isOverdue, getLastGateDate, parseCadence } from '../../../../../dispatch/gates';
import { buildRoadplan, byPriority } from '../../../../../dispatch/roadplan';
import { getReleaseReadiness } from '../../../../../dispatch/release';
import { parseFrictionLog, agedFrictionEntries, FRICTION_LOG_PATH, FRICTION_REVIEW_CADENCE_DAYS } from '../../../../../dispatch/friction';
import { parseFrontmatter as parseFm } from '../../../../../dispatch/frontmatter';

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

// Word priorities map onto the same scale as numeric ones (lower = more urgent),
// so mixed schemes (e.g. `high` and `4`) sort together instead of numeric/`highest`
// values silently collapsing to the bottom. Unknown/empty sinks last.
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
    completed_date: String(fm.completed_date ?? ''),
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
    phase: fm.phase !== undefined && fm.phase !== '' ? String(fm.phase) : null,
    parentPlan: String(fm.parent_plan ?? ''),
    parentDeliverable: String(fm.parent_deliverable ?? ''),
    milestone: String(fm.milestone ?? ''),
    branch: String(fm.branch ?? ''),
    demandCount: parseInt(String(fm.demand_count ?? '0'), 10),
    githubIssue: String(fm.github_issue ?? ''),
    reportedDates: Array.isArray(fm.reported_dates)
      ? fm.reported_dates.map(String)
      : typeof fm.reported_dates === 'string'
        ? String(fm.reported_dates).replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean)
        : [],
  };
}

let cache: { data: any; at: number } | null = null;

function parseWindow(url: string): 'all' | '30d' {
  try {
    const u = new URL(url);
    const w = u.searchParams.get('window');
    if (w === '30d') return '30d';
  } catch { /* ignore */ }
  return 'all';
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(d.getTime())) return Infinity;
  return (Date.now() - d.getTime()) / 86400000;
}

export function GET({ url }: { url: URL }) {
  const window = parseWindow(url);
  // 2-second cache (keyed by window to avoid stale data across toggles)
  if (cache && Date.now() - cache.at < 2000) {
    const cached = cache.data;
    if (cached._window === window) return json(cached);
  }

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

  // Draft plans — plans/ with status: draft, not yet approved
  const draft = readDir(path.join(REPO_ROOT, 'plans'))
    .filter(({ fm }) => String(fm.status ?? '') === 'draft')
    .map(({ path: p, fm }) => entry(p, fm))
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

  const completed = readDir(path.join(REPO_ROOT, 'plans', 'completed'))
    .filter(({ path: p }) => p.endsWith('.md') && !p.endsWith('README.md') && !p.endsWith('.gitkeep'))
    .map(({ path: p, fm }) => entry(p, fm))
    .sort((a, b) => {
      const da = a.completed_date || '';
      const db = b.completed_date || '';
      return db.localeCompare(da);
    });
  const completedCount = completed.length;

  // Phase/roadmap data
  //
  // currentPhase = phase number of the in-progress or approved phase overview plan.
  // Falls back to the highest completed phase number, then 1.
  // Uses basename match (^phase-\d) so plans like lifecycle-gates
  // don't pollute the phase number.
  const allPlansForPhase = [
    ...readDir(path.join(REPO_ROOT, 'plans')),
    ...readDir(path.join(REPO_ROOT, 'plans', 'completed')),
  ];

  // Active phase: in-progress or approved phase overview plan
  const activePhasePlan = allPlansForPhase
    .filter(({ path: p, fm }) =>
      /^phase-\d/.test(path.basename(p)) &&
      ['in-progress', 'approved'].includes(String(fm.status ?? ''))
    )
    .map(({ fm }) => parseInt(String(fm.phase ?? '0'), 10))
    .filter(n => n > 0)
    .sort((a, b) => a - b)[0];

  // Fallback: highest completed phase number
  const maxCompletedPhase = allPlansForPhase
    .filter(({ path: p, fm }) =>
      /^phase-\d/.test(path.basename(p)) &&
      String(fm.status ?? '') === 'completed'
    )
    .map(({ fm }) => parseInt(String(fm.phase ?? '0'), 10))
    .filter(n => n > 0)
    .reduce((max, n) => Math.max(max, n), 0);

  const currentPhase = activePhasePlan ?? (maxCompletedPhase > 0 ? maxCompletedPhase : 1);

  // Phase plans: ONLY phase overview docs (basename starts with phase-N),
  // excluding completed/canceled — these populate the roadmap card.
  const phasePlans = readDir(path.join(REPO_ROOT, 'plans'))
    .filter(({ path: p, fm }) =>
      /^phase-\d/.test(path.basename(p)) &&
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

  // ── Research section ────────────────────────────────────────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const researchDocs = readDir(path.join(REPO_ROOT, 'research'))
    .filter(({ fm }) => fm.title); // skip .gitkeep and empty files

  // All proposal paths referenced by any research doc's linked_proposals
  const researchLinked = new Set<string>();
  for (const { fm } of researchDocs) {
    for (const l of asList(fm.linked_proposals)) {
      const norm = l.trim();
      researchLinked.add(norm);
      researchLinked.add(norm.endsWith('.md') ? norm : norm + '.md');
    }
  }

  const activeResearch = researchDocs
    .filter(({ fm }) => String(fm.status ?? '') === 'active')
    .map(({ path: p, fm }) => ({
      path: p,
      title: String(fm.title ?? p.replace(/^.*\//, '').replace(/\.md$/, '')),
      question: String(fm.question ?? ''),
      created: String(fm.created ?? ''),
    }))
    .sort((a, b) => b.created.localeCompare(a.created));

  const recentConclusions = researchDocs
    .filter(({ fm }) => {
      if (String(fm.status ?? '') !== 'concluded') return false;
      const d = new Date(String(fm.created ?? ''));
      return !isNaN(d.getTime()) && d >= thirtyDaysAgo;
    })
    .map(({ path: p, fm }) => ({
      path: p,
      title: String(fm.title ?? p.replace(/^.*\//, '').replace(/\.md$/, '')),
      question: String(fm.question ?? ''),
      conclusion: String(fm.conclusion ?? ''),
      created: String(fm.created ?? ''),
    }))
    .sort((a, b) => b.created.localeCompare(a.created));

  // Approved proposals that no research doc has linked to — visible, not enforced
  const noResearchProposals = [
    ...readDir(path.join(REPO_ROOT, 'proposals', 'approved'))
      .filter(({ fm }) => fm.approved === true && !fm.consumed_by && fm.deferred !== true),
  ].filter(({ path: p }) =>
    !researchLinked.has(p) &&
    !researchLinked.has(p.replace(/\.md$/, '')) &&
    !researchLinked.has(p.replace(/^proposals\/approved\//, ''))
  ).map(({ path: p, fm }) => ({
    path: p,
    title: String(fm.title ?? p.replace(/^.*\//, '').replace(/\.md$/, '')),
  }));

  // ── Phase gate review detection ─────────────────────────────────────────────
  // After a phase plan's gate is approved, all remaining phase plans should be
  // reviewed and confirmed before the next phase becomes active.
  //
  // Required when: a completed phase plan has gate_status approved/waived AND
  // any future phase plan has no phase_review_date set after that completion.

  const completedPhasePlans = [
    ...readDir(path.join(REPO_ROOT, 'plans', 'completed')),
  ].filter(({ fm }) => /phase-\d/.test(String(fm.title ?? '')) || parseInt(String(fm.phase ?? ''), 10) > 0)
   .filter(({ fm }) => ['approved', 'waived', 'reviewed'].includes(String(fm.gate_status ?? '')))
   .map(({ path: p, fm }) => ({
     path: p,
     phase: parseInt(String(fm.phase ?? '0'), 10),
     completedDate: String(fm.completed_date ?? fm.created ?? ''),
     title: String(fm.title ?? ''),
   }))
   .filter(p => p.phase > 0)
   .sort((a, b) => b.phase - a.phase);

  const lastGatedPhase = completedPhasePlans[0] ?? null;

  const futurePhasePlans = lastGatedPhase
    ? readDir(path.join(REPO_ROOT, 'plans'))
        .filter(({ fm }) => {
          const ph = parseInt(String(fm.phase ?? '0'), 10);
          return ph > lastGatedPhase.phase;
        })
        .map(({ path: p, fm }) => {
          const phaseNum = parseInt(String(fm.phase ?? '0'), 10);
          // Count all non-completed plans that belong to this phase
          const activeWorkItems = allPlansForPhase
            .filter(({ path: ap, fm: afm }) => {
              const apPhase = parseInt(String(afm.phase ?? '0'), 10);
              if (apPhase !== phaseNum) return false;
              const st = String(afm.status ?? '');
              return !['completed', 'canceled'].includes(st);
            });
          return {
            path: p,
            phase: phaseNum,
            title: String(fm.title ?? p.replace(/^.*\//, '').replace(/\.md$/, '')),
            status: String(fm.status ?? 'draft'),
            reviewDate: String(fm.phase_review_date ?? ''),
            needsReview: !fm.phase_review_date ||
              String(fm.phase_review_date) < lastGatedPhase.completedDate,
            activeWorkCount: activeWorkItems.length,
            canReview: activeWorkItems.length === 0,
          };
        })
        .sort((a, b) => a.phase - b.phase)
    : [];

  const phaseReview = lastGatedPhase && futurePhasePlans.some(p => p.needsReview)
    ? {
        required: true,
        gatedPhase: lastGatedPhase.phase,
        gatedPlanTitle: lastGatedPhase.title,
        completedDate: lastGatedPhase.completedDate,
        plans: futurePhasePlans,
      }
    : null;

  const openIssues = readDir(path.join(REPO_ROOT, 'issues'))
    .filter(({ path: p, fm }) =>
      !p.endsWith('README.md') &&
      !['resolved', 'wont-fix'].includes(String(fm.status ?? 'open'))
    )
    .map(({ path: p, fm }) => entry(p, fm))
    .sort(byPriority);

  // ── Heatmap: top bugs by demand (time-weighted) ─────────────────────────────
  const heatmap = readDir(path.join(REPO_ROOT, 'issues'))
    .filter(({ path: p, fm }) =>
      !p.endsWith('README.md') &&
      String(fm.category ?? '') === 'bug' &&
      !['resolved', 'wont-fix'].includes(String(fm.status ?? ''))
    )
    .map(({ path: p, fm }) => {
      const e = entry(p, fm);
      const dates: string[] = e.reportedDates;
      if (window === '30d') {
        // Only count reports in the last 30 days
        const recent = dates.filter(d => daysSince(d) <= 30);
        const recentCount = recent.length;
        // Decay: each report within 30d counts 1, oldest decays to 0.5
        const decayedScore = recent.reduce((sum, d) => {
          const age = daysSince(d);
          return sum + Math.max(0.5, 1 - age / 60);
        }, 0);
        // Boost by total demand for persistent bugs, but weight recency heavily
        e.demandCount = Math.round(Math.max(recentCount, decayedScore));
      }
      return e;
    })
    .filter(b => b.demandCount > 0)
    .sort((a, b) => b.demandCount - a.demandCount)
    .slice(0, 10);

  const vaultName = path.basename(REPO_ROOT);

  const roadplan = buildRoadplan(active, openIssues);
  const releaseReadiness = getReleaseReadiness(REPO_ROOT, roadplan.current.name);

  // Friction log — weekly review cadence; aged = untriaged past the cadence
  let frictionEntries: ReturnType<typeof parseFrictionLog> = [];
  const frictionFile = path.join(REPO_ROOT, FRICTION_LOG_PATH);
  if (fs.existsSync(frictionFile)) {
    try {
      frictionEntries = parseFrictionLog(fs.readFileSync(frictionFile, 'utf-8'));
    } catch {
      frictionEntries = [];
    }
  }
  const friction = {
    total: frictionEntries.length,
    aged: agedFrictionEntries(frictionEntries, new Date()),
    cadence_days: FRICTION_REVIEW_CADENCE_DAYS,
  };

  // ── Open PRs from GitHub ────────────────────────────────────────────────────
  interface GHPR {
    number: number; title: string; headRefName: string;
    url: string; author: { login: string };
    mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
    statusCheckRollup: Array<{ __typename: string; name: string; conclusion: string; status: string }>;
    reviews: Array<{ state: string }>;
  }
  function getOpenPRs(): GHPR[] {
    if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
      try {
        const out = execSync('gh auth token', { encoding: 'utf-8', timeout: 5000 });
        if (!out.trim()) return [];
      } catch { return []; }
    }
    try {
      const out = execSync(
        'gh pr list --state open --json number,title,headRefName,url,author,mergeable,statusCheckRollup,reviews --limit 50',
        { encoding: 'utf-8', timeout: 10000 }
      );
      return JSON.parse(out) as GHPR[];
    } catch { return []; }
  }

  // Build branch→plan index from active + draft plans
  const branchToPlan = new Map<string, { path: string; title: string }>();
  for (const p of [...draft, ...active]) {
    if (p.branch) branchToPlan.set(p.branch, p);
    // Also index by slug derived from filename
    const slug = p.path.replace(/^.*\//, '').replace(/\.md$/, '');
    const prefixMatch = slug.match(/^[a-z]+[-/]/);
    const core = prefixMatch ? slug.slice(prefixMatch[0].length) : slug;
    if (core) branchToPlan.set(core, p);
  }

  const openPRs = getOpenPRs().map(pr => {
    const plan = branchToPlan.get(pr.headRefName)
      ?? branchToPlan.get(pr.headRefName.replace(/^[^/]+\//, ''));
    const ciConclusion = pr.statusCheckRollup?.length > 0
      ? pr.statusCheckRollup.every(c => c.conclusion === 'SUCCESS' && c.status === 'COMPLETED')
        ? 'passing'
        : pr.statusCheckRollup.some(c => c.conclusion === 'FAILURE')
          ? 'failing'
          : 'pending'
      : 'unknown';
    const reviewState = pr.reviews?.length > 0
      ? pr.reviews.some(r => r.state === 'APPROVED') ? 'approved' : 'changes-requested'
      : 'none';
    return {
      number: pr.number,
      title: pr.title,
      url: pr.url,
      author: pr.author?.login ?? 'unknown',
      headRefName: pr.headRefName,
      mergeable: pr.mergeable ?? 'UNKNOWN',
      ciState: ciConclusion,
      reviewState,
      planPath: plan?.path ?? null,
      planTitle: plan?.title ?? null,
    };
  });

  const data = {
    vaultName,
    version,
    currentPhase,
    phasePlans,
    proposals: { open, approved_pending: approvedPending, deferred },
    plans: { draft, active, completed_count: completedCount, completed },
    openPRs,
    gates: { pending: pendingGates, waived: waivedGates, overdue: overdueGates },
    research: { active: activeResearch, recent_conclusions: recentConclusions, no_research_proposals: noResearchProposals },
    phaseReview,
    issues: { open: openIssues },
    heatmap,
    roadplan,
    releaseReadiness,
    friction,
    _window: window,
  };
  cache = { data, at: Date.now() };
  return json(data);
}
