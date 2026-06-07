/**
 * POST /api/plan-review — adversarial AI critique of a plan.
 *
 * Replicates the context-gathering logic from scripts/critique-plan.js,
 * then calls the OpenCode session API with the same adversarial prompt.
 * Falls back to a stub message when OPENCODE_URL is not set.
 */
import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { stripFrontmatter } from '../../../../../dispatch/ai';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

function parseFrontmatter(raw: string): Record<string, any> {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return {};
  const fm: Record<string, any> = {};
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const keyEmpty = lines[i].match(/^(\w+):\s*$/);
    if (keyEmpty) {
      const arr: string[] = [];
      while (i + 1 < lines.length && /^\s+-/.test(lines[i + 1])) {
        i++;
        arr.push(lines[i].replace(/^\s+-\s*/, '').trim().replace(/^["']|["']$/g, ''));
      }
      fm[keyEmpty[1]] = arr.length > 0 ? arr : '';
      continue;
    }
    const kv = lines[i].match(/^(\w+):\s*(.+)/);
    if (kv) {
      let val: any = kv[2].trim();
      if (val.startsWith('[') && val.endsWith(']'))
        val = val.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      else if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else val = val.replace(/^["']|["']$/g, '');
      fm[kv[1]] = val;
    }
  }
  return fm;
}

function readVaultFile(rel: string): string | null {
  try { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8'); }
  catch { return null; }
}

function asList(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string' && val) return [val];
  return [];
}

function buildContext(planPath: string, planRaw: string): string {
  const fm = parseFrontmatter(planRaw);
  const parts: string[] = [];

  parts.push('=== PLAN CRITIQUE CONTEXT ===');
  parts.push(`Plan     : ${planPath}`);
  parts.push(`Title    : ${fm.title || '(no title)'}`);
  parts.push(`Status   : ${fm.status || '(none)'}`);
  parts.push(`Priority : ${fm.priority || '(none)'}`);
  parts.push(`Assigned : ${asList(fm.assigned_to).join(', ') || '(unassigned)'}`);
  parts.push('\n--- FULL PLAN CONTENT ---');
  parts.push(planRaw.slice(0, 6000));

  // Referenced source proposals
  const sources = asList(fm.proposal_source);
  parts.push(`\n=== REFERENCED PROPOSALS (${sources.length}) ===`);
  if (sources.length === 0)
    parts.push('⚠️  No proposal_source field — plan has no traceable origin proposals.');
  for (const src of sources) {
    const rel = src.endsWith('.md') ? src : src + '.md';
    const raw = readVaultFile(rel);
    parts.push(`\n-- ${src} --`);
    parts.push(raw ? raw.slice(0, 2000) : `⚠️  FILE NOT FOUND: ${src}`);
  }

  // Dependencies
  const deps = asList(fm.depends_on);
  parts.push(`\n=== DEPENDENCIES (${deps.length}) ===`);
  for (const dep of deps) {
    const rel = dep.endsWith('.md') ? dep : dep + '.md';
    const raw = readVaultFile(rel);
    if (!raw) {
      parts.push(`⚠️  NOT FOUND: ${dep}`);
    } else {
      const depFm = parseFrontmatter(raw);
      parts.push(`✓ ${dep} — status: ${depFm.status || 'unknown'}`);
    }
  }

  // Core policies — first paragraph only to keep context manageable
  const policiesDir = path.join(REPO_ROOT, 'policies', 'core');
  parts.push('\n=== CORE POLICIES (summaries) ===');
  if (fs.existsSync(policiesDir)) {
    for (const f of fs.readdirSync(policiesDir).filter((f: string) => f.endsWith('.md'))) {
      const raw = fs.readFileSync(path.join(policiesDir, f), 'utf-8');
      const body = stripFrontmatter(raw);
      const para = body.split('\n\n').find(p => p.trim() && !p.startsWith('#'));
      parts.push(`\n-- ${f} --`);
      if (para) parts.push(para.trim().slice(0, 400));
    }
  }

  // Adversarial critic instructions
  parts.push(`
=== YOUR TASK — ADVERSARIAL CRITIQUE ===

You are the docwright-critic. Find problems. Be direct. Do not soften real issues.

For EACH IMPLEMENTATION STEP and for the plan as a whole, answer:
1. Specific enough to know when done?
2. Most likely failure modes?
3. Missing dependencies that must exist first but don't?
4. Better existing tools or approaches already in this codebase?
5. What breaks in later phases if this step is done wrong?
6. Is this step already done (stale)?
7. Severely underestimated — one line hiding days of work?

Also check:
- Are all proposal_source files present and non-trivial?
- Are all depends_on plans in a suitable state to unblock this?
- Does the plan have a testing / acceptance strategy?
- Does the plan have a rollback strategy?
- Does the plan state how to know it is DONE?

Format EACH FINDING as:

### [Step name or "Cross-cutting"] [severity]
- **Finding:** [specific, concrete problem]
- **Action:** [what to do about it]
- **Resolution:** *(leave blank — author fills in when addressed)*

Severity:
  📝 note  — worth considering; non-blocking
  ⚠️ warn  — likely to cause problems; address before starting this step
  🚫 block — must resolve before this step can begin

End with a one-paragraph overall assessment.

Begin your critique now.`);

  return parts.join('\n');
}

export async function POST({ request }) {
  const { path: planPath } = await request.json();
  if (!planPath) return json({ error: 'missing path' }, { status: 400 });

  const resolved = path.resolve(REPO_ROOT, planPath);
  if (!resolved.startsWith(REPO_ROOT)) return json({ error: 'invalid path' }, { status: 403 });
  if (!fs.existsSync(resolved)) return json({ error: 'not found' }, { status: 404 });

  const planRaw = fs.readFileSync(resolved, 'utf-8');
  const context = buildContext(planPath, planRaw);

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
