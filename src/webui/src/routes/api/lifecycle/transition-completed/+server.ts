import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import { moveDocument } from '../../../../../../dispatch/vault-write';
import { hasPendingSteps, checkCompletionGate } from '../../../../../../dispatch/completion-gate';
import { generateCompletionDoc } from '../../../../../../dispatch/completion-doc';
import { requireAuth } from '$lib/server/auth.js';
import { commitPaths } from '$lib/server/git-commit.js';

const REPO = process.env.DOCWRIGHT_ROOT ?? path.resolve(process.cwd(), '../..');

function readPlan(name: string): string {
  const safe = name.endsWith('.md') ? name : name + '.md';
  const p = path.join(REPO, 'plans', safe);
  if (!fs.existsSync(p)) throw new Error(`Plan '${name}' not found in plans/`);
  return fs.readFileSync(p, 'utf-8');
}

function getFmField(text: string, field: string): string {
  const m = text.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

/**
 * POST /api/lifecycle/transition-completed
 * Body: { plan: "plan-name-without-extension" }
 *
 * Moves plans/<name>.md → plans/completed/<name>.md and generates docs/<name>.md.
 * Mirrors the MCP transition_to_completed tool — called automatically by the
 * Web UI when the user clicks Complete in the properties pane.
 */
export const POST = requireAuth(async ({ request, locals }) => {
  const body = await request.json().catch(() => null);
  const planArg: string = (body?.plan ?? '').trim();
  if (!planArg) return json({ error: 'missing plan name' }, { status: 400 });

  const safe = planArg.endsWith('.md') ? planArg : planArg + '.md';
  const planPath    = path.join(REPO, 'plans', safe);
  const destPath    = path.join(REPO, 'plans', 'completed', safe);
  const docSlug     = safe.replace('.md', '');
  const docPath     = path.join(REPO, 'docs', safe);

  // Already archived?
  if (!fs.existsSync(planPath)) {
    if (fs.existsSync(destPath)) return json({ doc: `docs/${docSlug}.md`, already: true });
    return json({ error: `Plan '${planArg}' not found in plans/` }, { status: 404 });
  }

  let text: string;
  try { text = readPlan(planArg); }
  catch (e: any) { return json({ error: e.message }, { status: 404 }); }

  const status = getFmField(text, 'status');
  if (status !== 'completed')
    return json({ error: `Plan status is '${status}', not 'completed'. Set it to completed first.` }, { status: 422 });

  if (hasPendingSteps(text))
    return json({ error: 'Plan has ⏳ pending steps — mark all steps ✅ Done first.' }, { status: 422 });

  // Same completion gate the MCP tools enforce (#172): tests defined and
  // human-reviewed, Gate Criteria + Testing Plan boxes all checked, and a
  // recorded green verify_plan_tests run. Refusal message is identical to
  // the MCP surface — parity asserted by test/integration/gate-parity.test.ts.
  const gateErr = checkCompletionGate(text, docSlug);
  if (gateErr) return json({ error: gateErr }, { status: 422 });

  const completedDate = new Date().toISOString().slice(0, 10);

  // Inject completed_date into plan frontmatter if missing, so the archived
  // file satisfies the pre-commit hook's location-invariant check.
  if (!getFmField(text, 'completed_date')) {
    text = text.replace(/^(status:\s*completed)$/m, `$1\ncompleted_date: ${completedDate}`);
    fs.writeFileSync(planPath, text, 'utf-8');
  }

  // Move plan → completed using canonical vault-write API.
  // Updates _path:, cascades wikilinks, and updates cross-refs atomically.
  moveDocument(REPO, `plans/${safe}`, `plans/completed/${safe}`);

  // Generate the completion doc via the shared dispatch generator (#142) —
  // fresh minimal frontmatter, byte-identical to the MCP surface, never a
  // re-serialization of the plan's own frontmatter block.
  fs.mkdirSync(path.dirname(docPath), { recursive: true });
  fs.writeFileSync(docPath, generateCompletionDoc(text, safe, completedDate));

  // Persist the transition so it isn't left as a silent, uncommitted change
  // (#147, same pattern as approve-proposal/#110). The authenticated click is
  // the seal: commit locally, authored as the user, with HUMAN_APPROVED.
  // Never pushes. Non-fatal: files are already written, so a commit failure
  // is surfaced in the response, not thrown.
  const commit = commitPaths(REPO, {
    message: `docs: complete ${docSlug} (plan → completed)\n\nHUMAN-APPROVED:${docSlug}`,
    stagePaths: [`plans/${safe}`, `plans/completed/${safe}`, `docs/${safe}`],
    user: locals.user,
  });

  return json({
    doc: `docs/${docSlug}.md`,
    committed: commit.ok ? commit.sha : null,
    commitError: commit.ok ? null : commit.error,
  });
});
