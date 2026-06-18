#!/usr/bin/env node
/**
 * critique-plan.js — tool-agnostic plan critique context gatherer.
 *
 * Reads a plan file, gathers all referenced proposals, downstream plans,
 * and core policies, then outputs a structured context block that any AI
 * (Claude, OpenCode/BigPickle, or any other model) can use to critique the plan.
 *
 * Usage:
 *   node scripts/critique-plan.js plans/phase-2-foundation.md
 *   node scripts/critique-plan.js plans/phase-2-foundation.md | opencode chat
 *   /critique-plan plans/phase-2-foundation.md   (via Claude Code skill)
 */

const fs   = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────

const REPO_ROOT = (() => {
  function findRoot(startDir) {
    let dir = startDir;
    while (dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, 'plans')) && fs.existsSync(path.join(dir, 'proposals'))) {
        return dir;
      }
      dir = path.dirname(dir);
    }
    return null;
  }
  // If a file arg is provided, prefer its repo over the script's repo.
  // This lets the script be installed in DocWright but run against any vault.
  const fileArg = process.argv[2];
  if (fileArg) {
    const absArg = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
    const fromFile = findRoot(path.dirname(absArg));
    if (fromFile) return fromFile;
  }
  return findRoot(__dirname) || process.cwd();
})();

const POLICIES_DIR = path.join(REPO_ROOT, 'policies', 'core');
const PLANS_DIR    = path.join(REPO_ROOT, 'plans');

// ── Helpers ───────────────────────────────────────────────────────────────────

function read(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8'); }
  catch { return null; }
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result = {};
  const lines = match[1].split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.startsWith('#')) { i++; continue; }
    const colonIdx = line.indexOf(':');
    if (colonIdx <= 0) { i++; continue; }
    const key = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trim();
    if (rest === '' || rest === '[]') {
      i++;
      const arr = [];
      while (i < lines.length && /^\s+-\s/.test(lines[i])) {
        arr.push(lines[i].replace(/^\s+-\s*/, '').trim());
        i++;
      }
      result[key] = arr;
    } else {
      result[key] = rest.replace(/^["']|["']$/g, '');
      i++;
    }
  }
  return result;
}

function section(title) {
  const bar = '═'.repeat(60);
  return `\n${bar}\n  ${title}\n${bar}\n`;
}

