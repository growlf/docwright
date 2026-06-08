import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';

const REPO = process.env.DOCWRIGHT_ROOT ?? path.resolve(process.cwd(), '../..');

/**
 * POST /api/lifecycle/phase-review
 * Body: { plan_path: "plans/phase-3-profile-acl-ai.md", review_date: "2026-06-07" }
 *
 * Sets phase_review_date on a phase plan to record that a human has reviewed
 * and confirmed (or updated) its scope following the previous phase's gate approval.
 * Clears the phase_review_required flag.
 */
export async function POST({ request }: { request: Request }) {
  const body = await request.json().catch(() => null);
  const planPath: string = (body?.plan_path ?? '').trim();
  const reviewDate: string = (body?.review_date ?? new Date().toISOString().slice(0, 10)).trim();

  if (!planPath) return json({ error: 'missing plan_path' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewDate))
    return json({ error: 'review_date must be YYYY-MM-DD' }, { status: 400 });

  const abs = path.resolve(REPO, planPath);
  if (!abs.startsWith(REPO)) return json({ error: 'invalid path' }, { status: 403 });
  if (!fs.existsSync(abs)) return json({ error: 'plan not found' }, { status: 404 });

  let text = fs.readFileSync(abs, 'utf-8');

  // Set or replace phase_review_date
  if (/^phase_review_date:/m.test(text)) {
    text = text.replace(/^phase_review_date:.*$/m, `phase_review_date: ${reviewDate}`);
  } else {
    // Insert after the first --- block (after title line)
    text = text.replace(/^(---\n(?:.*\n)*?)(---)/m, `$1phase_review_date: ${reviewDate}\n$2`);
  }

  // Clear phase_review_required if present
  text = text.replace(/^phase_review_required:\s*true\s*\n/m, '');

  fs.writeFileSync(abs, text, 'utf-8');
  return json({ ok: true, plan_path: planPath, review_date: reviewDate });
}
