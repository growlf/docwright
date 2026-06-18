import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import { moveDocument } from '../../../../../../dispatch/vault-write';

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

function hasPendingSteps(text: string): boolean {
  let inSteps = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) { inSteps = line.includes('Implementation Steps'); continue; }
    if (inSteps && line.startsWith('|') && !line.startsWith('|---')) {
      // Only check the Status column (last cell) — ⏳ in Details column is fine
      const cells = line.split('|').filter(c => c.trim() !== '');
      const lastCell = cells[cells.length - 1] || '';
      if (lastCell.includes('⏳')) return true;
    }
  }
  return false;
}

function generateDoc(title: string, text: string, completedDate: string): string {
  const author   = getFmField(text, 'author') || 'NetYeti';
  const created  = getFmField(text, 'created') || completedDate;
  const tags     = getFmField(text, 'tags') || '';
  const source   = getFmField(text, 'proposal_source') || '';

  const histMatch = text.match(/^## Document History[\s\S]*$/m);
  const history   = histMatch ? histMatch[0] : '';

  return [
    '---',
    `title: "${title}"`,
    `status: completed`,
    `completed_date: ${completedDate}`,
    `author: ${author}`,
    `created: ${created}`,
    tags ? `tags: ${tags}` : null,
    source ? `proposal_source: ${source}` : null,
    '---',
    '',
    `# ${title}`,
    '',
    '*This document was generated when the plan was marked complete.*',
    '',
    history,
  ].filter(l => l !== null).join('\n');
}

/**
 * POST /api/lifecycle/transition-completed
 * Body: { plan: "plan-name-without-extension" }
 *
 * Moves plans/<name>.md → plans/completed/<name>.md and generates docs/<name>.md.
 * Mirrors the MCP transition_to_completed tool — called automatically by the
 * Web UI when the user clicks Complete in the properties pane.
 */
export async function POST({ request }) {
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

  const title       = getFmField(text, 'title') || safe.replace('.md', '');
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

  // Generate doc
  fs.mkdirSync(path.dirname(docPath), { recursive: true });
  fs.writeFileSync(docPath, generateDoc(title, text, completedDate));

  return json({ doc: `docs/${docSlug}.md` });
}
