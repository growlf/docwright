import path from 'node:path';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { closePhase, phaseReadiness } from '../../../../../../dispatch/phase-close-core';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

/** GET ?phase=N → readiness for the banner (which plans are done / still open). */
export const GET = requireAuth(async ({ url }) => {
  const phase = Number(url.searchParams.get('phase'));
  if (!phase || phase < 1) return json({ error: 'phase query param (≥1) required' }, { status: 400 });
  return json(phaseReadiness(REPO_ROOT, phase));
});

/**
 * POST { phase } → validate all phase-N plans are completed, then bump
 * VERSION + package.json + src/webui/package.json to 0.{N+1}.0 via the SHARED
 * phase-close core (no reimplemented version math). Never tags/pushes — the
 * response carries the exact tag command for the BDFL to run deliberately.
 */
export const POST = requireAuth(async ({ request }) => {
  let phase: number;
  try {
    ({ phase } = await request.json());
  } catch {
    return json({ error: 'invalid JSON body' }, { status: 400 });
  }
  if (!phase || phase < 1) return json({ error: 'phase (≥1) required' }, { status: 400 });

  const result = closePhase(REPO_ROOT, Number(phase));
  if (!result.ok) {
    // Refuse loudly (incomplete phase / already-applied) — 422, not a silent no-op.
    return json({ error: result.reason }, { status: 422 });
  }
  return json({
    ok: true,
    version: result.version,
    changed: result.changed,
    completedPlans: result.completedPlans,
    tagCommand: result.tagCommand,
    note: 'Version bumped. Tagging/pushing the release is a separate, explicit step — run the tag command when ready.',
  });
});
