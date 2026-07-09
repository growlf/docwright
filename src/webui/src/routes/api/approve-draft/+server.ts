import { json } from '@sveltejs/kit';
import path from 'node:path';
import fs from 'node:fs';
import { requireAuth } from '$lib/server/auth';
import { commitPaths } from '$lib/server/git-commit';
import { setFrontmatterField } from '../../../../../dispatch/frontmatter';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

export const POST = requireAuth(async ({ request, locals }) => {
  const body = await request.json().catch(() => ({}));
  const planPath = String(body.path || '').trim();

  if (!planPath) return json({ error: 'missing path' }, { status: 400 });

  const fullPath = path.join(REPO_ROOT, planPath);
  if (!fs.existsSync(fullPath)) {
    return json({ error: 'plan not found' }, { status: 404 });
  }

  try {
    const raw = fs.readFileSync(fullPath, 'utf-8');
    const updated = setFrontmatterField(raw, 'status', 'approved');
    fs.writeFileSync(fullPath, updated, 'utf-8');

    const commit = commitPaths(REPO_ROOT, {
      message: `docs: approve draft plan ${path.basename(planPath, '.md')}`,
      stagePaths: [planPath],
      user: locals.user,
    });

    return json({
      ok: true,
      committed: commit.ok ? commit.sha : null,
      commitError: commit.ok ? null : commit.error,
    });
  } catch (err: any) {
    return json({ error: err.message }, { status: 500 });
  }
});
