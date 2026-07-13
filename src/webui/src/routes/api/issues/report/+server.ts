import path from 'node:path';
import { json } from '@sveltejs/kit';
import { captureSuggest } from '../../../../../../dispatch/capture';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

// Phase 1 of the suggest-style bridge (#68 §3): READ-ONLY. Given a title, return similar
// open bugs so the reporter can answer "is one of these yours?". Never writes — the client
// then calls /confirm (picked one) or /create (none). No auto-reject; no passive detection.
export async function POST({ request }) {
  try {
    const { title, category } = await request.json();
    if (!title) return json({ error: 'title is required' }, { status: 400 });
    const suggestions = await captureSuggest(REPO_ROOT, title, category === 'feature' ? 'feature' : 'bug');
    return json({ ok: true, suggestions });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'internal server error' }, { status: 500 });
  }
}
