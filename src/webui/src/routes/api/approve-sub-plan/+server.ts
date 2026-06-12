import { json } from '@sveltejs/kit';
import path from 'node:path';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

export async function POST({ request }) {
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
    return json({ ok: true, message: result });
  } catch (err: any) {
    return json({ error: err.message }, { status: 500 });
  }
}
