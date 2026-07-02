/**
 * Shared server-side git commit helper (#110).
 *
 * Commits are always human-initiated from the authenticated Web UI, so they carry the
 * user's identity and HUMAN_APPROVED (the authenticated click is the seal). Local commit
 * only — pushing stays a separate, explicit action, so this never touches a protected remote.
 */
import { execSync, spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface GitUser {
  displayName: string;
  email: string;
}

export type CommitOutcome =
  | { ok: true; sha: string }
  | { ok: false; error: string };

function gitEnv(repo: string, user?: GitUser | null): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_DIR: join(repo, '.git'),
    GIT_WORK_TREE: repo,
    HUMAN_APPROVED: '1',
  };
  if (user) {
    env.GIT_AUTHOR_NAME = user.displayName;
    env.GIT_AUTHOR_EMAIL = user.email;
    env.GIT_COMMITTER_NAME = user.displayName;
    env.GIT_COMMITTER_EMAIL = user.email;
  }
  return env;
}

/**
 * Stage (optional) + commit. If `stagePaths` is given, `git add -A -- <paths>` runs first
 * (staging adds/mods/deletes for exactly those paths); otherwise the already-staged index is
 * committed. Returns the short SHA or a structured error — never throws.
 */
export function commitPaths(
  repo: string,
  opts: { message: string; stagePaths?: string[]; user?: GitUser | null },
): CommitOutcome {
  const { message, stagePaths, user } = opts;
  const env = gitEnv(repo, user);

  if (stagePaths && stagePaths.length > 0) {
    const add = spawnSync('git', ['add', '-A', '--', ...stagePaths], { cwd: repo, encoding: 'utf-8', env });
    if (add.status !== 0) {
      return { ok: false, error: (add.stdout + add.stderr).trim() || 'git add failed' };
    }
  }

  const msgFile = join(tmpdir(), `dw-commit-${process.pid}-${Math.round(process.hrtime()[1])}.txt`);
  try {
    // Seed COMMIT_EDITMSG so the commit-msg hook reads the real message.
    mkdirSync(join(repo, '.git'), { recursive: true });
    writeFileSync(join(repo, '.git', 'COMMIT_EDITMSG'), message + '\n');
    writeFileSync(msgFile, message + '\n');

    const res = spawnSync('git', ['commit', '-F', msgFile], { cwd: repo, encoding: 'utf-8', env });
    if (res.status !== 0) {
      const out = (res.stdout + res.stderr).trim();
      // "nothing to commit" is not an error worth failing the caller over.
      if (/nothing to commit/i.test(out)) return { ok: false, error: 'nothing to commit' };
      return { ok: false, error: out || 'Commit failed' };
    }
    const sha = execSync('git rev-parse --short HEAD', { cwd: repo, encoding: 'utf-8' }).trim();
    return { ok: true, sha };
  } finally {
    try { unlinkSync(msgFile); } catch { /* ignore */ }
  }
}
