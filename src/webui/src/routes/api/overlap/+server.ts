/**
 * /api/overlap — find semantically similar proposals/plans.
 *
 * Delegates to src/dispatch/ai.ts — KeywordEngine (Jaccard) by default,
 * OpenCodeEngine (real LLM) when OPENCODE_URL env is set.
 * The response shape is identical regardless of engine; UI changes nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { getAIEngine } from '../../../../../dispatch/ai';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT ?? path.resolve(process.cwd(), '../..');

const SCAN_DIRS = ['proposals', 'proposals/approved', 'plans'];

function collectCandidates(exclude: string): string[] {
  const results: string[] = [];
  for (const dir of SCAN_DIRS) {
    const full = path.join(REPO_ROOT, dir);
    if (!fs.existsSync(full)) continue;
    for (const name of fs.readdirSync(full)) {
      if (!name.endsWith('.md')) continue;
      const rel = `${dir}/${name}`;
      if (rel === exclude) continue;
      const raw = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8');
      if (/^subsumed_by:\s*.+/m.test(raw)) continue;
      if (/^status:\s*(completed|canceled)/m.test(raw)) continue;
      results.push(rel);
    }
  }
  return results;
}

export async function GET({ url }) {
  const filePath = url.searchParams.get('path');
  if (!filePath) return json({ error: 'missing path' }, { status: 400 });

  const resolved = path.resolve(REPO_ROOT, filePath);
  if (!resolved.startsWith(REPO_ROOT)) return json({ error: 'invalid path' }, { status: 403 });
  if (!fs.existsSync(resolved)) return json({ error: 'not found' }, { status: 404 });

  const candidates = collectCandidates(filePath);
  const engine = getAIEngine(REPO_ROOT);
  const matches = await engine.findSimilar(filePath, candidates, REPO_ROOT);

  return json({ matches });
}
