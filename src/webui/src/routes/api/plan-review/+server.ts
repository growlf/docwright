import fs from 'node:fs';
import path from 'node:path';
import { buildPlanReviewContext } from '../../../../../dispatch/plan-review';
import { stripFrontmatter } from '../../../../../dispatch/ai';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST({ request }) {
  const { path: planPath, backend = 'opencode' } = await request.json();
  if (!planPath) return new Response('missing path', { status: 400 });

  const resolved = path.resolve(REPO_ROOT, planPath);
  if (!resolved.startsWith(REPO_ROOT)) return new Response('invalid path', { status: 403 });
  if (!fs.existsSync(resolved)) return new Response('not found', { status: 404 });

  const planRaw = fs.readFileSync(resolved, 'utf-8');
  const ollamaUrl = process.env.OLLAMA_URL;
  const ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5:32b-instruct-q3_K_M';
  const opencodeUrl = process.env.OPENCODE_URL;

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(new TextEncoder().encode(sse(event, data)));
      }

      if (!ollamaUrl && !opencodeUrl) {
        send('status', { message: 'AI not configured' });
        send('done', { findings: 'AI review unavailable — no AI backend configured.', changes: '', improved_body: '' });
        controller.close();
        return;
      }

      const dirParam = `directory=${encodeURIComponent(REPO_ROOT)}`;

      try {
        send('status', { message: 'Building context...' });
        const context = buildPlanReviewContext(planPath, planRaw, REPO_ROOT);

        let fullText: string;
        const useOllama = backend === 'ollama' && !!ollamaUrl;
        // 300s: Ollama may cold-load a model from disk before inference starts
        const AI_TIMEOUT = 300_000;
        const abortCtrl = new AbortController();
        const abortTimer = setTimeout(() => abortCtrl.abort(), AI_TIMEOUT);

        if (useOllama) {
          send('status', { message: 'Sending to Ollama...' });
          const res = await fetch(`${ollamaUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: ollamaModel, messages: [{ role: 'user', content: context }], stream: false }),
            signal: abortCtrl.signal,
          });
          if (!res.ok) throw new Error(`Ollama request failed: ${res.status}`);
          const data = await res.json();
          fullText = data?.choices?.[0]?.message?.content ?? '';
        } else {
          send('status', { message: 'Creating session...' });
          const sessRes = await fetch(`${opencodeUrl}/session?${dirParam}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          if (!sessRes.ok) throw new Error(`Session create failed: ${sessRes.status}`);
          const sess = await sessRes.json();
          const sessionId: string = sess?.id ?? sess?.sessionID;
          if (!sessionId) throw new Error('OpenCode returned no session ID');

          send('status', { message: 'Sending to AI...' });
          const msgRes = await fetch(`${opencodeUrl}/session/${sessionId}/message?${dirParam}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parts: [{ type: 'text', text: context }] }),
          });
          if (!msgRes.ok) throw new Error(`Message failed: ${msgRes.status}`);
          const data = await msgRes.json();
          const parts: Array<{ type: string; text?: string }> = data?.parts ?? [];
          fullText = parts.filter(p => p.type === 'text').map(p => p.text ?? '').join('');
        }

        clearTimeout(abortTimer);
        send('status', { message: 'Processing response…' });

        // Progressively stream the text so the user sees it appear in real time
        const chunkSize = 80;
        for (let i = 0; i < fullText.length; i += chunkSize) {
          send('token', { text: fullText.slice(i, i + chunkSize) });
          await new Promise(r => setTimeout(r, 15));
        }

        send('status', { message: 'Parsing results...' });

        const changesMatch = fullText.match(/=== CHANGES ===\n([\s\S]*?)(?:\n=== IMPROVED PLAN ===|$)/);
        const improvedMatch = fullText.match(/=== IMPROVED PLAN ===\n([\s\S]*)$/);
        const changes = changesMatch ? changesMatch[1].trim() : '';
        let improved_body = improvedMatch ? improvedMatch[1].trim() : '';
        if (improved_body.startsWith('---')) improved_body = stripFrontmatter(improved_body);
        const findings = fullText.includes('=== CHANGES ===')
          ? fullText.split('=== CHANGES ===')[0].trim()
          : fullText;

        send('done', {
          findings: findings || '*(No text response from AI)*',
          changes: changes || '(No specific changes listed)',
          improved_body: improved_body || '*(No improved body generated)*',
        });
      } catch (err: any) {
        send('done', { findings: `Error: ${err}`, changes: '', improved_body: '' });
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
