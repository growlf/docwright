import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';

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

function parseFrontmatter(raw: string): Record<string, any> {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const result: Record<string, any> = {};
  for (const line of m[1].split('\n')) {
    const ci = line.indexOf(':');
    if (ci <= 0) continue;
    const key = line.slice(0, ci).trim();
    let val: any = line.slice(ci + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else if (val === 'true') val = true;
    else if (val === 'false') val = false;
    else if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    result[key] = val;
  }
  return result;
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

  // Write plan file FIRST — if this fails, proposal stays untouched
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

## Implementation Steps

> When marking a task ✅ Complete, update every step row in this table
> to reflect what was actually built. Stale ⏳ rows mislead reviewers.

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | | | ⏳ Pending |

## Testing Plan



## Rollback Procedures



## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| | | | |

## Document History

| Date | Change | Author |
|------|--------|--------|
| ${now} | Created from approved proposal | ${author} |
`;
  const planPath = path.join(REPO_ROOT, planRel);
  if (!fs.existsSync(path.dirname(planPath))) fs.mkdirSync(path.dirname(planPath), { recursive: true });
  fs.writeFileSync(planPath, planContent, 'utf-8');

  // Auto-detect tests_defined from proposal body
  const bodyMatch = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  const proposalBody = bodyMatch ? bodyMatch[1] : '';
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
