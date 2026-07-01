import * as fs from 'node:fs';
import * as path from 'node:path';
import { setDocumentField } from './vault-write';

export interface BugReport {
  title: string;
  description: string;
  reporter: string;
  priority?: 'low' | 'medium' | 'high';
  system_info?: string;
  milestone?: string;
}

export interface BugReportResult {
  isDuplicate: boolean;
  path: string;
  demandCount: number;
}

// Helper to parse simple frontmatter
function parseFm(raw: string): Record<string, any> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, any> = {};
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
      const arr: string[] = [];
      if (rest !== '[]') {
        while (i < lines.length && /^\s+-\s/.test(lines[i])) {
          arr.push(lines[i].replace(/^\s+-\s*/, '').trim());
          i++;
        }
      }
      result[key] = arr;
      continue;
    }
    let val: any = rest.replace(/^["']|["']$/g, '');
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    result[key] = val;
    i++;
  }
  return result;
}

// Helper to calculate token-based Jaccard similarity for title duplication check
function getSimilarity(s1: string, s2: string): number {
  const clean1 = s1.toLowerCase().replace(/[^\w\s]/g, '');
  const clean2 = s2.toLowerCase().replace(/[^\w\s]/g, '');
  const t1 = new Set(clean1.split(/\s+/).filter(w => w.length > 2));
  const t2 = new Set(clean2.split(/\s+/).filter(w => w.length > 2));
  if (t1.size === 0 || t2.size === 0) return 0;
  const intersection = new Set([...t1].filter(x => t2.has(x)));
  const union = new Set([...t1, ...t2]);
  return intersection.size / union.size;
}

export function reportBug(repoRoot: string, report: BugReport): BugReportResult {
  const issuesDir = path.join(repoRoot, 'issues');
  if (!fs.existsSync(issuesDir)) {
    fs.mkdirSync(issuesDir, { recursive: true });
  }

  // Scan existing open bugs to find duplicates
  let duplicateFile: { relPath: string; absPath: string; fm: Record<string, any> } | null = null;
  const files = fs.readdirSync(issuesDir);
  for (const file of files) {
    if (!file.endsWith('.md') || file === 'README.md') continue;
    const absPath = path.join(issuesDir, file);
    try {
      const raw = fs.readFileSync(absPath, 'utf-8');
      const fm = parseFm(raw);
      if (fm.category === 'bug' && ['open', 'in-progress'].includes(String(fm.status ?? ''))) {
        const titleSim = getSimilarity(report.title, fm.title || '');
        if (titleSim >= 0.7 || (report.title.toLowerCase().trim() === String(fm.title ?? '').toLowerCase().trim())) {
          duplicateFile = { relPath: path.join('issues', file), absPath, fm };
          break;
        }
      }
    } catch { /* skip */ }
  }

  if (duplicateFile) {
    // Duplicate bug: increment demand count
    const currentDemand = parseInt(String(duplicateFile.fm.demand_count ?? '1'), 10);
    const nextDemand = currentDemand + 1;
    setDocumentField(repoRoot, duplicateFile.relPath, 'demand_count', nextDemand, 'human');
    return {
      isDuplicate: true,
      path: duplicateFile.relPath,
      demandCount: nextDemand,
    };
  }

  // New bug: create document
  const slug = report.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50);
  
  let uniqueSlug = slug;
  let counter = 1;
  while (fs.existsSync(path.join(issuesDir, `bug-${uniqueSlug}.md`))) {
    uniqueSlug = `${slug}-${counter}`;
    counter++;
  }

  const filename = `bug-${uniqueSlug}.md`;
  const relPath = path.join('issues', filename);
  const absPath = path.join(issuesDir, filename);

  const todayStr = new Date().toISOString().slice(0, 10);
  const targetMilestone = report.milestone || 'v0.5.0';

  const bugContent = `---
title: ${report.title}
status: open
created: ${todayStr}
author: ${report.reporter}
author-role: user
category: bug
priority: ${report.priority || 'medium'}
complexity: medium
estimated_effort: S
demand_count: 1
milestone: ${targetMilestone}
channel: dev
tags:
  - reported-bug
---

# ${report.title}

## Description

${report.description}

## System Info

${report.system_info || 'None provided'}
`;

  fs.writeFileSync(absPath, bugContent, 'utf-8');

  return {
    isDuplicate: false,
    path: relPath,
    demandCount: 1,
  };
}
