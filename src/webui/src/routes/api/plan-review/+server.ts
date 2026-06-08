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
  const { path: planPath } = await request.json();
  if (!planPath) return new Response('missing path', { status: 400 });

  const resolved = path.resolve(REPO_ROOT, planPath);
  if (!resolved.startsWith(REPO_ROOT)) return new Response('invalid path', { status: 403 });
  if (!fs.existsSync(resolved)) return new Response('not found', { status: 404 });

  const planRaw = fs.readFileSync(resolved, 'utf-8');
  const opencodeUrl = process.env.OPENCODE_URL;

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(new TextEncoder().encode(sse(event, data)));
      }

      if (!opencodeUrl) {
        send('status', { message: 'AI not configured' });
        send('done', { findings: 'AI review unavailable — OPENCODE_URL not configured.', changes: '', improved_body: '' });
        controller.close();
        return;
      }

      const dirParam = `directory=${encodeURIComponent(REPO_ROOT)}`;

      try {
        send('status', { message: 'Building context...' });
        const context = buildPlanReviewContext(planPath, planRaw, REPO_ROOT);

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

        send('status', { message: 'AI is thinking…' });

        // OpenCode returns JSON — parse it, extract text, stream back chunk by chunk
        const data = await msgRes.json();
        const parts: Array<{ type: string; text?: string }> = data?.parts ?? [];
        const text = parts.filter(p => p.type === 'text').map(p => p.text ?? '').join('');
        const fullText = text;

        send('status', { message: 'Processing response…' });

        // Progressively stream the text so the user sees it appear in real time
        const chunkSize = 80;
        for (let i = 0; i < text.length; i += chunkSize) {
          send('token', { text: text.slice(i, i + chunkSize) });
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
