import { opencodeComplete } from '$lib/server/opencode-complete.js';
import { createOwnedSession, getSession as getOwnedSession } from '$lib/server/ai-sessions.js';
import { runLiveReview } from '$lib/server/plan-review-live.js';

// Shares the Improve surface flag (plan step 3.4). Live synthesis is CLIENT
// opt-in (SynthesisPanel sends live:true) so the other caller (VoteSummary) keeps
// the legacy blocking JSON response untouched even when the flag is ON.
const LIVE_AI_IMPROVE = !['0', 'false', 'off', 'no'].includes((process.env.LIVE_AI_IMPROVE ?? '').toLowerCase());

interface Perspective { label?: string; text: string }

function buildSynthPrompt(responses: Perspective[], override?: string): string {
  if (override) return override;
  const perspectives = responses
    .map((r, i) => `--- ${r.label || `Review ${i + 1}`} ---\n${r.text.slice(0, 1000)}`)
    .join('\n\n');
  return [
    `You are reading ${responses.length} perspectives on the same question.`,
    `Synthesize them into:`,
    `1. Areas of agreement`,
    `2. Areas of disagreement (with specifics)`,
    `3. Your own recommendation — clearly labeled as one more perspective, not a verdict`,
    `4. Items that need human judgment before proceeding`,
    ``,
    `Keep each section to 2-3 sentences.`,
    ``,
    perspectives,
  ].join('\n');
}

function jsonR(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function POST({ request, locals }) {
  const b = (await request.json().catch(() => ({}))) as Record<string, any>;
  const responses: Perspective[] = b?.responses;
  const _promptOverride: string | undefined = b?._promptOverride;
  const live: boolean = b?.live === true;
  const action: string | undefined = b?.action;
  const sessionID: string | undefined = b?.sessionID;

  // --- Live path (LIVE_AI_IMPROVE ON + client opt-in): stream via /api/ai/stream ---
  if (LIVE_AI_IMPROVE && (live || action === 'start')) {
    const user = locals?.user;
    if (!user) return jsonR({ error: 'Unauthorized' }, 401);

    if (action === 'start') {
      if (!sessionID) return jsonR({ error: 'missing sessionID' }, 400);
      const owned = getOwnedSession(sessionID);
      if (!owned || owned.owner !== user.username) return jsonR({ error: 'forbidden' }, 403);
      if (!Array.isArray(responses) || responses.length < 2) return jsonR({ error: 'Need at least 2 perspectives' }, 400);
      const prompt = buildSynthPrompt(responses, _promptOverride);
      void runLiveReview(sessionID, [{ key: 'synthesis', label: 'Synthesis', prompt }]).catch((e) =>
        console.error('[synthesize] live run failed:', e?.message ?? e),
      );
      return jsonR({ ok: true, prompts: 1 });
    }

    // create
    if (!Array.isArray(responses) || responses.length < 2) {
      return jsonR({ error: 'Need at least 2 perspectives to synthesize' }, 400);
    }
    const created = await createOwnedSession({ user: user.username, feature: 'synthesize', docPath: null });
    return jsonR({ live: true, sessionID: created.sessionID });
  }

  // --- Legacy blocking path (flag OFF, or non-live callers like VoteSummary) ---
  if (!Array.isArray(responses) || responses.length < 2) {
    return new Response('Need at least 2 perspectives to synthesize', { status: 400 });
  }
  const prompt = buildSynthPrompt(responses, _promptOverride);
  try {
    const text = await opencodeComplete(prompt);
    return jsonR({ synthesis: text });
  } catch (e: any) {
    return jsonR({ error: e.message || 'Synthesis failed' }, 500);
  }
}
