/**
 * no-work-before-approval check — canonical TypeScript source.
 * Plans at approved/in-progress status must have assigned_to set.
 * Mirrors validate_assigned_to(FILE, "plan") in scripts/pre-commit.sh.
 */
import type { CheckContext, CheckResult } from '../../src/policy-atoms-core/schema.js';

const ACTIVE_STATUSES = ['approved', 'in-progress'];

export function check(ctx: CheckContext): CheckResult {
  const status   = ctx.frontmatter['status']      as string | undefined;
  const assigned = ctx.frontmatter['assigned_to'] as string | string[] | undefined;

  // Only enforce on active statuses
  if (!status || !ACTIVE_STATUSES.includes(status)) {
    return { pass: true, message: `status '${status ?? 'missing'}' does not require assigned_to`, atom_id: 'no-work-before-approval' };
  }

  const assignedVal = Array.isArray(assigned) ? assigned[0] : assigned;
  const isEmpty = !assignedVal || assignedVal.trim() === '' || assignedVal.trim().toLowerCase() === 'none';

  if (isEmpty) {
    return {
      pass: false,
      message: `plan has status '${status}' but assigned_to is empty — active plans must have an assignee`,
      atom_id: 'no-work-before-approval',
    };
  }

  return { pass: true, message: `plan status '${status}' with assignee '${assignedVal}' — valid`, atom_id: 'no-work-before-approval' };
}
