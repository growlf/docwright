import path from 'node:path';
import { json } from '@sveltejs/kit';
import { captureCreate } from '../../../../../../../dispatch/capture';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

// Phase 2b: no existing bug matched — file a new one, cross-linking any near-misses the
// reporter was shown (the association tier: `related`, not a demand increment).
export async function POST({ request }) {
  try {
    const { title, description, reporter, priority, system_info, milestone, category, related } = await request.json();
    if (!title || !description || !reporter) {
      return json({ error: 'title, description and reporter are required' }, { status: 400 });
    }
    const result = await captureCreate(
      REPO_ROOT,
      { title, description, reporter, priority, system_info, milestone, category },
      Array.isArray(related) ? related : [],
    );
    return json({ ok: true, ...result });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'internal server error' }, { status: 500 });
  }
}
