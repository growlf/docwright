/**
 * /api/overlap — find semantically similar proposals/plans.
 *
 * Uses multi-signal relationship engine (Jaccard + tag + phase + author + wikilink)
 * from src/dispatch/relationships.ts.
 *
 * Returns both `matches` (SimilarityResult[] for backward compat) and
 * `relationships` (RelationshipResult[] with type classification).
 */
import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { scanProposal, computeSignals, computeConfidence } from '../../../../../dispatch/relationships';
import { getActiveProfile } from '../../../../../dispatch/profile';
import { parseFrontmatter, getFrontmatterTitle } from '../../../../../dispatch/frontmatter';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT ?? path.resolve(process.cwd(), '../..');

const SCAN_DIRS = ['proposals', 'proposals/approved', 'plans', 'research'];

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
      const isResearch = rel.startsWith('research/');
      // Research: skip archived only (concluded research still informs proposals)
      // Proposals/plans: skip completed and canceled
      if (isResearch && /^status:\s*archived/m.test(raw)) continue;
      if (!isResearch && /^status:\s*(completed|canceled)/m.test(raw)) continue;
      results.push(rel);
    }
  }
  return results;
}

function getExplicitRefs(raw: string): string[] {
  const fm = parseFrontmatter(raw);
  const fields = ['related_to', 'depends_on', 'blocks', 'absorbs'];
  const refs: string[] = [];
  for (const f of fields) {
    const val = fm[f];
    if (Array.isArray(val)) refs.push(...val.map(String));
    else if (typeof val === 'string' && val.trim()) refs.push(val.trim());
  }
  return refs.filter(r => r.endsWith('.md'));
}

export async function GET({ url }) {
  const filePath = url.searchParams.get('path');
  if (!filePath) return json({ error: 'missing path' }, { status: 400 });

  const resolved = path.resolve(REPO_ROOT, filePath);
  if (!resolved.startsWith(REPO_ROOT)) return json({ error: 'invalid path' }, { status: 403 });
  if (!fs.existsSync(resolved)) return json({ error: 'not found' }, { status: 404 });

  const targetRaw = fs.readFileSync(resolved, 'utf-8');
  const candidates = collectCandidates(filePath);
  const profile = getActiveProfile(REPO_ROOT);
  const threshold = profile?.relationshipEngine?.similarity_threshold ?? 0.3;
  const relationships = scanProposal(filePath, candidates, REPO_ROOT, threshold);

  // Force-include explicitly referenced docs that didn't score above threshold.
  // A doc the author explicitly linked deserves to appear regardless of content similarity.
  // Also try plans/completed/<name> as a fallback for refs that predate the move.
  const alreadyTargets = new Set(relationships.map(r => r.target));
  for (const rawRef of getExplicitRefs(targetRaw)) {
    const candidates2 = [rawRef];
    if (rawRef.startsWith('plans/') && !rawRef.startsWith('plans/completed/')) {
      candidates2.push('plans/completed/' + path.basename(rawRef));
    }
    const ref = candidates2.find(c => {
      const r = path.resolve(REPO_ROOT, c);
      return r.startsWith(REPO_ROOT) && fs.existsSync(r);
    });
    if (!ref) continue;
    if (alreadyTargets.has(ref)) continue;
    const refResolved = path.resolve(REPO_ROOT, ref);
    if (!refResolved.startsWith(REPO_ROOT)) continue;
    if (!fs.existsSync(refResolved)) continue;
    const refRaw = fs.readFileSync(refResolved, 'utf-8');
    const signals = computeSignals(targetRaw, refRaw, filePath, ref);
    const confidence = computeConfidence(signals);
    relationships.push({
      source: filePath,
      target: ref,
      type: 'related_to',
      confidence,
      signals,
      targetTitle: getFrontmatterTitle(refRaw) || path.basename(ref, '.md'),
    });
    alreadyTargets.add(ref);
  }

  // Backward-compat matches format for existing CollationPanel
  const matches = relationships.map(r => ({
    path: r.target,
    title: r.targetTitle,
    score: r.confidence,
    sections: [] as Array<{ heading: string; content: string }>,
  }));

  return json({ matches, relationships });
}
