/**
 * lifecycle-gate check — canonical TypeScript source.
 * Validates structural completeness for plan lifecycle transitions.
 */
import { fieldRequiredWhen } from '../../src/policy-atoms-core/checks/field-required-when.js';
import type { CheckContext, CheckResult } from '../../src/policy-atoms-core/schema.js';

const requireCompletedDate    = fieldRequiredWhen('completed_date',    'status', ['completed']);
const requireCanceledDate     = fieldRequiredWhen('canceled_date',     'status', ['canceled']);
const requireCancelReason     = fieldRequiredWhen('cancellation_reason','status', ['canceled']);

export function check(ctx: CheckContext): CheckResult {
  // Check completed_date
  const r1 = requireCompletedDate(ctx);
  if (!r1.pass) return { ...r1, atom_id: 'lifecycle-gate' };

  // Check canceled_date + cancellation_reason
  const r2 = requireCanceledDate(ctx);
  if (!r2.pass) return { ...r2, atom_id: 'lifecycle-gate' };

  const r3 = requireCancelReason(ctx);
  if (!r3.pass) return { ...r3, atom_id: 'lifecycle-gate' };

  // gate_status and approved: true are hard-blocked by the MCP server;
  // here we surface a clear diagnostic if they appear in a write context.
  const gate = ctx.frontmatter['gate_status'] as string | undefined;
  if (gate === 'approved' || gate === 'waived') {
    return { pass: false, message: `gate_status: '${gate}' must be set by a human reviewer — AI cannot approve or waive gates`, atom_id: 'lifecycle-gate' };
  }

  return { pass: true, message: 'lifecycle gate fields are structurally valid', atom_id: 'lifecycle-gate' };
}
