import { ProfileConfig } from './profile';

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
const VALID_PLAN_STATUS       = new Set(['draft', 'approved', 'in-progress', 'completed', 'canceled']);
const VALID_RESEARCH_STATUS   = new Set(['active', 'concluded', 'archived']);
const VALID_RESEARCH_CONCLUSION = new Set(['open', 'recommends', 'inconclusive', 'superseded']);

export function lintDocument(
  filePath: string,
  fm: Record<string, any>,
  _profile: ProfileConfig,
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
  if (fm.automated !== undefined && fm.automated !== '' && !VALID_AUTOMATED.has(String(fm.automated))) {
    results.push({ field: 'automated', severity: 'error', message: 'automated must be off | guided | full' });
  }
  if (filePath.startsWith('plans/') && fm.status !== undefined && !VALID_PLAN_STATUS.has(String(fm.status))) {
    results.push({ field: 'status', severity: 'warn', message: `Unknown plan status '${fm.status}'` });
  }

  // Approved proposal should have assigned_to
  if (fm.approved === true && (fm.assigned_to === undefined || fm.assigned_to === '')) {
    results.push({ field: 'assigned_to', severity: 'warn', message: 'Approved but assigned_to is empty' });
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
