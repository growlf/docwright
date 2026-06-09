import { readFile, globFiles, getRepoRoot } from '../lib/paths';
import { parseFrontmatter, extractFrontmatterField } from '../lib/frontmatter';
import { tokenize, jaccard } from '../lib/collate';
import * as path from 'node:path';
import * as fs from 'node:fs';

export async function getFacts(): Promise<string> {
  const parts: string[] = [];
  parts.push(`## Invariants

1. Agents NEVER set approved: true on proposals — only humans
2. No active work before plan approval (status: approved or in-progress)
3. Lifecycle transitions MUST use \`transition_to_*\` MCP tools, not direct file edits
4. Frontmatter is audit record, not enforcement
5. Git is the canonical store — index.json is derived cache, rebuild don't restore
6. No telemetry, ever
7. author-role field required in all templates

## MCP State Machine Rules

- transition_to_approved: requires approved: true + non-empty assigned_to (human sets these)
- transition_to_completed: requires all tasks completed, plan not already done
- transition_to_canceled: requires non-empty cancellation_reason
- All transitions are logged to .docwright/audit.jsonl (append-only NDJSON)`);

  try {
    const sops = globFiles('docs/SOPs', '*.md');
    // Python always appends the header if the directory is reachable, even if empty
    const sopList = sops.sort().map(p => `- ${p}`).join('\n');
    parts.push(`## Available SOPs\n\n${sopList}`);
  } catch {
    // ignore
  }
  
  return parts.join('\n\n---\n\n');
}

export async function collate(threshold: number = 0.12): Promise<string> {
  try {
    const docDirs = ['proposals', 'proposals/approved', 'plans', 'plans/completed'];
    const docs: Array<{ path: string; tokens: Set<string>; title: string }> = [];
    
    for (const dir of docDirs) {
      const files = globFiles(dir, '*.md');
      for (const f of files) {
        try {
          const text = readFile(f);
          const fm_end = text.indexOf('---', 3);
          const fm = fm_end > 0 ? text.slice(3, fm_end) : '';
          const body = fm_end > 0 ? text.slice(fm_end + 3) : text;
          const title = extractFrontmatterField(text, 'title') || path.basename(f, '.md');
          
          docs.push({ 
            path: f, 
            tokens: tokenize(fm + '\n' + body), 
            title 
          });
        } catch {}
      }
    }
    
    const n = docs.length;
    const pairs: Array<{ score: number; a: any; b: any }> = [];
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const score = jaccard(docs[i].tokens, docs[j].tokens);
        if (score >= threshold) {
          pairs.push({ score, a: docs[i], b: docs[j] });
        }
      }
    }
    
    pairs.sort((a, b) => b.score - a.score);
    
    if (pairs.length === 0) {
      return `No overlaps found above threshold ${threshold} across ${n} documents.`;
    }
    
    const lines = [`Overlap analysis (${pairs.length} pairs above threshold ${threshold}):`, ''];
    
    pairs.forEach(p => {
      const pct = p.score >= 0.1 ? `${Math.round(p.score * 100)}%` : `${(p.score * 100).toFixed(1)}%`;
      lines.push(`  ${pct.padStart(3)}  ${p.a.path}`);
      lines.push(`       ${p.b.path}`);
      lines.push('');
    });
    
    return lines.join('\n').trimEnd();
  } catch (e: any) {
    return `Collation error: ${e.message}`;
  }
}

export async function runDryRun(): Promise<string> {
  const lines: string[] = [];
  lines.push('PENDING LIFECYCLE TRANSITIONS (dry run)');
  lines.push('='.repeat(50));

  const proposals = globFiles('proposals', '*.md');
  for (const p of proposals) {
    try {
      const text = readFile(p);
      const fm = parseFrontmatter(text);
      if (String(fm['approved']) === 'true' && fm['assigned_to']) {
        const title = fm['title'] || path.basename(p, '.md');
        lines.push(`\n[READY TO APPROVE]  ${path.basename(p, '.md')}`);
        lines.push(`  Title: ${title}`);
        lines.push(`  Assigned to: ${fm['assigned_to']}`);
        lines.push(`  Run: transition_to_approved(name='${path.basename(p, '.md')}')`);
      }
    } catch {}
  }

  const plans = globFiles('plans', '*.md');
  for (const p of plans) {
    try {
      const text = readFile(p);
      const fm = parseFrontmatter(text);
      if (String(fm['status']) === 'completed') {
        const title = fm['title'] || path.basename(p, '.md');
        lines.push(`\n[READY TO COMPLETE]  ${path.basename(p, '.md')}`);
        lines.push(`  Title: ${title}`);
        lines.push(`  Run: transition_to_completed(name='${path.basename(p, '.md')}')`);
      }
    } catch {}
  }

  return lines.join('\n').trimEnd();
}

export async function auditLog(limit: number = 50): Promise<string> {
  const root = getRepoRoot();
  const auditPath = path.join(root, '.docwright', 'audit.jsonl');
  
  if (!fs.existsSync(auditPath)) {
    return 'No audit log entries yet.';
  }
  
  try {
    const raw = fs.readFileSync(auditPath, 'utf8');
    const lines = raw.split('\n').filter(l => l.trim() !== '');
    const entries = lines.slice(-limit).map(l => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
    
    if (entries.length === 0) {
      return 'No audit log entries yet.';
    }
    
    const rows = entries.map(e => {
      const ts = String(e.ts || '').slice(0, 19);
      const event = e.event || '';
      const detail = e.details || e.file || '';
      return `| ${ts} | ${event} | ${detail} |`;
    });
    
    return [
      '| Timestamp | Event | Detail |',
      '|-----------|-------|--------|',
      ...rows
    ].join('\n');
  } catch (e: any) {
    return `Error reading audit log: ${e.message}`;
  }
}
