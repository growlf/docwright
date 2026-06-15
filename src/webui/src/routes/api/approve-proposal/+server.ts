import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { parseFrontmatter } from '../../../../../dispatch/frontmatter';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

const AUDIT_LOG = path.join(REPO_ROOT, '.docwright', 'audit.jsonl');

function hasTestingPlan(content: string): boolean {
  const m = content.match(/^##\s+Testing Plan\s*\n([\s\S]*?)(?=^##\s|\n*$)/m);
  if (!m) return false;
  const section = m[1].trim();
  return section !== '' && section !== '_Add test plan during implementation._';
}

function logAudit(action: string, detail: string) {
  const dir = path.dirname(AUDIT_LOG);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    event: action,
    detail,
    host: '',
  });
  fs.appendFileSync(AUDIT_LOG, entry + '\n');
}

export async function POST({ request }) {
  const { path: filePath } = await request.json();
  if (!filePath) return json({ error: 'missing path' }, { status: 400 });

  // Normalize — strip proposals/ prefix if present, ensure .md
  const norm = filePath
    .replace(/^proposals\//, '')
    .replace(/\.md$/, '') + '.md';

  const src = path.resolve(REPO_ROOT, 'proposals', norm);
  if (!src.startsWith(REPO_ROOT)) return json({ error: 'invalid path' }, { status: 403 });
  if (!fs.existsSync(src)) return json({ error: 'proposal not found' }, { status: 404 });

  const raw = fs.readFileSync(src, 'utf-8');
  const fm = parseFrontmatter(raw);

  if (fm.approved !== true) {
    return json({ error: 'proposal must have approved: true' }, { status: 400 });
  }

  const assigned = Array.isArray(fm.assigned_to)
    ? fm.assigned_to.filter(Boolean).join(', ')
    : String(fm.assigned_to || '').trim();

  if (!assigned) {
    return json({ error: 'proposal must have non-empty assigned_to' }, { status: 400 });
  }

  const title = fm.title || norm.replace('.md', '');
  const author = fm.author || 'NetYeti';
  const tags = Array.isArray(fm.tags) ? fm.tags.join(', ') : (fm.tags || '');
  const now = new Date().toISOString().slice(0, 10);
  const planSlug = norm;
  const planRel = `plans/${planSlug}`;
  const approvedRel = `proposals/approved/${norm}`;

  // Build plan content from proposal body sections
  function parseSections(body: string): { name: string; content: string }[] {
    const sections: { name: string; content: string }[] = [];
    const lines = body.split('\n');
    let currentName = 'Overview';
    let currentLines: string[] = [];
    for (const line of lines) {
      const m = line.match(/^##\s+(.+)/);
      if (m) {
        if (currentLines.length > 0 || sections.length === 0) {
          sections.push({ name: currentName, content: currentLines.join('\n').trim() });
        }
        currentName = m[1].trim();
        currentLines = [];
      } else {
        currentLines.push(line);
      }
    }
    if (currentLines.length > 0 || sections.length === 0) {
      sections.push({ name: currentName, content: currentLines.join('\n').trim() });
    }
    return sections;
  }

  const bodyMatch = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  const proposalBody = bodyMatch ? bodyMatch[1].trim() : '';
  const proposalSections = parseSections(proposalBody);

  const KNOWN = ['testing plan', 'risk assessment', 'rollback procedures', 'implementation steps', 'proposed solution', 'proposed approach'];
  const mapped: Record<string, { name: string; content: string }> = {};
  const context: { name: string; content: string }[] = [];
  for (const s of proposalSections) {
    if (KNOWN.includes(s.name.toLowerCase())) {
      mapped[s.name.toLowerCase()] = s;
    } else {
      context.push(s);
    }
  }

  let stepsBody = '';
  if (mapped['implementation steps']) {
    stepsBody = mapped['implementation steps'].content;
  } else if (mapped['proposed solution']) {
    const items: string[] = [];
    for (const line of mapped['proposed solution'].content.split('\n')) {
      const li = line.match(/^\s*\d+\.\s+(.+)/);
      if (li) items.push(li[1].trim());
    }
    if (items.length > 0) {
      stepsBody = items.map((item, i) => `| ${i + 1} | ${item} | | ⏳ Pending |`).join('\n');
    }
  } else if (mapped['proposed approach']) {
    const items: string[] = [];
    for (const line of mapped['proposed approach'].content.split('\n')) {
      const li = line.match(/^\s*\d+\.\s+(.+)/);
      if (li) items.push(li[1].trim());
    }
    if (items.length > 0) {
      stepsBody = items.map((item, i) => `| ${i + 1} | ${item} | | ⏳ Pending |`).join('\n');
    }
  }
  if (!stepsBody) {
    stepsBody = '| Step | Action | Details | Status |\n|------|--------|---------|--------|\n| 1 | | | ⏳ Pending |';
  }

  let contextBody = '';
  for (const s of context) {
    if (s.content) contextBody += `\n### ${s.name}\n\n${s.content}\n`;
  }

  const testingBody = mapped['testing plan'] ? mapped['testing plan'].content : '_Testing plan TBD_';
  const rollbackBody = mapped['rollback procedures'] ? mapped['rollback procedures'].content : '_Rollback procedures TBD_';
  const riskBody = mapped['risk assessment'] ? mapped['risk assessment'].content : '_Risk assessment TBD_';

  const planContent = `---
title: ${title}
status: approved
author: ${author}
created: ${now}
tags: ${tags}
proposal_source: ${approvedRel}
priority: medium
automated: guided
assigned_to: ${assigned}
tests_defined: false
tests_human_reviewed: false
---

# ${title}

## Overview

*Plan generated from approved proposal: ${title}*
${contextBody}

## Implementation Steps

${stepsBody}

## Testing Plan

${testingBody}

## Rollback Procedures

${rollbackBody}

## Risk Assessment

${riskBody}

## Document History

| Date | Change | Author |
|------|--------|--------|
| ${now} | Created from approved proposal | ${author} |
`;
  const planPath = path.join(REPO_ROOT, planRel);
  if (!fs.existsSync(path.dirname(planPath))) fs.mkdirSync(path.dirname(planPath), { recursive: true });
  fs.writeFileSync(planPath, planContent, 'utf-8');

  // Auto-detect tests_defined from proposal body
  if (proposalBody && hasTestingPlan(proposalBody)) {
    const planRaw = fs.readFileSync(planPath, 'utf-8');
    const updated = planRaw.replace(/^(tests_defined:\s*).+$/m, `$1true`);
    if (updated !== planRaw) fs.writeFileSync(planPath, updated);
  }

  // Move proposal to proposals/approved/ (only after plan is safely on disk)
  const dstDir = path.join(REPO_ROOT, 'proposals', 'approved');
  if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
  const dst = path.join(dstDir, norm);
  fs.renameSync(src, dst);

  // Write consumed_by back into the approved proposal so the UI can link to the plan
  const approvedRaw = fs.readFileSync(dst, 'utf-8');
  const fmMatch = approvedRaw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (fmMatch) {
    let fmContent = fmMatch[1];
    const body = fmMatch[2];
    if (fmContent.includes('consumed_by:')) {
      fmContent = fmContent.replace(/^consumed_by:.*$/m, `consumed_by: ${planRel}`);
    } else {
      fmContent += `\nconsumed_by: ${planRel}`;
    }
    fs.writeFileSync(dst, `---\n${fmContent}\n---\n${body}`);
  }

  logAudit('APPROVED', `proposal/${norm} → proposals/approved/ + plan created`);

  return json({
    ok: true,
    approvedPath: approvedRel,
    planPath: planRel,
  });
}
