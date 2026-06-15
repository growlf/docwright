/**
 * POST /api/improve — AI proposal improvement + critique (SSE stream).
 *
 * Reads the proposal from disk, runs fillProposal() then critiqueDocument()
 * sequentially, streaming tokens progressively so the UI can show the AI's
 * "thinking" as it arrives.
 */
import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { parseFrontmatter, stripFrontmatter } from '../../../../../dispatch/frontmatter';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

function buildPrompt(fm: Record<string, any>, body: string): string {
  const title = fm.title || '(untitled)';
  const tags = Array.isArray(fm.tags) ? fm.tags.join(', ') : String(fm.tags || '');
  return (
    `You are a governance document assistant. Improve the following proposal body.\n` +
    `Rules:\n` +
    `- Flesh out sparse sections (Problem, Proposed Solution, Out of Scope)\n` +
    `- Keep the author's intent unchanged — do not reverse decisions already made\n` +
    `- Add missing sections only when clearly needed\n` +
    `- Do NOT modify the YAML frontmatter\n` +
    `- Return ONLY the improved markdown body with no preamble or commentary\n\n` +
    `FRONTMATTER CONTEXT:\ntitle: ${title}\ntags: ${tags}\n\n` +
    `CURRENT BODY:\n${body}`
  );
}

function buildCritique(content: string): string {
  return (
    `You are a governance document reviewer. Critique the following document.\n` +
    `Identify: missing sections, weak reasoning, unstated assumptions, ` +
    `security or governance concerns, and concrete improvement suggestions.\n` +
    `Return a structured critique in plain markdown. Be specific and actionable.\n\n` +
    `DOCUMENT:\n${content.slice(0, 4000)}`
  );
}

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function streamText(
  fullText: string,
  phase: string,
  streamingStage: string,
  send: (event: string, data: unknown) => void,
) {
  send('stage', { phase: streamingStage });
  send('status', { message: phase === 'improve' ? 'Improved text arriving...' : 'Critique text arriving...' });
  const chunkSize = 80;
  for (let i = 0; i < fullText.length; i += chunkSize) {
    send('token', { phase, text: fullText.slice(i, i + chunkSize) });
    await new Promise(r => setTimeout(r, 15));
  }
}


async function callAndSendSession(
  opencodeUrl: string,
  dirParam: string,
  prompt: string,
  phase: string,
  streamingStage: string,
  send: (event: string, data: unknown) => void,
  signal?: AbortSignal,
): Promise<string> {
  send('status', { message: 'Creating session...' });
  const sessRes = await fetch(`${opencodeUrl}/session?${dirParam}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    signal,
  });
  if (!sessRes.ok) throw new Error(`Session create failed: ${sessRes.status}`);
  const sess = await sessRes.json();
  const sessionId: string = sess?.id ?? sess?.sessionID;
  if (!sessionId) throw new Error('OpenCode returned no session ID');

  send('status', { message: phase === 'improve' ? 'Improving proposal...' : 'Generating critique...' });

  const msgRes = await fetch(`${opencodeUrl}/session/${sessionId}/message?${dirParam}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parts: [{ type: 'text', text: prompt }] }),
    signal,
  });
  if (!msgRes.ok) throw new Error(`Message failed: ${msgRes.status}`);
  const data = await msgRes.json();
  const parts: Array<{ type: string; text?: string }> = data?.parts ?? [];
  const fullText = parts.filter(p => p.type === 'text').map(p => p.text ?? '').join('');

  await streamText(fullText, phase, streamingStage, send);
  return fullText;
}

export async function POST({ request }) {
  const { path: filePath } = await request.json();
  if (!filePath) return json({ error: 'missing path' }, { status: 400 });

  const resolved = path.resolve(REPO_ROOT, filePath);
  if (!resolved.startsWith(REPO_ROOT)) return json({ error: 'invalid path' }, { status: 403 });
  if (!fs.existsSync(resolved)) return json({ error: 'not found' }, { status: 404 });

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(new TextEncoder().encode(sse(event, data)));
      }

      const original = fs.readFileSync(resolved, 'utf-8');
      const fm = parseFrontmatter(original);
      const body = stripFrontmatter(original);

      const opencodeUrl = process.env.OPENCODE_URL;

      if (!opencodeUrl) {
        send('done', {
          original: body,
          improved: body + '\n\n*(AI fill-in unavailable — OPENCODE_URL not configured)*',
          critique: '*(Critique unavailable — OPENCODE_URL not configured)*',
        });
        controller.close();
        return;
      }

      const dirParam = `directory=${encodeURIComponent(REPO_ROOT)}`;
      // 300s: model cold-load or slow inference can take a long time
      const AI_TIMEOUT = 300_000;
      const abortCtrl = new AbortController();
      const abortTimer = setTimeout(() => abortCtrl.abort(), AI_TIMEOUT * 2); // outer guard
      const callAI = (prompt: string, phase: string, stage: string, signal: AbortSignal) =>
        callAndSendSession(opencodeUrl, dirParam, prompt, phase, stage, send, signal);

      try {
        const timeout = (ms: number) => new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
        const withTimeout = <T>(p: Promise<T>, ms: number) => Promise.race([p, timeout(ms)]);

        // Phase 1: Improve proposal
        send('stage', { phase: 'improve-thinking' });
        let improved: string;
        try {
          improved = await withTimeout(
            callAI(buildPrompt(fm, body), 'improve', 'improve-streaming', abortCtrl.signal),
            AI_TIMEOUT,
          );
        } catch (err: any) {
          improved = body + `\n\n*(AI improvement ${err.message === 'Message failed: 500' ? 'model backend not responding. Check that ollama/Olla is running.' : err.message} — showing original body)*`;
          send('token', { phase: 'improve', text: improved });
        }

        // Phase 2: Critique document — fresh abort controller so phase 1 timeout doesn't bleed over
        const abortCtrl2 = new AbortController();
        const abortTimer2 = setTimeout(() => abortCtrl2.abort(), AI_TIMEOUT);
        send('stage', { phase: 'critique-thinking' });
        let critique: string;
        try {
          critique = await withTimeout(
            callAI(buildCritique(original), 'critique', 'critique-streaming', abortCtrl2.signal),
            AI_TIMEOUT,
          );
        } catch (err: any) {
          critique = `*(AI unavailable — ${err.message === 'Message failed: 500' ? 'model backend not responding. Check that ollama/Olla is running.' : err.message})*`;
          send('token', { phase: 'critique', text: critique });
        } finally {
          clearTimeout(abortTimer2);
        }

        send('done', { original: body, improved, critique });
      } catch (err: any) {
        send('done', { original: body, improved: body + '\n\n*(Error processing improve)*', critique: '' });
      } finally {
        clearTimeout(abortTimer);
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
