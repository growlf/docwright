// frontmatter-validate check — compiled artifact (mirrors check.ts).
const PROPOSAL_FIELDS = ['title', 'author', 'created', 'tags', 'approved', 'created_by', 'assigned_to'];
const PLAN_FIELDS     = ['title', 'status', 'author', 'created', 'proposal_source', 'priority', 'assigned_to'];

function fieldRequired(field) {
  return (ctx) => {
    const val = ctx.frontmatter[field];
    const missing = val === undefined || val === null || val === '' ||
      (Array.isArray(val) && val.length === 0);
    return {
      pass: !missing,
      message: missing
        ? `required frontmatter field '${field}' is missing or empty`
        : `field '${field}' present`,
      atom_id: '',
    };
  };
}

export function check(ctx) {
  const isProposal = /^proposals\/[^/]+\.md$/.test(ctx.filePath) &&
                     !ctx.filePath.includes('proposals/approved/');
  const isPlan     = /^plans\/[^/]+\.md$/.test(ctx.filePath) &&
                     !ctx.filePath.includes('plans/completed/');

  const fields = isProposal ? PROPOSAL_FIELDS : isPlan ? PLAN_FIELDS : null;

  if (!fields) {
    return { pass: true, message: 'file not in a governed directory — skipped', atom_id: 'frontmatter-validate' };
  }

  for (const field of fields) {
    const result = fieldRequired(field)(ctx);
    if (!result.pass) {
      return { ...result, atom_id: 'frontmatter-validate' };
    }
  }

  return { pass: true, message: 'all required frontmatter fields present', atom_id: 'frontmatter-validate' };
}
