import type { ProfileConfig } from './profile';
import { parseFrontmatter } from './frontmatter';

export interface LintResult {
  field: string;
  severity: 'error' | 'warn';
  message: string;
}

const REQUIRED_BY_PREFIX: Array<[string, string[]]> = [
  ['proposals/approved/', ['title', 'author', 'created', 'approved', 'assigned_to']],
  ['proposals/',          ['title', 'author', 'created', 'approved', 'created_by']],
  ['plans/completed/',    ['title', 'status', 'author', 'created']],
  ['plans/',              ['title', 'status', 'author', 'created', 'assigned_to']],
  ['research/',           ['title', 'status', 'question', 'author', 'created', 'author-role']],
  ['docs/SOPs/',          ['title', 'category', 'created', 'status']],
  ['docs/',               ['title', 'status']],
  ['policies/',           ['title', 'status', 'author', 'created']],
];

const VALID_COMPLEXITY        = new Set(['', 'XS', 'S', 'M', 'L', 'XL']);
const VALID_AUTOMATED         = new Set(['off', 'guided', 'full']);
const VALID_MODE              = new Set(['mentor', 'guided', 'autonomous']);
const VALID_PLAN_STATUS       = new Set(['draft', 'approved', 'in-progress', 'completed', 'canceled']);
const VALID_RESEARCH_STATUS   = new Set(['active', 'concluded', 'archived']);
const VALID_RESEARCH_CONCLUSION = new Set(['open', 'recommends', 'inconclusive', 'superseded']);

