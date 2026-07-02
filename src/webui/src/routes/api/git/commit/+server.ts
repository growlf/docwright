import { resolve } from 'node:path';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { commitPaths } from '$lib/server/git-commit.js';

const REPO = process.env.DOCWRIGHT_ROOT ?? resolve(process.cwd(), '../..');

// Same regex as commit-msg hook
const MSG_RE = /^(feat|fix|docs|refactor|test|chore|policy|decision): .+/;

// Injection guard — message must not contain shell metacharacters beyond what
// a conventional commit message would normally use
const SAFE_RE = /^[\w\s:.,!?()[\]{}\-_@#/'"*+<>~`|&=]+$/;

export const POST = requireAuth(async ({ request, locals }) => {
  const body = await request.json().catch(() => null);
  const message: string = body?.message?.trim() ?? '';

  if (!message)
    return json({ error: 'missing message' }, { status: 400 });

  if (!MSG_RE.test(message))
    return json({ error: 'Message must follow <type>: <description>. Types: feat, fix, docs, refactor, test, chore, policy, decision' }, { status: 400 });

  if (!SAFE_RE.test(message))
    return json({ error: 'Message contains disallowed characters' }, { status: 400 });

  // Commit the already-staged index (no stagePaths).
  const result = commitPaths(REPO, { message, user: locals.user });
  if (!result.ok) return json({ error: result.error }, { status: 422 });
  return json({ sha: result.sha, message });
});
