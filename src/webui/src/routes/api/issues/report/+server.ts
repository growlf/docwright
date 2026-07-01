import path from 'node:path';
import { json } from '@sveltejs/kit';
import { reportBug } from '../../../../../../dispatch/bridge';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

export async function POST({ request }) {
  try {
    const { title, description, reporter, priority, system_info, milestone } = await request.json();
    if (!title || !description || !reporter) {
      return json({ error: 'missing required fields: title, description, and reporter are required' }, { status: 400 });
    }

    const result = reportBug(REPO_ROOT, {
      title,
      description,
      reporter,
      priority,
      system_info,
      milestone,
    });

    return json({
      ok: true,
      ...result,
    });
  } catch (err: any) {
    return json({ error: err.message || 'internal server error' }, { status: 500 });
  }
}
