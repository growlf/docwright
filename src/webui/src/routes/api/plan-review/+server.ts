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

  try {
    const res = await fetch(`${opencodeUrl}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: context }),
    });
    if (!res.ok) throw new Error(`OpenCode returned ${res.status}`);
    const findings = await res.text();
    return json({ findings });
  } catch (err: any) {
    return json({ error: String(err) }, { status: 502 });
  }
}
