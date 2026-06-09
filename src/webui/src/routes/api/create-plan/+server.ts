import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') || 'plan';
}

function hasTestingPlan(content: string): boolean {
  const m = content.match(/^##\s+Testing Plan\s*\n([\s\S]*?)(?=^##\s|\n*$)/m);
  if (!m) return false;
  const section = m[1].trim();
  return section !== '' && section !== '_Add test plan during implementation._';
}

function readFrontmatter(filePath: string): Record<string, any> | null {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  const fm: Record<string, any> = {};
  for (const line of match[1].split('\n')) {
    const ci = line.indexOf(':');
    if (ci <= 0) continue;
    const key = line.slice(0, ci).trim();
    let val: any = line.slice(ci + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else if (val === 'true') val = true;
    else if (val === 'false') val = false;
    else if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    fm[key] = val;
  }
  return fm;
}

function resolvePath(p: string): string {
  return p.endsWith('.md') ? p : p + '.md';
}

function readTemplate(): string {
  const candidatePaths = [
    path.join(REPO_ROOT, 'templates', 'plan-template.md'),
    path.join(REPO_ROOT, '.docworkbench', 'doc-lifecycle', 'templates', 'plan.md'),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
  }
  return '';
}

function detectCurrentPhase(repoRoot: string): string {
  // Find the lowest-numbered in-progress or approved phase overview plan
  const plansDir = path.join(repoRoot, 'plans');
  if (!fs.existsSync(plansDir)) return '';
  try {
    const files = fs.readdirSync(plansDir).filter(f => /^phase-\d.*\.md$/.test(f));
    let best: number | null = null;
    for (const f of files) {
      const fm = readFrontmatter(path.join(plansDir, f));
      if (!fm) continue;
      const status = String(fm.status ?? '');
      if (!['approved', 'in-progress'].includes(status)) continue;
      const n = parseInt(String(fm.phase ?? '0'), 10);
      if (n > 0 && (best === null || n < best)) best = n;
    }
    return best !== null ? String(best) : '';
  } catch { return ''; }
}

function walkDeps(candidates: string[], repoRoot: string): string[] {
  const seen = new Set<string>();
  const queue = [...candidates];
  while (queue.length > 0) {
    const c = queue.shift()!;
    if (seen.has(c)) continue;
    seen.add(c);
    const resolved = path.join(repoRoot, resolvePath(c));
    const fm = readFrontmatter(resolved);
    if (!fm) continue;
    for (const field of ['depends_on', 'blocks', 'related_to']) {
      const links = Array.isArray(fm[field]) ? fm[field] : (fm[field] ? [fm[field]] : []);
      for (const link of links) {
        if (link && !seen.has(link)) queue.push(link);
      }
    }
  }
  return [...seen];
}

export async function POST({ request }) {
  const { title, candidates } = await request.json();
  if (!title || !candidates || !Array.isArray(candidates)) {
    return json({ error: 'missing title or candidates' }, { status: 400 });
  }

  const slug = slugify(title);
  const planPath = `plans/${slug}.md`;
  const resolved = path.join(REPO_ROOT, planPath);
  if (!resolved.startsWith(REPO_ROOT)) return json({ error: 'invalid path' }, { status: 403 });
  if (fs.existsSync(resolved)) {
    return json({ error: 'plan already exists', path: planPath }, { status: 409 });
  }

  // Walk dependency chains to discover transitive candidates
  const allCandidates = walkDeps(candidates, REPO_ROOT);

  // Filter out already-planned proposals and missing files
  const validCandidates: string[] = [];
  const alreadyPlanned: string[] = [];
  for (const cand of allCandidates) {
    const candResolved = path.join(REPO_ROOT, resolvePath(cand));
    if (!fs.existsSync(candResolved)) continue;
    const fm = readFrontmatter(candResolved);
    if (!fm) continue;
    if (fm.consumed_by) {
      alreadyPlanned.push(cand);
      continue;
    }
    validCandidates.push(cand);
  }

  const now = new Date().toISOString().slice(0, 10);
  const template = readTemplate();
  const currentPhase = detectCurrentPhase(REPO_ROOT);

  const sourceProposal = candidates[0] || validCandidates[0] || '';

  if (template && template.includes('{{VALUE:')) {
    const filled = template
      .replace(/\{\{VALUE:title\}\}/g, title)
      .replace(/\{\{VALUE:author\}\}/g, 'NetYeti')
      .replace(/\{\{DATE:YYYY-MM-DD\}\}/g, now)
      .replace(/\{\{VALUE:created_by\}\}/g, 'NetYeti@phoenix')
      .replace(/\{\{VALUE:tags\}\}/g, 'planning')
      .replace(/\{\{VALUE:proposal_source\}\}/g, sourceProposal)
      .replace(/\{\{VALUE:priority\}\}/g, 'medium')
      .replace(/\{\{VALUE:phase\}\}/g, currentPhase)
      .replace(/\{\{VALUE:assigned_to\}\}/g, 'NetYeti')
      .replace(/\{\{VALUE:overview\}\}/g, validCandidates.length > 1 ? `Bundles: ${validCandidates.map(c => c.split('/').pop()?.replace('.md', '')).join(', ')}` : '')
      .replace(/\{\{VALUE:testing\}\}/g, '')
      .replace(/\{\{VALUE:rollback\}\}/g, '');
    // Strip any unprocessed template syntax (Handlebars blocks, leftover tokens)
    const cleaned = filled
      .replace(/\{\{#if[^}]*\}\}/g, '')
      .replace(/\{\{else if[^}]*\}\}/g, '')
      .replace(/\{\{else\}\}/g, '')
      .replace(/\{\{\/if\}\}/g, '')
      .replace(/\{\{[#\/][^}]*\}\}/g, '');
    // Ensure plan status is draft (not proposal) — created plans begin as drafts
    const final = cleaned.replace(/^status:\s*proposal$/m, 'status: draft');
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, final, 'utf-8');
  } else {
    const depsList = validCandidates.length > 1
      ? `\nrelated_to:\n${validCandidates.map(c => `  - ${c}`).join('\n')}`
      : '\nrelated_to: []';
    const content = `---
title: "${title}"
status: draft
author: NetYeti
created: ${now}
tags:
  - planning
proposal_source: ${sourceProposal}
priority: medium
phase: ${currentPhase}
automated: guided
assigned_to: NetYeti
tests_defined: false
tests_human_reviewed: false${depsList}
---

# ${title}

## Overview

${validCandidates.length > 1 ? `This plan bundles: ${validCandidates.map(c => `[[${c.replace(/\.md$/, '')}]]`).join(', ')}` : ''}

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | | | ⏳ Pending |

## Document History

| Date | Change | Author |
|------|--------|--------|
| ${now} | Created from proposal ${sourceProposal} | NetYeti |
`;
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content, 'utf-8');
  }

  // Check candidate proposals for testing plan sections → auto-set tests_defined
  const hasAnyTesting = validCandidates.some(cand => {
    const candPath = path.join(REPO_ROOT, resolvePath(cand));
    if (!fs.existsSync(candPath)) return false;
    const raw = fs.readFileSync(candPath, 'utf-8');
    return hasTestingPlan(raw);
  });
  if (hasAnyTesting) {
    const planRaw = fs.readFileSync(resolved, 'utf-8');
    const updated = planRaw.replace(/^(tests_defined:\s*).+$/m, `$1true`);
    if (updated !== planRaw) fs.writeFileSync(resolved, updated);
  }

  // Set consumed_by on each valid candidate (skip already-planned)
  for (const cand of validCandidates) {
    const candResolved = path.join(REPO_ROOT, resolvePath(cand));
    if (!fs.existsSync(candResolved)) continue;
    const raw = fs.readFileSync(candResolved, 'utf-8');
    const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) continue;
    let fm = match[1];
    const body = match[2] || '';
    if (fm.includes('consumed_by:')) {
      fm = fm.replace(/^consumed_by:.*$/m, `consumed_by: ${planPath}`);
    } else {
      fm += `\nconsumed_by: ${planPath}`;
    }
    fs.writeFileSync(candResolved, `---\n${fm}\n---\n${body}`);
  }

  return json({
    ok: true,
    path: planPath,
    bundled: validCandidates,
    skipped: alreadyPlanned,
  });
}
