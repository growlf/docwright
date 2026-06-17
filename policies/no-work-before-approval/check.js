// no-work-before-approval check — compiled artifact (mirrors check.ts).
const ACTIVE_STATUSES = ['approved', 'in-progress'];

export function check(ctx) {
  const status   = ctx.frontmatter['status'];
  const assigned = ctx.frontmatter['assigned_to'];

  if (!status || !ACTIVE_STATUSES.includes(status)) {
    return { pass: true, message: `status '${status ?? 'missing'}' does not require assigned_to`, atom_id: 'no-work-before-approval' };
  }

  const assignedVal = Array.isArray(assigned) ? assigned[0] : assigned;
  const isEmpty = !assignedVal || String(assignedVal).trim() === '' || String(assignedVal).trim().toLowerCase() === 'none';

  if (isEmpty) {
    return {
      pass: false,
      message: `plan has status '${status}' but assigned_to is empty — active plans must have an assignee`,
      atom_id: 'no-work-before-approval',
    };
  }

  return { pass: true, message: `plan status '${status}' with assignee '${assignedVal}' — valid`, atom_id: 'no-work-before-approval' };
}
