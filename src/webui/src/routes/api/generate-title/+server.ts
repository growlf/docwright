/**
 * POST /api/generate-title
 * Generate a concise proposal title from a description and category.
 * Falls back to the first sentence of the description when OpenCode is unavailable.
 */
import { json } from '@sveltejs/kit';
import { opencodeHeaders } from '../../../../../dispatch/opencode-auth';
import path from 'node:path';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

function fallbackTitle(description: string): string {
  const first = description.split(/[.\n]/)[0].trim();
  return first.length > 80 ? first.slice(0, 77) + '…' : first;
}

export async function POST({ request }) {
  const body = await request.json().catch(() => null);
  if (!body?.description) return json({ error: 'missing description' }, { status: 400 });

  const { description, category = 'feature' } = body as { description: string; category: string };
  const opencodeUrl = process.env.OPENCODE_URL;

  if (!opencodeUrl) {
    return json({ title: fallbackTitle(description), generated: false });
  }

  try {
    const dirParam = `directory=${encodeURIComponent(REPO_ROOT)}`;
    const prompt =
      `Generate a concise, specific proposal title (max 10 words) for this ${category} proposal.\n` +
      `Rules: no filler phrases ("I want to", "We should"), no trailing punctuation, title case.\n` +
      `Return ONLY the title text — nothing else.\n\n` +
      `Description: ${description.slice(0, 600)}`;

    const sessRes = await fetch(`${opencodeUrl}/session?${dirParam}`, {
      method: 'POST',
      headers: opencodeHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(30_000),
    });
    if (!sessRes.ok) throw new Error(`session ${sessRes.status}`);
    const sess = await sessRes.json();
    const sessionId: string = sess?.id ?? sess?.sessionID;
    if (!sessionId) throw new Error('no session id');

    const msgRes = await fetch(`${opencodeUrl}/session/${sessionId}/message?${dirParam}`, {
      method: 'POST',
      headers: opencodeHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ parts: [{ type: 'text', text: prompt }] }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!msgRes.ok) throw new Error(`message ${msgRes.status}`);
    const data = await msgRes.json();
    const parts: Array<{ type: string; text?: string }> = data?.parts ?? [];
    const raw = parts.filter(p => p.type === 'text').map(p => p.text ?? '').join('').trim();
    const title = raw.replace(/^["']|["']$/g, '').replace(/\.+$/, '').trim();

    return json({ title: title || fallbackTitle(description), generated: !!title });
  } catch {
    return json({ title: fallbackTitle(description), generated: false });
  }
}
