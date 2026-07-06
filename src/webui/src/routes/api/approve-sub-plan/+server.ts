import { json } from '@sveltejs/kit';
import path from 'node:path';
import { requireAuth } from '$lib/server/auth.js';
import { commitPaths } from '$lib/server/git-commit.js';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

export const POST = requireAuth(async ({ request, locals }) => {
  const body = await request.json().catch(() => ({}));
  const parentPlan = String(body.parent_plan || '').trim();
  const proposalName = String(body.proposal_name || '').trim();

  if (!parentPlan) return json({ error: 'missing parent_plan' }, { status: 400 });
  if (!proposalName) return json({ error: 'missing proposal_name' }, { status: 400 });

  try {
    const { setRepoRoot } = await import('../../../../../mcp/lib/paths');
    const { approveSubPlan } = await import('../../../../../mcp/tools/transitions');
    setRepoRoot(REPO_ROOT);
    const result = await approveSubPlan(parentPlan, proposalName);
    if (result.startsWith('ERROR')) return json({ error: result }, { status: 422 });

    // Persist the approval so it isn't left as a silent, uncommitted change
    // (#147). approveSubPlan touches the proposal (improved + approved), its
    // proposals/approved/ destination, the generated sub-plan, and the parent
    // plan's deliverable row. Local commit only; non-fatal on failure.
    const propSafe = proposalName.endsWith('.md') ? proposalName : `${proposalName}.md`;
    const parentSafe = parentPlan.endsWith('.md') ? parentPlan : `${parentPlan}.md`;
    const slug = propSafe.replace(/\.md$/, '');
    const commit = commitPaths(REPO_ROOT, {
      message: `docs: approve sub-plan ${slug} (proposal → plan)\n\nHUMAN-APPROVED:${slug}`,
      stagePaths: [
        `proposals/${propSafe}`,
        `proposals/approved/${propSafe}`,
        `plans/${propSafe}`,
        `plans/${parentSafe}`,
      ],
      user: locals.user,
    });

    return json({
      ok: true,
      message: result,
      committed: commit.ok ? commit.sha : null,
      commitError: commit.ok ? null : commit.error,
    });
  } catch (err: any) {
    return json({ error: err.message }, { status: 500 });
  }
});
