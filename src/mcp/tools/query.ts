import { readFile, fileExists, getMtime, globFiles } from '../lib/paths';
import { extractFrontmatterField, parseFrontmatter } from '../lib/frontmatter';
import { countSteps } from '../lib/steps';
import * as path from 'node:path';
import * as fs from 'node:fs';

const PLAN_MUTATION_TOOLS = [
  'update_step',
  'update_plan_status',
  'append_history',
  'set_plan_field',
  'write_plan',
];

const CACHE_TTL = 60;
let STATUS_CACHE: { text: string; mtime: number } | null = null;

function governanceFooter(): string {
  const tools = PLAN_MUTATION_TOOLS.join(' · ');
  return (
    '\n\n---\n' +
    `⚠ **Governance:** mutate this plan via MCP only — ${tools}. ` +
    'Direct writes to `plans/*.md` are blocked by the PreToolUse hook. ' +
    'Bash/Python writes bypass the hook and are equally prohibited (AGENTS.md §Invariant 6). ' +
    'If MCP is unavailable: halt and report, do not fall back to direct writes.'
  );
}

function scanPlans(dir: string, ...statuses: string[]): Array<[string, string, string]> {
  const results: Array<[string, string, string]> = [];
  const files = globFiles(dir, '*.md');
  
  for (const relPath of files) {
    try {
      const text = readFile(relPath);
      const fm = parseFrontmatter(text);
      const status = String(fm['status'] || '').toLowerCase();
      const title = String(fm['title'] || path.basename(relPath, '.md'));
      
      if (statuses.length === 0 || statuses.includes(status)) {
        results.push([title, relPath, status]);
      }
    } catch {
      // skip unreadable
    }
  }
  return results;
}

function activePlansText(): string {
  const plans = scanPlans('plans', 'approved', 'in_progress', 'in-progress');
  if (plans.length === 0) {
    return 'No plans ready for execution.';
  }
  const lines = plans.map(([t, f, s]) => `- ${t}  (${f}) [${s}]`);
  return 'Active plans:\n' + lines.join('\n');
}

export async function getSessionContext(): Promise<string> {
  const parts: string[] = [];
  try {
    const log = readFile('SESSION-LOG.md');
    const lines = log.split('\n');
    if (lines.length > 100) {
      parts.push(`[SESSION-LOG.md — showing last 100 of ${lines.length} lines]\n\n` + lines.slice(-100).join('\n'));
    } else {
      parts.push(`[SESSION-LOG.md]\n\n${log}`);
    }
  } catch (e: any) {
    parts.push(`[SESSION-LOG.md unavailable: ${e.message}]`);
  }
  
  try {
    parts.push(`[Active Plans]\n\n${activePlansText()}`);
  } catch (e: any) {
    parts.push(`[Active plans unavailable: ${e.message}]`);
  }
  
  return parts.join('\n\n---\n\n');
}

export async function listActivePlans(): Promise<string> {
  try {
    return activePlansText();
  } catch (e: any) {
    return `Error listing plans: ${e.message}`;
  }
}

export async function getPlan(name: string): Promise<string> {
  const footer = governanceFooter();
  const safe = name.endsWith('.md') ? name : `${name}.md`;
  
  try {
    const text = readFile(`plans/${safe}`);
    return text + footer;
  } catch {
    try {
      const text = readFile(`plans/completed/${safe}`);
      return `[completed plan]\n\n${text}` + footer;
    } catch {
      return `Plan '${name}' not found. Use list_active_plans() or get_status().`;
    }
  }
}

function buildStatus(): string {
  const lines: string[] = [];
  lines.push('# DocWright Vault Status');
  
  const proposals = globFiles('proposals', '*.md');
  const approved = globFiles('proposals/approved', '*.md');
  const plans = globFiles('plans', '*.md');
  const completed = globFiles('plans/completed', '*.md');
  
  lines.push(`\n- Proposals: ${proposals.length} raw, ${approved.length} approved`);
  lines.push(`- Plans: ${plans.length} active, ${completed.length} archived`);
  
  const active = scanPlans('plans', 'approved', 'in_progress', 'in-progress');
  if (active.length > 0) {
    lines.push('\n## Active Plans');
    active.forEach(([t, f, s]) => lines.push(`- [${s.toUpperCase()}] ${t} (${f})`));
  }
  
  const ready = [];
  for (const p of proposals) {
    try {
      const text = readFile(p);
      const fm = parseFrontmatter(text);
      if (String(fm['approved']) === 'true' && fm['assigned_to']) {
        ready.push(p);
      }
    } catch {}
  }
  
  if (ready.length > 0) {
    lines.push('\n## Ready for Approval');
    ready.forEach(p => lines.push(`- ${p}`));
  }

  return lines.join('\n');
}

export async function getStatus(): Promise<string> {
  const now = Date.now() / 1000;
  if (STATUS_CACHE && (now - STATUS_CACHE.mtime) < CACHE_TTL) {
    return STATUS_CACHE.text;
  }
  
  try {
    const result = buildStatus();
    STATUS_CACHE = { text: result, mtime: now };
    return result;
  } catch (e: any) {
    if (STATUS_CACHE) {
      return `[stale cache — live fetch failed: ${e.message}]\n\n${STATUS_CACHE.text}`;
    }
    return `Status unavailable: ${e.message}`;
  }
}
