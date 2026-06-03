import { execSync, spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { json } from '@sveltejs/kit';

const REPO = process.env.DOCWRIGHT_ROOT ?? resolve(process.cwd(), '../..');

// Same regex as commit-msg hook
const MSG_RE = /^(feat|fix|docs|refactor|test|chore|policy|decision): .+/;

// Injection guard — message must not contain shell metacharacters beyond what
// a conventional commit message would normally use
const SAFE_RE = /^[\w\s:.,!?()\[\]{}\-_@#/'"*+<>~`|&=]+$/;

export async function POST({ request }) {
  const body = await request.json().catch(() => null);
  const message: string = body?.message?.trim() ?? '';

  if (!message)
    return json({ error: 'missing message' }, { status: 400 });

  if (!MSG_RE.test(message))
    return json({ error: 'Message must follow <type>: <description>. Types: feat, fix, docs, refactor, test, chore, policy, decision' }, { status: 400 });

  if (!SAFE_RE.test(message))
    return json({ error: 'Message contains disallowed characters' }, { status: 400 });

  // Write message to temp file — avoids any shell interpolation of the message
  const msgFile = join(tmpdir(), `docwright-commit-${Date.now()}.txt`);
  try {
    // Also seed COMMIT_EDITMSG so the pre-commit hook reads the correct message
    mkdirSync(join(REPO, '.git'), { recursive: true });
    writeFileSync(join(REPO, '.git', 'COMMIT_EDITMSG'), message + '\n');
    writeFileSync(msgFile, message + '\n');

    const result = spawnSync('git', ['commit', '-F', msgFile], {
      cwd: REPO,
      encoding: 'utf-8',
      env: { ...process.env, GIT_DIR: join(REPO, '.git'), GIT_WORK_TREE: REPO },
    });

    if (result.status !== 0) {
      const output = (result.stdout + result.stderr).trim();
      return json({ error: output || 'Commit failed' }, { status: 422 });
    }

    // Extract SHA from output
    const sha = execSync('git rev-parse --short HEAD', { cwd: REPO, encoding: 'utf-8' }).trim();
    return json({ sha, message });
  } finally {
    try { unlinkSync(msgFile); } catch { /* ignore */ }
  }
}
