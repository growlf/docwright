import path from 'node:path';
import { json } from '@sveltejs/kit';
import { captureConfirm } from '../../../../../../../dispatch/capture';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

// Phase 2a: the reporter confirmed their report matches an existing bug — +1 demand and
// harvest their context onto the canonical issue.
export async function POST({ request }) {
  try {
    const { canonicalPath, title, description, reporter, priority, system_info } = await request.json();
    if (!canonicalPath || !description || !reporter) {
      return json({ error: 'canonicalPath, description and reporter are required' }, { status: 400 });
    }
    const result = await captureConfirm(REPO_ROOT, canonicalPath, { title, description, reporter, priority, system_info });
    return json({ ok: true, ...result });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'internal server error' }, { status: 500 });
  }
}
