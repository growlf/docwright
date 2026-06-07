import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { json } from '@sveltejs/kit';

const REPO = process.env.DOCWRIGHT_ROOT ?? resolve(process.cwd(), '../..');

// Only 0.x.x tags are permitted (per policies/core/versioning.md).
// Major version changes require an approved release plan.
const TAG_RE = /^v?0\.\d+\.\d+(-[\w.]+)?$/;

export async function POST({ request }) {
  const body = await request.json().catch(() => null);
  const name: string    = (body?.name ?? '').trim();
  const message: string = (body?.message ?? name).trim();

  if (!name)         return json({ error: 'missing tag name' }, { status: 400 });
  if (!TAG_RE.test(name)) return json({ error: 'Tag name must be semver, e.g. v1.2.3' }, { status: 400 });

  // Create annotated tag
  const tag = spawnSync('git', ['tag', '-a', name, '-m', message], {
    cwd: REPO, encoding: 'utf-8',
  });

  if (tag.status !== 0) {
    const out = (tag.stdout + tag.stderr).trim();
    const hint = out.includes('already exists') ? `Tag ${name} already exists` : out;
    return json({ error: hint }, { status: 422 });
  }

  // Push the tag immediately
  const push = spawnSync('git', ['push', 'origin', name], {
    cwd: REPO, encoding: 'utf-8',
  });

  if (push.status !== 0) {
    // Tag was created locally — report partial success
    return json({ tag: name, pushed: false, pushError: (push.stdout + push.stderr).trim() });
  }

  return json({ tag: name, pushed: true });
}
