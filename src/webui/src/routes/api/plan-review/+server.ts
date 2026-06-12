import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

const AI_TIMEOUT = 180_000;
const OLLA_BASE = process.env.OLLA_BASE || 'http://100.123.141.125:40114/olla/ollama/v1';
const OLLA_MODEL = process.env.OLLA_MODEL || 'llama3.1:8b';

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// --- Section extraction (local, no AI) ---

function extractFrontmatter(raw: string) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const [k, ...v] = line.split(': ');
    if (k && v.length) fm[k.trim()] = v.join(': ').trim();
  }
  return fm;
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
    const cols = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cols.length >= 3) {
      stepRows.push({ number: cols[0], action: cols[1], details: cols[2] });
    }
  }
  return stepRows;
}

function extractSection(raw: string, sectionName: string) {
  const re = new RegExp(`## ${sectionName}\\n([\\s\\S]*?)(?:\\n## |\\n---|$)`);
  const match = raw.match(re);
  return match ? match[1].trim() : '';
}

// --- AI backend (Olla load balancer via OpenAI-compatible API) ---

async function callOlla(prompt: string, retries = 1): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${OLLA_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLA_MODEL,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          max_tokens: 200,
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT),
      });
      if (!res.ok && res.status === 502 && attempt < retries) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      if (!res.ok) throw new Error(`Olla: ${res.status}`);
      const data = await res.json();
      return data?.choices?.[0]?.message?.content?.trim() || '';
    } catch (e: any) {
      if (e?.name === 'AbortError' && attempt < retries) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw e;
    }
  }
  throw new Error('Olla: all retries exhausted');
}

async function warmupOlla(): Promise<boolean> {
  try {
    await callOlla('Reply with just "ok"', 0);
    return true;
  } catch { return false; }
}

// --- Main ---

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

      if (!OLLA_BASE) {
        send('status', { message: 'AI not configured' });
        send('done', {});
        controller.close();
        return;
      }

      try {
        send('status', { message: 'Extracting plan sections...' });

        const fm = extractFrontmatter(planRaw);
        const steps = extractSteps(planRaw);
        const testingSection = extractSection(planRaw, 'Testing Plan');
        const riskSection = extractSection(planRaw, 'Risk Assessment');
        const rollbackSection = extractSection(planRaw, 'Rollback Procedures');

        if (steps.length === 0) {
          send('status', { message: 'No steps to review' });
          send('done', {});
          controller.close();
          return;
        }

        send('status', { message: `Warming AI model — ${steps.length} steps + sections to review...` });
        await warmupOlla();

        // Build micro-prompts for each step
        const stepCalls = steps.map(step => ({
          key: step.number,
            prompt: `Review this step (2-3 sentences). Concrete? Clear done? Missing preconditions?\n\nStep ${step.number}: ${step.action}\n${step.details ? `Details: ${step.details}` : ''}`,
        }));

        // Build micro-prompts for each section
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

        // Fire micro-calls sequentially — model load dominates first call, rest are fast
        for (const call of allCalls) {
          try {
            const text = await callOlla(call.prompt);
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
        }

        // Overview synthesis
        const stepHeadlines = steps.map(s => `Step ${s.number}: ${s.action.slice(0, 80)}`).join('\n');
        const testingPreview = (testingSection || 'Not defined').slice(0, 150);
        const riskPreview = (riskSection || 'Not defined').slice(0, 150);
        const rollbackPreview = (rollbackSection || 'Not defined').slice(0, 150);

        const overviewPrompt = `Review this plan overview (2-3 sentences). Coherent? Gaps?\n\nPlan: ${fm.title || '(untitled)'} (${fm.status || '?'}, ${fm.priority || '?'})\n\nSteps:\n${stepHeadlines}\n\nTesting: ${testingPreview}\nRisk: ${riskPreview}\nRollback: ${rollbackPreview}`;

        send('status', { message: 'Synthesizing overview...' });

        try {
          const overviewText = await callOlla(overviewPrompt);
          send('overview', { text: overviewText });
        } catch (err: any) {
          send('overview', { text: `Error: ${err?.message ?? err}` });
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
