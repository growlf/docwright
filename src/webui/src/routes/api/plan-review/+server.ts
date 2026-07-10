import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from '../../../../../dispatch/frontmatter';
import { opencodeComplete } from '$lib/server/opencode-complete.js';
import { AI_ROLES } from '$lib/ai-roles.js';

const reviewerPrompt = AI_ROLES['doc-reviewer'].systemPrompt;

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

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

export async function POST({ request }) {
  const { path: planPath } = await request.json();
  if (!planPath) return new Response('missing path', { status: 400 });

  const resolved = path.resolve(REPO_ROOT, planPath);
  if (!resolved.startsWith(REPO_ROOT)) return new Response('invalid path', { status: 403 });
  if (!fs.existsSync(resolved)) return new Response('not found', { status: 404 });

  const planRaw = fs.readFileSync(resolved, 'utf-8');

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(new TextEncoder().encode(sse(event, data)));
      }

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
              const text = await opencodeComplete(analysis.prompt, undefined, reviewerPrompt);
              send('analysis', { aspect: analysis.key, text });
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
              const text = await opencodeComplete(call.prompt, undefined, reviewerPrompt);
              if (call.type === 'step') {
                send('step-review', { number: call.key, text });
              } else {
                send('section-review', { name: call.key, text });
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
            const overviewText = await opencodeComplete(overviewPrompt, undefined, reviewerPrompt);
            send('overview', { text: overviewText });
          } catch (err: any) {
            send('overview', { text: `Error: ${err?.message ?? err}` });
          }
        }

        send('done', {});
      } catch (err: any) {
        send('done', { error: `${err?.message ?? err}` });
      }

      controller.close();
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
