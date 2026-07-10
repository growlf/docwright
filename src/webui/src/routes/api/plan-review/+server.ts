import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from '../../../../../dispatch/frontmatter';
import { opencodeComplete } from '$lib/server/opencode-complete.js';
import { AI_ROLES } from '$lib/ai-roles.js';
import { createOwnedSession, getSession as getOwnedSession } from '$lib/server/ai-sessions.js';
import { buildReviewPrompts, runLiveReview } from '$lib/server/plan-review-live.js';

const reviewerPrompt = AI_ROLES['doc-reviewer'].systemPrompt;

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

// Per-surface feature flag (plan Constraint 2). Default ON after e2e evidence
// (browser e2e 6/6 green, 2026-07-10); the legacy blocking SSE path below remains
// as the escape hatch — set LIVE_AI_REVIEW=0 (or false/off/no) to restore it
// without a deploy. Flag + dead legacy path are removed in step 3.7 after soak.
const LIVE_AI_REVIEW = !['0', 'false', 'off', 'no'].includes((process.env.LIVE_AI_REVIEW ?? '').toLowerCase());

function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Resolve a vault-relative plan path safely; null if outside the repo or missing. */
function resolvePlan(planPath: string | undefined): string | null {
  if (!planPath) return null;
  const resolved = path.resolve(REPO_ROOT, planPath);
  if (!resolved.startsWith(REPO_ROOT)) return null;
  if (!fs.existsSync(resolved)) return null;
  return resolved;
}

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function extractSteps(raw: string) {
  const lines = raw.split('\n');
  const stepRows: Array<{ number: string; action: string; details: string }> = [];
  let inTable = false;
  let headerPassed = false;
  for (const line of lines) {
    if (line.startsWith('## Implementation Steps')) { inTable = true; continue; }
    if (!inTable) continue;
    if (!line.startsWith('|')) { if (line.trim()) inTable = false; continue; }
    if (!headerPassed) { headerPassed = true; continue; }
    if (line.includes('---')) continue;
    const cols = line.split('|').map(c => c.trim());
    const dataCols = cols.slice(1, -1);
    if (dataCols.length >= 3) {
      stepRows.push({ number: dataCols[0], action: dataCols[1], details: dataCols[2] });
    }
  }
  return stepRows;
}

function extractSection(raw: string, sectionName: string) {
  const re = new RegExp(`## ${sectionName}\\n([\\s\\S]*?)(?:\\n## |\\n---|$)`);
  const match = raw.match(re);
  return match ? match[1].trim() : '';
}

