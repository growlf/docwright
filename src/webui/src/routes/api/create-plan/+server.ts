import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { parseFrontmatter, setFrontmatterField } from '../../../../../dispatch/frontmatter';
import { syncTestCriteria } from '../../../../../dispatch/test-criteria';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') || 'plan';
}

function readFrontmatter(filePath: string): Record<string, any> | null {
  if (!fs.existsSync(filePath)) return null;
  return parseFrontmatter(fs.readFileSync(filePath, 'utf-8'));
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

function readFileBody(filePath: string): string {
  const resolved = path.join(REPO_ROOT, resolvePath(filePath));
  if (!fs.existsSync(resolved)) return '';
  const raw = fs.readFileSync(resolved, 'utf-8');
  const m = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return m ? m[1].trim() : '';
}

function parseProposalSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = body.split('\n');
  let currentName = '';
  let currentLines: string[] = [];
  for (const line of lines) {
    const m = line.match(/^##\s+(.+)/);
    if (m) {
      if (currentName) sections[currentName.toLowerCase()] = currentLines.join('\n').trim();
      currentName = m[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentName) sections[currentName.toLowerCase()] = currentLines.join('\n').trim();
  return sections;
}

function extractStepsFromProposal(sections: Record<string, string>): string {
  // Ordered list of section names to try for step extraction
  const stepSourceSections = [
    'implementation steps',
    'proposed solution',
    'proposed approach',
    'notes for plan generation',
    'phasing',
    'implementation plan',
  ];
  for (const sectionName of stepSourceSections) {
    if (sections[sectionName]) {
      const items: string[] = [];
      for (const line of sections[sectionName].split('\n')) {
        const li = line.match(/^\s*\d+\.\s+(.+)/);
        if (li) items.push(li[1].trim());
      }
      if (items.length > 0) {
        return items.map((item, i) => `| ${i + 1} | ${item} | | ⏳ Pending |`).join('\n');
      }
    }
  }
  return '';
}

function getProposalSection(sections: Record<string, string>, names: string[]): string {
  for (const name of names) {
    if (sections[name]) return sections[name];
  }
  return '';
}

function getContextSections(sections: Record<string, string>, exclude: string[]): string {
  const parts: string[] = [];
  const excludeLower = exclude.map(s => s.toLowerCase());
  for (const [name, content] of Object.entries(sections)) {
    if (!excludeLower.includes(name) && content) {
      parts.push(`### ${name.charAt(0).toUpperCase() + name.slice(1)}\n\n${content}\n`);
    }
  }
  return parts.join('\n');
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

  // Parse the first candidate proposal's body to extract sections
  const proposalBody = readFileBody(sourceProposal);
  const proposalSections = proposalBody ? parseProposalSections(proposalBody) : {};
  const stepsBody = extractStepsFromProposal(proposalSections) || '| 1 | | | ⏳ Pending |';
  const testingBody = getProposalSection(proposalSections, ['testing plan', 'test plan', 'testing']) || '';
  const riskBody = getProposalSection(proposalSections, ['risk assessment', 'risks', 'risk']) || '';
  const rollbackBody = getProposalSection(proposalSections, ['rollback procedures', 'rollback', 'rollback plan']) || '';
  const contextBody = getContextSections(proposalSections, ['implementation steps', 'proposed solution', 'proposed approach', 'testing plan', 'test plan', 'testing', 'risk assessment', 'risks', 'risk', 'rollback procedures', 'rollback', 'rollback plan', 'expected outcomes', 'resources required', 'notes for plan generation']);

  const overviewBody = validCandidates.length > 1
    ? `This plan bundles: ${validCandidates.map(c => `[[${c.replace(/\.md$/, '')}]]`).join(', ')}`
    : (contextBody || '');

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
      .replace(/\{\{VALUE:overview\}\}/g, overviewBody)
      .replace(/\{\{VALUE:testing\}\}/g, testingBody)
      .replace(/\{\{VALUE:rollback\}\}/g, rollbackBody)
      .replace(/\{\{VALUE:risk\}\}/g, riskBody)
      .replace(/\{\{VALUE:steps\}\}/g, stepsBody);
    // Strip any unprocessed template syntax (Handlebars blocks, leftover tokens)
    const cleaned = filled
      .replace(/\{\{#if[^}]*\}\}/g, '')
      .replace(/\{\{else if[^}]*\}\}/g, '')
      .replace(/\{\{else\}\}/g, '')
      .replace(/\{\{\/if\}\}/g, '')
      .replace(/\{\{[#\/][^}]*\}\}/g, '')
      .replace(/\{\{VALUE:[^}]*\}\}/g, '');
    // Ensure plan status is draft (not proposal) — created plans begin as drafts
    const final = cleaned.replace(/^status:\s*proposal$/m, 'status: draft');
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, final, 'utf-8');
  } else {
    const depsList = validCandidates.length > 1
      ? `\nrelated_to:\n${validCandidates.map(c => `  - ${c}`).join('\n')}`
      : '\nrelated_to: []';
    const contextSection = contextBody ? `\n${contextBody}\n` : '';
    const testingSection = testingBody ? `\n## Testing Plan\n\n${testingBody}\n` : '';
    const riskSection = riskBody ? `\n## Risk Assessment\n\n${riskBody}\n` : '';
    const rollbackSection = rollbackBody ? `\n## Rollback Procedures\n\n${rollbackBody}\n` : '';
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

${overviewBody || '*Plan generated from proposal*'}

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
${stepsBody}
${testingSection}${riskSection}${rollbackSection}
## Document History

| Date | Change | Author |
|------|--------|--------|
| ${now} | Created from proposal ${sourceProposal} | NetYeti |
`;
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content, 'utf-8');
  }

  // Sync test criteria into the plan — always ensures the Testing Plan section exists
  {
    const planRaw = fs.readFileSync(resolved, 'utf-8');
    const synced = syncTestCriteria(planRaw, title);
    const withTestsDefined = setFrontmatterField(synced, 'tests_defined', true);
    fs.writeFileSync(resolved, withTestsDefined, 'utf-8');
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
