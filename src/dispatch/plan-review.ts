/**
 * plan-review.ts — context-builder for adversarial plan critique.
 *
 * Extracted from the /api/plan-review server route so it can be unit-tested
 * without SvelteKit. Used by both the server route and the test suite.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { stripFrontmatter } from './ai';

export function parsePlanFrontmatter(raw: string): Record<string, any> {
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

export function asList(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string' && val) return [val];
  return [];
}

export function buildPlanReviewContext(
  planPath: string,
  planRaw: string,
  vaultRoot: string,
): string {
  const fm = parsePlanFrontmatter(planRaw);
  const parts: string[] = [];

  parts.push('=== PLAN CRITIQUE CONTEXT ===');
  parts.push(`Plan     : ${planPath}`);
  parts.push(`Title    : ${fm.title || '(no title)'}`);
  parts.push(`Status   : ${fm.status || '(none)'}`);
  parts.push(`Priority : ${fm.priority || '(none)'}`);
  parts.push(`Assigned : ${asList(fm.assigned_to).join(', ') || '(unassigned)'}`);
  parts.push('\n--- FULL PLAN CONTENT ---');
  parts.push(planRaw.slice(0, 6000));

  const sources = asList(fm.proposal_source);
  parts.push(`\n=== REFERENCED PROPOSALS (${sources.length}) ===`);
  if (sources.length === 0)
    parts.push('No proposal_source field — plan has no traceable origin proposals.');
  for (const src of sources) {
    const rel = src.endsWith('.md') ? src : src + '.md';
    const full = path.join(vaultRoot, rel);
    parts.push(`\n-- ${src} --`);
    try {
      parts.push(fs.readFileSync(full, 'utf-8').slice(0, 2000));
    } catch {
      parts.push(`FILE NOT FOUND: ${src}`);
    }
  }

  const deps = asList(fm.depends_on);
  parts.push(`\n=== DEPENDENCIES (${deps.length}) ===`);
  for (const dep of deps) {
    const rel = dep.endsWith('.md') ? dep : dep + '.md';
    try {
      const raw = fs.readFileSync(path.join(vaultRoot, rel), 'utf-8');
      const depFm = parsePlanFrontmatter(raw);
      parts.push(`✓ ${dep} — status: ${depFm.status || 'unknown'}`);
    } catch {
      parts.push(`NOT FOUND: ${dep}`);
    }
  }

  const policiesDir = path.join(vaultRoot, 'policies', 'core');
  parts.push('\n=== CORE POLICIES (summaries) ===');
  if (fs.existsSync(policiesDir)) {
    for (const f of fs.readdirSync(policiesDir).filter((f: string) => f.endsWith('.md'))) {
      try {
        const raw = fs.readFileSync(path.join(policiesDir, f), 'utf-8');
        const body = stripFrontmatter(raw);
        const para = body.split('\n\n').find(p => p.trim() && !p.startsWith('#'));
        parts.push(`\n-- ${f} --`);
        if (para) parts.push(para.trim().slice(0, 400));
      } catch { /* skip unreadable policy */ }
    }
  }

  parts.push(`

=== YOUR TASK ===

You are the docwright-editor. Your job is to find specific problems in this plan
and produce an improved version that fixes them.

First, analyze the plan for these issues in each Implementation Step and in the
cross-cutting sections (Testing Plan, Rollback, Risk Assessment):
- Steps that are vague or lack concrete deliverables
- Missing dependencies or preconditions
- Steps that hide significant work behind a single line
- Plans that lack a clear definition of "done"
- Missing or weak risk analysis
- Missing or weak test strategy

Then produce TWO sections in your response:

=== CHANGES ===
A numbered markdown list of every change you made and why:
1. **Section - What changed**: Why this change was needed

=== IMPROVED PLAN ===
The COMPLETE improved plan body in markdown. Keep the frontmatter unchanged.
Improve the body sections (Overview, Implementation Steps, Testing Plan,
Rollback, Risk Assessment) — make steps more concrete, add missing details,
fix weak areas. Keep the same structure but make everything better.

Be specific and concrete. Ensure every Implementation Step has a clear
definition of done. Add specific file paths, function names, and protocols.
Do not remove any existing content — only add and refine.`);
  return parts.join('\n');
}