export async function POST(event) {
  const { request, locals } = event;
  const body = await request.json().catch(() => ({}));
  const planPath: string | undefined = body?.path;
  const action: string | undefined = body?.action;
  const sessionID: string | undefined = body?.sessionID;

  // --- Live path (LIVE_AI_REVIEW ON): one owned session, streamed via /api/ai/stream ---
  if (LIVE_AI_REVIEW) {
    const user = locals?.user;
    if (!user) return new Response('Unauthorized', { status: 401 });

    if (action === 'start') {
      // Phase 2: client has subscribed to the stream — now drive the prompts.
      if (!sessionID) return new Response('missing sessionID', { status: 400 });
      const owned = getOwnedSession(sessionID);
      if (!owned || owned.owner !== user.username) return new Response('forbidden', { status: 403 });
      const resolvedStart = resolvePlan(planPath);
      if (!resolvedStart) return new Response('not found', { status: 404 });
      const prompts = buildReviewPrompts(fs.readFileSync(resolvedStart, 'utf-8'));
      // Fire-and-forget: the browser watches progress live on the event stream;
      // completion is detected client-side by counting session.idle events.
      void runLiveReview(sessionID, prompts, { systemPrompt: reviewerPrompt }).catch((e) =>
        console.error('[plan-review] live run failed:', e?.message ?? e),
      );
      return jsonResponse({ ok: true, prompts: prompts.length });
    }

    // Phase 1: create the owned session and hand its id back to the client.
    if (!resolvePlan(planPath)) return new Response('not found', { status: 404 });
    const created = await createOwnedSession({ user: user.username, feature: 'review', docPath: planPath ?? null });
    return jsonResponse({ live: true, sessionID: created.sessionID });
  }

  // --- Legacy blocking path (flag OFF) — unchanged ---
  if (!planPath) return new Response('missing path', { status: 400 });

  const resolved = path.resolve(REPO_ROOT, planPath);
  if (!resolved.startsWith(REPO_ROOT)) return new Response('invalid path', { status: 403 });
  if (!fs.existsSync(resolved)) return new Response('not found', { status: 404 });

  const planRaw = fs.readFileSync(resolved, 'utf-8');

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      function send(event: string, data: unknown) {
        if (closed) return;
        try {
          controller.enqueue(new TextEncoder().encode(sse(event, data)));
        } catch { closed = true; }
      }

      // SSE keepalive — long AI calls (esp. the overview synthesis) produce no
      // events for minutes; proxies kill the idle connection, and the browser
      // surfaces it as ERR_INCOMPLETE_CHUNKED_ENCODING / "network error".
      // A comment line (": ...") is ignored by SSE parsers but keeps bytes flowing.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(new TextEncoder().encode(`: keepalive ${Date.now()}\n\n`));
        } catch { closed = true; }
      }, 15_000);

      try {
        send('status', { message: 'Extracting plan sections...' });

        const fm = parseFrontmatter(planRaw);
        const steps = extractSteps(planRaw);
        const testingSection = extractSection(planRaw, 'Testing Plan');
        const riskSection = extractSection(planRaw, 'Risk Assessment');
        const rollbackSection = extractSection(planRaw, 'Rollback Procedures');

        const nonEmptySteps = steps.filter(s => s.action.trim().length > 0);
        const noSteps = steps.length === 0 || nonEmptySteps.length === 0;

        if (noSteps) {
          send('status', { message: 'Analyzing plan (breaking into parallel fast reviews)...' });

          const bodyMatch = planRaw.match(/^---[\s\S]*?\n---\n([\s\S]*)$/);
          const planBody = bodyMatch ? bodyMatch[1].trim().slice(0, 3000) : '';

          // Break complex analysis into 4 parallel fast calls instead of 1 slow call
          const analyses = [
            {
              key: 'goal',
              prompt: `In 1-2 sentences, what is the core goal of this plan?\n\nPLAN:\n${planBody}`,
            },
            {
              key: 'steps',
              prompt: `List 3-5 concrete implementation steps for this plan. One per line.\n\nPLAN:\n${planBody}`,
            },
            {
              key: 'gaps',
              prompt: `What are the key gaps, assumptions, or outside-the-box observations about this plan?\n\nPLAN:\n${planBody}`,
            },
            {
              key: 'preconditions',
              prompt: `What preconditions, dependencies, or prerequisites should be noted for this plan?\n\nPLAN:\n${planBody}`,
            },
          ];

          // Run in parallel — don't await each one sequentially
          const analysisPromises = analyses.map(async (analysis) => {
            try {
              // Send prompt immediately, before AI call
              send('working-prompt', { aspect: analysis.key, systemPrompt: reviewerPrompt, userPrompt: analysis.prompt, model: 'claude' });
              const response = await opencodeComplete(analysis.prompt, undefined, reviewerPrompt);
              if (response.thinking) {
                send('working-thinking', { aspect: analysis.key, thinking: response.thinking });
              }
              send('analysis', { aspect: analysis.key, text: response.text });
            } catch (err: any) {
              send('analysis', { aspect: analysis.key, text: `Error: ${err?.message ?? err}` });
            }
          });

          // Wait for all analyses to complete
          await Promise.all(analysisPromises);
        } else {
          const stepCalls = nonEmptySteps.map(step => ({
            key: step.number,
            prompt: `Review this step (2-3 sentences). Concrete? Clear done? Missing preconditions?\n\nStep ${step.number}: ${step.action}\n${step.details ? `Details: ${step.details}` : ''}`,
          }));

          const sectionCalls: Array<{ key: string; prompt: string }> = [];
          for (const sec of [
            { key: 'testing', body: testingSection },
            { key: 'risk', body: riskSection },
            { key: 'rollback', body: rollbackSection },
          ]) {
            if (!sec.body) continue;
            const label = sec.key.charAt(0).toUpperCase() + sec.key.slice(1);
            sectionCalls.push({
              key: sec.key,
              prompt: `Review this section (1-2 sentences). Gaps? Improvements?\n\n${label}:\n${sec.body.slice(0, 500)}`,
            });
          }

          const allCalls = [
            ...stepCalls.map(sc => ({ ...sc, type: 'step' as const })),
            ...sectionCalls.map(sc => ({ ...sc, type: 'section' as const })),
          ];

          send('status', { message: `Reviewing ${allCalls.length} item${allCalls.length === 1 ? '' : 's'} in parallel...` });

          // Run every step/section review concurrently (not one-at-a-time) so a single
          // slow or hung call can't stall everything behind it -- matches the "no steps"
          // branch above, which was already fixed this way for the same reason.
          await Promise.all(allCalls.map(async (call) => {
            try {
              const itemKey = call.type === 'step' ? call.key : call.key;
              // Send prompt immediately, before AI call
              send('working-prompt', { type: call.type, key: itemKey, systemPrompt: reviewerPrompt, userPrompt: call.prompt, model: 'claude' });
              const response = await opencodeComplete(call.prompt, undefined, reviewerPrompt);
              if (response.thinking) {
                send('working-thinking', { type: call.type, key: itemKey, thinking: response.thinking });
              }
              if (call.type === 'step') {
                send('step-review', { number: call.key, text: response.text });
              } else {
                send('section-review', { name: call.key, text: response.text });
              }
            } catch (e: any) {
              const errText = `Error: ${e?.message ?? e}`;
              if (call.type === 'step') {
                send('step-review', { number: call.key, text: errText });
              } else {
                send('section-review', { name: call.key, text: errText });
              }
            }
          }));

          const stepHeadlines = nonEmptySteps.map(s => `Step ${s.number}: ${s.action.slice(0, 80)}`).join('\n');
          const testingPreview = (testingSection || 'Not defined').slice(0, 150);
          const riskPreview = (riskSection || 'Not defined').slice(0, 150);
          const rollbackPreview = (rollbackSection || 'Not defined').slice(0, 150);

          const overviewPrompt = `Review this plan overview (2-3 sentences). Coherent? Gaps?\n\nPlan: ${fm.title || '(untitled)'} (${fm.status || '?'}, ${fm.priority || '?'})\n\nSteps:\n${stepHeadlines}\n\nTesting: ${testingPreview}\nRisk: ${riskPreview}\nRollback: ${rollbackPreview}`;

          send('status', { message: 'Synthesizing overview...' });

          try {
            // Send prompt immediately, before AI call
            send('working-prompt', { type: 'overview', key: 'overview', systemPrompt: reviewerPrompt, userPrompt: overviewPrompt, model: 'claude' });
            const response = await opencodeComplete(overviewPrompt, undefined, reviewerPrompt);
            if (!response || typeof response !== 'object') {
              throw new Error(`Invalid response: ${JSON.stringify(response)}`);
            }
            if (response.thinking) {
              send('working-thinking', { type: 'overview', key: 'overview', thinking: response.thinking });
            }
            if (!response.text) {
              throw new Error('Response missing text field');
            }
            send('overview', { text: response.text });
          } catch (err: any) {
            const errMsg = err?.message || String(err);
            console.error('Overview error:', errMsg, err);
            send('overview', { text: `Error: ${errMsg}` });
          }
        }

        send('done', {});
      } catch (err: any) {
        send('done', { error: `${err?.message ?? err}` });
      }

      clearInterval(heartbeat);
      if (!closed) {
        closed = true;
        try { controller.close(); } catch { /* already closed by client disconnect */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
