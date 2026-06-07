/**
 * POST /api/plan-review — adversarial AI critique of a plan.
 *
 * Context-building logic lives in src/dispatch/plan-review.ts (testable
 * without SvelteKit). This route just reads the file, calls buildContext,
 * and forwards the prompt to the OpenCode session API.
 */
import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { buildPlanReviewContext } from '../../../../../dispatch/plan-review';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

export async function POST({ request }) {
  const { path: planPath } = await request.json();
  if (!planPath) return json({ error: 'missing path' }, { status: 400 });

  const resolved = path.resolve(REPO_ROOT, planPath);
  if (!resolved.startsWith(REPO_ROOT)) return json({ error: 'invalid path' }, { status: 403 });
  if (!fs.existsSync(resolved)) return json({ error: 'not found' }, { status: 404 });

  const planRaw = fs.readFileSync(resolved, 'utf-8');
  const context = buildPlanReviewContext(planPath, planRaw, REPO_ROOT);

  const opencodeUrl = process.env.OPENCODE_URL;
  if (!opencodeUrl) {
    return json({
      findings: `*(AI review unavailable — OPENCODE_URL not configured.)*\n\n` +
        `Run the CLI tool instead:\n\`\`\`\nnode scripts/critique-plan.js ${planPath}\n\`\`\``,
    });
  }

  const dirParam = `directory=${encodeURIComponent(REPO_ROOT)}`;

  try {
    // Step 1 — create a session scoped to this vault
    const sessRes = await fetch(`${opencodeUrl}/session?${dirParam}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!sessRes.ok) throw new Error(`Session create failed: ${sessRes.status}`);
    const sess = await sessRes.json();
    const sessionId: string = sess?.id ?? sess?.sessionID;
    if (!sessionId) throw new Error('OpenCode returned no session ID');

    // Step 2 — send the critique prompt as a user message
    const msgRes = await fetch(`${opencodeUrl}/session/${sessionId}/message?${dirParam}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts: [{ type: 'text', text: context }] }),
    });
    if (!msgRes.ok) throw new Error(`Message failed: ${msgRes.status}`);
    const data = await msgRes.json();

    // Step 3 — extract text parts from the response
    const parts: Array<{ type: string; text?: string }> = data?.parts ?? [];
    const findings = parts
      .filter(p => p.type === 'text')
      .map(p => p.text ?? '')
      .join('');

    return json({ findings: findings || '*(No text response from AI)*' });
  } catch (err: any) {
    return json({ error: String(err) }, { status: 502 });
  }
}
