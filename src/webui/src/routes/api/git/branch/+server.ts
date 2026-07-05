import { execSync, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';

const REPO = process.env.DOCWRIGHT_ROOT ?? resolve(process.cwd(), '../..');
// The app's own source tree (the webui lives at <src-tree>/src/webui).
const APP_SRC = resolve(process.cwd(), '../..');

function git(cmd: string, cwd = REPO): string {
  try {
    return execSync(`git ${cmd}`, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd();
  } catch {
    return '';
  }
}

function listBranches(): string[] {
  return git('branch --format=%(refname:short)').split('\n').map((s) => s.trim()).filter(Boolean);
}

function isDirty(): boolean {
  return git('status --porcelain').length > 0;
}

// #1 (dogfood-dev) serves ITSELF: its vault is the running source tree, so switching the
// vault's branch also swaps the app's own code. Detect by comparing git top-levels so the
// UI can warn. Content-vault instances (#2/#3/#4) return false — switching is content-only.
function vaultIsSourceTree(): boolean {
  const vaultTop = git('rev-parse --show-toplevel', REPO);
  const appTop = git('rev-parse --show-toplevel', APP_SRC);
  return !!vaultTop && vaultTop === appTop;
}

// GET is read-only (mirrors /api/git/status, which is unauthenticated).
export function GET() {
  return json({
    current: git('rev-parse --abbrev-ref HEAD') || 'unknown',
    branches: listBranches(),
    dirty: isDirty(),
    vaultIsSourceTree: vaultIsSourceTree(),
  });
}

const BRANCH_RE = /^[A-Za-z0-9._/-]+$/;

export const POST = requireAuth(async ({ request }) => {
  const body = await request.json().catch(() => null);
  const branch: string = (body?.branch ?? '').trim();
  const create: boolean = body?.create === true;

  if (!branch) return json({ error: 'missing branch' }, { status: 400 });
  if (!BRANCH_RE.test(branch)) return json({ error: 'invalid branch name' }, { status: 400 });
  if (isDirty())
    return json(
      { error: 'Working tree has uncommitted changes — commit or discard before switching branches.' },
      { status: 409 },
    );
  if (!create && !listBranches().includes(branch))
    return json({ error: `unknown branch: ${branch}` }, { status: 404 });

  try {
    // execFileSync (args array) — no shell, so the validated branch name can't inject.
    execFileSync('git', create ? ['checkout', '-b', branch] : ['checkout', branch], {
      cwd: REPO,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    const err = e as { stderr?: string; message?: string };
    return json({ error: 'checkout failed: ' + String(err.stderr || err.message || e).slice(0, 300) }, { status: 422 });
  }

  return json({ current: git('rev-parse --abbrev-ref HEAD') || branch });
});
