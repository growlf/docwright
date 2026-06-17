/**
 * no-work-before-approval check — canonical TypeScript source.
 * Plans at approved/in-progress status must have assigned_to set.
 * Mirrors validate_assigned_to(FILE, "plan") in scripts/pre-commit.sh.
 */
import { fieldRequiredWhen } from '../../src/policy-atoms-core/checks/field-required-when.js';
import type { CheckContext, CheckResult } from '../../src/policy-atoms-core/schema.js';

const requireAssignee = fieldRequiredWhen('assigned_to', 'status', ['approved', 'in-progress']);

export function check(ctx: CheckContext): CheckResult {
  const result = requireAssignee(ctx);
  return { ...result, atom_id: 'no-work-before-approval' };
}