export function lintDocument(
  filePath: string,
  fm: Record<string, any>,
  _profile: ProfileConfig,
  parentStatuses?: Record<string, string>,
): LintResult[] {
  const results: LintResult[] = [];

  // Required fields by path prefix
  for (const [prefix, fields] of REQUIRED_BY_PREFIX) {
    if (filePath.startsWith(prefix)) {
      for (const f of fields) {
        const v = fm[f];
        if (v === undefined || v === null || v === '') {
          results.push({ field: f, severity: 'error', message: `Required field '${f}' is missing or empty` });
        }
      }
      break;
    }
  }

  // Location invariant: proposals/approved/ must have approved: true
  if (filePath.startsWith('proposals/approved/') && fm.approved !== true) {
    results.push({ field: 'approved', severity: 'error', message: "In proposals/approved/ but approved !== true" });
  }

  // Enum checks
  if (fm.complexity !== undefined && fm.complexity !== '' && !VALID_COMPLEXITY.has(String(fm.complexity))) {
    results.push({ field: 'complexity', severity: 'warn', message: 'complexity should be XS | S | M | L | XL' });
  }
  // Accept both 'automated:' (legacy) and 'mode:' (canonical per plan-execution-mode-rename proposal).
  // 'automated:' with old values (off/guided/full) → warn + migration hint.
  // 'mode:' with new values (mentor/guided/autonomous) → valid, no warning.
  if (fm.automated !== undefined && fm.automated !== '') {
    if (!VALID_AUTOMATED.has(String(fm.automated))) {
      results.push({ field: 'automated', severity: 'error', message: 'automated must be off | guided | full (or migrate to mode: mentor|guided|autonomous)' });
    } else {
      results.push({ field: 'automated', severity: 'warn', message: `'automated: ${fm.automated}' is deprecated — migrate to 'mode: ${fm.automated === 'off' ? 'mentor' : fm.automated === 'full' ? 'autonomous' : 'guided'}'` });
    }
  }
  if (fm.mode !== undefined && fm.mode !== '' && !VALID_MODE.has(String(fm.mode))) {
    results.push({ field: 'mode', severity: 'error', message: 'mode must be mentor | guided | autonomous' });
  }
  if (filePath.startsWith('plans/') && fm.status !== undefined && !VALID_PLAN_STATUS.has(String(fm.status))) {
    results.push({ field: 'status', severity: 'warn', message: `Unknown plan status '${fm.status}'` });
  }

  // Approved proposal should have assigned_to
  if (fm.approved === true && (fm.assigned_to === undefined || fm.assigned_to === '')) {
    results.push({ field: 'assigned_to', severity: 'warn', message: 'Approved but assigned_to is empty' });
  }

  // Active plans should be assigned to a phase (skip phase overview plans themselves)
  const basename = filePath.replace(/^.*\//, '');
  if (
    filePath.startsWith('plans/') &&
    ['approved', 'in-progress'].includes(String(fm.status ?? '')) &&
    !/^phase-/.test(basename) &&
    (fm.phase === undefined || fm.phase === null || String(fm.phase).trim() === '')
  ) {
    results.push({ field: 'phase', severity: 'warn', message: 'Active plan has no phase assignment — set phase: in frontmatter' });
  }

  // Approved proposal should have related_to populated (Part B — knowledge graph foundation)
  if (
    filePath.startsWith('proposals/') &&
    fm.approved === true &&
    (fm.related_to === undefined || fm.related_to === null ||
      (Array.isArray(fm.related_to) && fm.related_to.length === 0))
  ) {
    results.push({
      field: 'related_to',
      severity: 'warn',
      message: "Approved proposal has no related_to entries — link to related proposals, plans, or research; or confirm this is intentionally standalone",
    });
  }

  // Active plan should have proposal_source set (Part A — knowledge graph foundation)
  if (
    filePath.startsWith('plans/') &&
    !filePath.startsWith('plans/completed/') &&
    !/^phase-/.test(basename) &&
    !['completed', 'canceled'].includes(String(fm.status ?? '')) &&
    (fm.proposal_source === undefined || fm.proposal_source === null || fm.proposal_source === '')
  ) {
    results.push({
      field: 'proposal_source',
      severity: 'warn',
      message: "Active plan has no proposal_source — set to the originating proposal path, or 'none' if created without a proposal",
    });
  }

  // Suggest parent_plan for Phase 2+ plan documents (non-phase-overview) that lack it
  if (
    filePath.startsWith('plans/') &&
    !filePath.startsWith('plans/completed/') &&
    !/^phase-/.test(filePath.replace(/^.*\//, '')) &&
    fm.phase &&
    parseInt(String(fm.phase)) >= 2 &&
    !fm.parent_plan
  ) {
    results.push({
      field: 'parent_plan',
      severity: 'warn',
      message: `Phase ${fm.phase} plan without parent_plan — consider setting parent_plan to the phase overview plan`,
    });
  }

  // Stale parent detection: completed sub-plan whose parent deliverable isn't ✅
  if (
    filePath.startsWith('plans/') &&
    fm.status === 'completed' &&
    fm.parent_plan &&
    fm.parent_deliverable
  ) {
    const parentPlan = String(fm.parent_plan);
    const deliverableNum = String(fm.parent_deliverable);
    const key = `${parentPlan}|${deliverableNum}`;
    const parentStatus = parentStatuses?.[key];
    if (parentStatus && parentStatus !== '✅ Done' && parentStatus !== '✅') {
      results.push({
        field: 'parent_plan',
        severity: 'warn',
        message: `sub-plan complete but parent deliverable #${deliverableNum} in ${parentPlan} still shows "${parentStatus}"`,
      });
    }
  }

  // Research document rules
  if (filePath.startsWith('research/')) {
    if (fm.status !== undefined && !VALID_RESEARCH_STATUS.has(String(fm.status))) {
      results.push({ field: 'status', severity: 'error', message: `Research status must be active | concluded | archived, got '${fm.status}'` });
    }
    if (fm.conclusion !== undefined && !VALID_RESEARCH_CONCLUSION.has(String(fm.conclusion))) {
      results.push({ field: 'conclusion', severity: 'error', message: `conclusion must be open | recommends | inconclusive | superseded, got '${fm.conclusion}'` });
    }
    // Cross-field: concluded requires a non-empty conclusion
    if (fm.status === 'concluded' && (!fm.conclusion || String(fm.conclusion).trim() === '')) {
      results.push({ field: 'conclusion', severity: 'error', message: "status: concluded requires a non-empty 'conclusion' field" });
    }
    // Cross-field: archived without ever concluding is allowed only if conclusion=inconclusive
    if (fm.status === 'archived' && fm.conclusion !== undefined && !VALID_RESEARCH_CONCLUSION.has(String(fm.conclusion))) {
      results.push({ field: 'conclusion', severity: 'warn', message: 'Archived research should have a valid conclusion value' });
    }
  }

  return results;
}

// ── Diff annotation ────────────────────────────────────────────────────────

export interface FieldChange {
  field: string;
  before: string;
  after: string;
}

export type GovFlag = 'approval' | 'gate-status' | 'ai-stamp' | 'lifecycle' | 'priority';

export interface DiffAnnotation {
  changedFields: FieldChange[];
  statusTransition?: { from: string; to: string };
  gateFlags: GovFlag[];
}

const GOVERNANCE_FIELDS = new Set([
  'status', 'approved', 'gate_status', 'priority', 'assigned_to',
  'mode', 'automated', 'ai-last-action', 'author-role',
]);

export function diffAnnotate(_filePath: string, before: string, after: string): DiffAnnotation {
  const fmBefore = parseFrontmatter(before);
  const fmAfter  = parseFrontmatter(after);

  const changedFields: FieldChange[] = [];
  const flags = new Set<GovFlag>();
  let statusTransition: { from: string; to: string } | undefined;

  const allFields = new Set([...Object.keys(fmBefore), ...Object.keys(fmAfter)]);

  for (const field of allFields) {
    if (!GOVERNANCE_FIELDS.has(field)) continue;
    const bv = fmBefore[field] !== undefined ? String(fmBefore[field]) : '';
    const av = fmAfter[field]  !== undefined ? String(fmAfter[field])  : '';
    if (bv === av) continue;

    changedFields.push({ field, before: bv || '(empty)', after: av || '(empty)' });

    if (field === 'status') {
      statusTransition = { from: bv || '(none)', to: av || '(none)' };
      flags.add('lifecycle');
    }
    if (field === 'approved' && fmAfter.approved === true) flags.add('approval');
    if (field === 'gate_status')    flags.add('gate-status');
    if (field === 'ai-last-action') flags.add('ai-stamp');
    if (field === 'priority')       flags.add('priority');
  }

  return { changedFields, statusTransition, gateFlags: [...flags] };
}
