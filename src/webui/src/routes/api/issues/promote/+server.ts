import path from 'node:path';
import { json } from '@sveltejs/kit';
import { promoteIssueToGithub } from '../../../../../../dispatch/bridge';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

export async function POST({ request }) {
  try {
    const { issuePath } = await request.json();
    if (!issuePath) {
      return json({ error: 'issuePath is required' }, { status: 400 });
    }
    const result = promoteIssueToGithub(REPO_ROOT, issuePath);
    return json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal server error';
    const status = /must be under issues\//.test(message) ? 400
      : /File not found/.test(message) ? 404
      : /Already linked/.test(message) ? 409
      : /GitHub CLI failed/.test(message) ? 502
      : 500;
    return json({ error: message }, { status });
  }
}