function fileStatus(filePath) {
  const full = path.isAbsolute(filePath) ? filePath : path.join(REPO_ROOT, filePath);
  if (!fs.existsSync(full)) return `⚠️  FILE NOT FOUND: ${filePath}`;
  const content = read(full);
  if (!content || content.trim().length < 50) return `⚠️  FILE EXISTS BUT APPEARS EMPTY: ${filePath}`;
  return content;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const planArg = process.argv[2];
if (!planArg) {
  console.error('Usage: node scripts/critique-plan.js <plan-file>');
  console.error('Example: node scripts/critique-plan.js plans/phase-2-foundation.md');
  process.exit(1);
}

const planPath = path.isAbsolute(planArg) ? planArg : path.join(REPO_ROOT, planArg);
const planRaw  = read(planPath);
if (!planRaw) {
  console.error(`Error: cannot read plan file: ${planPath}`);
  process.exit(1);
}

const planFm = parseFrontmatter(planRaw);
const output = [];

// ── Header ────────────────────────────────────────────────────────────────────

output.push(`${section('PLAN CRITIQUE CONTEXT')}
Plan file : ${path.relative(REPO_ROOT, planPath)}
Title     : ${planFm.title || '(no title)'}
Status    : ${planFm.status || '(no status)'}
Phase     : ${planFm.phase || '(unspecified)'}
Priority  : ${planFm.priority || '(unspecified)'}
Assigned  : ${planFm.assigned_to || '(unassigned)'}
`);

output.push('─── FULL PLAN CONTENT ───\n' + planRaw);

// ── Referenced proposals ──────────────────────────────────────────────────────

const sources = Array.isArray(planFm.proposal_source) ? planFm.proposal_source : [];
output.push(section(`REFERENCED PROPOSALS (proposal_source: — ${sources.length} found)`));

if (sources.length === 0) {
  output.push('⚠️  No proposal_source: field. This plan has no traceable origin proposals.\n');
} else {
  for (const src of sources) {
    output.push(`\n── ${src} ──`);
    output.push(fileStatus(src));
  }
}

// ── Dependencies ──────────────────────────────────────────────────────────────

const deps = Array.isArray(planFm.depends_on) ? planFm.depends_on : [];
output.push(section(`DEPENDENCIES (depends_on: — ${deps.length} found)`));

for (const dep of deps) {
  const depPath = path.join(PLANS_DIR, dep + '.md');
  const depRaw  = read(depPath);
  if (!depRaw) {
    output.push(`⚠️  DEPENDENCY NOT FOUND: ${dep}.md\n`);
  } else {
    const depFm = parseFrontmatter(depRaw);
    output.push(`✓ ${dep} — status: ${depFm.status || 'unknown'}, gate: ${depFm.gate_status || 'none'}`);
  }
}

// ── Downstream plans (what depends ON this plan) ──────────────────────────────

output.push(section('DOWNSTREAM PLANS (plans that depend on this one)'));

const allPlanFiles = fs.existsSync(PLANS_DIR)
  ? fs.readdirSync(PLANS_DIR).filter(f => f.endsWith('.md') && !f.includes('completed'))
  : [];

const planId = path.basename(planPath, '.md');
const downstream = [];
for (const f of allPlanFiles) {
  const raw = read(path.join(PLANS_DIR, f));
  if (!raw) continue;
  const fm = parseFrontmatter(raw);
  const d  = Array.isArray(fm.depends_on) ? fm.depends_on : [];
  if (d.includes(planId)) downstream.push({ file: f, title: fm.title || f, status: fm.status });
}

if (downstream.length === 0) {
  output.push('No plans currently depend on this one.\n');
} else {
  for (const d of downstream) {
    output.push(`→ ${d.file} — "${d.title}" (status: ${d.status || 'unknown'})`);
  }
}

// ── Core policies ─────────────────────────────────────────────────────────────

output.push(section('CORE POLICIES'));

const policyFiles = fs.existsSync(POLICIES_DIR)
  ? fs.readdirSync(POLICIES_DIR).filter(f => f.endsWith('.md'))
  : [];

for (const pf of policyFiles) {
  const raw = read(path.join(POLICIES_DIR, pf));
  if (!raw) continue;
  // Extract just the first paragraph after the title as a summary
  const body = raw.replace(/^---[\s\S]*?---\n/, '');
  const firstPara = body.split('\n\n').find(p => p.trim() && !p.startsWith('#'));
  output.push(`\n── ${pf} ──`);
  if (firstPara) output.push(firstPara.trim());
}

// ── Critic questions ──────────────────────────────────────────────────────────

output.push(section('YOUR TASK — ADVERSARIAL CRITIQUE'));
output.push(`You are the docwright-critic. Your job is to find problems. Be direct.
Do not be polite about real issues.

For EACH DELIVERABLE and for the plan as a whole, answer:

  1. Is this specific enough to know when it's done?
  2. What are the most likely failure modes?
  3. What dependencies are missing (things that must exist first, but don't)?
  4. Are there better existing tools or approaches?
  5. What breaks in later phases if this is done wrong?
  6. Is any deliverable already done (plan is stale)?
  7. Is anything severely underestimated (one-liner that's actually days of work)?

Also check:
  - Are ALL proposal_source: files present and non-trivial?
  - Are ALL depends_on: plans in a suitable state to unblock this?
  - Does the plan have a testing/acceptance strategy?
  - Does the plan have a rollback strategy if something goes wrong?
  - Does the plan say how to know it's DONE (gate condition)?

Format EACH FINDING as:

### [Deliverable name or "Cross-cutting"] [severity]
- **Finding:** [specific problem — be concrete]
- **Action:** [what to do about it]
- **Resolution:** *(leave blank — author fills in when addressed)*

Severity:
  📝 note  — worth considering; non-blocking
  ⚠️ warn  — likely to cause problems; address before starting this deliverable
  🚫 block — must resolve before this deliverable can begin at all

After your findings, write a one-paragraph overall assessment.

Begin your critique now.`);

// ── Output ────────────────────────────────────────────────────────────────────

console.log(output.join('\n'));
