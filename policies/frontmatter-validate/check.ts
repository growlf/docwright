/**
 * frontmatter-validate check — canonical TypeScript source.
 * Routes required-field checks based on filePath (proposal vs plan).
 * Mirrors validate_required_fields() in scripts/pre-commit.sh.
 */
import { fieldRequired } from '../../src/policy-atoms-core/checks/field-required.js';
import type { CheckContext, CheckResult } from '../../src/policy-atoms-core/schema.js';

const PROPOSAL_FIELDS = ['title', 'author', 'created', 'tags', 'approved', 'created_by', 'assigned_to'];
// 'mode' is the canonical field (renamed from 'automated' per execution-mode research).
// Accept either during the transition period.
const PLAN_FIELDS     = ['title', 'status', 'author', 'created', 'proposal_source', 'priority', 'assigned_to'];

export function check(ctx: CheckContext): CheckResult {
  const isProposal = ctx.filePath.match(/^proposals\/[^/]+\.md$/) &&
                     !ctx.filePath.includes('proposals/approved/');
  const isPlan     = ctx.filePath.match(/^plans\/[^/]+\.md$/) &&
                     !ctx.filePath.includes('plans/completed/');

  const fields = isProposal ? PROPOSAL_FIELDS : isPlan ? PLAN_FIELDS : null;

  if (!fields) {
    return { pass: true, message: 'file not in a governed directory — skipped', atom_id: 'frontmatter-validate' };
  }

  for (const field of fields) {
    // Special case: 'mode' and 'automated' are synonyms during field rename transition.
    if (field === 'mode' || field === 'automated') {
      const hasMode = ctx.frontmatter['mode'] !== undefined && ctx.frontmatter['mode'] !== '';
      const hasAuto = ctx.frontmatter['automated'] !== undefined && ctx.frontmatter['automated'] !== '';
      if (!hasMode && !hasAuto) {
        return { pass: false, message: "required field 'mode' (or legacy 'automated') is missing", atom_id: 'frontmatter-validate' };
      }
      continue;
    }
    const result = fieldRequired(field)(ctx);
    if (!result.pass) {
      return { ...result, atom_id: 'frontmatter-validate' };
    }
  }

  return { pass: true, message: 'all required frontmatter fields present', atom_id: 'frontmatter-validate' };
}
