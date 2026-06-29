import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { json } from '@sveltejs/kit';
import { diffAnnotate } from '../../../../../dispatch/linter';

const REPO = process.env.DOCWRIGHT_ROOT ?? resolve(process.cwd(), '../..');

function gitShow(filePath: string): string {
  try {
    return execSync(`git show HEAD:${filePath}`, {
      cwd: REPO,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return ''; // new file: no HEAD version
  }
}

export async function POST({ request }) {
  let body: { paths?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { paths } = body;
  if (!Array.isArray(paths) || paths.length === 0) {
    return json({ error: 'paths array required' }, { status: 400 });
  }

  const result: Record<string, ReturnType<typeof diffAnnotate>> = {};

  for (const rawPath of (paths as unknown[]).slice(0, 30)) {
    if (typeof rawPath !== 'string') continue;
    if (rawPath.startsWith('/')) continue; // reject absolute paths
    const resolved = join(REPO, rawPath);
    // Security: confine to repo root
    if (!resolved.startsWith(REPO + '/')) continue;

    const before = gitShow(rawPath);
    const after  = existsSync(resolved) ? readFileSync(resolved, 'utf-8') : '';

    result[rawPath] = diffAnnotate(rawPath, before, after);
  }

  return json(result);
}
