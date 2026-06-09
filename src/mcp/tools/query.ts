import { readFile, fileExists, getMtime, globFiles, getRepoRoot } from '../lib/paths';
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
      const status = extractFrontmatterField(text, 'status');
      const title = extractFrontmatterField(text, 'title') || path.basename(relPath, '.md');
      
      const normalizedStatus = String(status).toLowerCase();
      if (statuses.length === 0 || statuses.includes(normalizedStatus)) {
        results.push([title, path.basename(relPath), normalizedStatus]);
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
  const sep = '-'.repeat(80);
  
  // Center alignment for header (80 chars)
  const header = 'LIFECYCLE DOCUMENT STATUS';
  const padding = Math.max(0, Math.floor((80 - header.length) / 2));
  lines.push(' '.repeat(padding) + header + ' '.repeat(80 - header.length - padding));
  
  // Use a fixed timestamp for tests or just let it mismatch
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  lines.push(`  ${now}`);
  lines.push('');
  
  const active = scanPlans('plans', 'approved', 'in_progress', 'in-progress');
  if (active.length === 0) {
    lines.push('  ⚠  COMPLIANCE WARNING: No active approved plan.');
    lines.push('      Lifecycle transitions require an active plan.');
    lines.push('      Run list_active_plans() to see available plans.');
    lines.push('');
  }
  
  lines.push('  PROPOSALS (proposals/):');
  lines.push(`  ${sep}`);
  const proposals = globFiles('proposals', '*.md');
  for (const f of proposals) {
    try {
      const text = readFile(f);
      const status = extractFrontmatterField(text, 'status');
      const s = status !== undefined ? String(status).toLowerCase() : '';
      const mark = s === 'false' ? '✗' : s === 'true' ? '✓' : s;
      lines.push(`     ${path.basename(f).padEnd(55)} approved=${mark}`);
    } catch {}
  }
  lines.push('');
  
  lines.push('  APPROVED PROPOSALS (proposals/approved/):');
  lines.push(`  ${sep}`);
  const approvedFiles = globFiles('proposals/approved', '*.md');
  for (const f of approvedFiles) {
    try {
      const text = readFile(f);
      const assigned = extractFrontmatterField(text, 'assigned_to') || '—';
      lines.push(`     ${path.basename(f, '.md').padEnd(55)} assigned_to=${assigned}`);
    } catch {}
  }
  lines.push('');
  
  lines.push('  PLANS (plans/):');
  lines.push(`  ${sep}`);
  const plans = globFiles('plans', '*.md');
  for (const f of plans) {
    try {
      const text = readFile(f);
      const status = extractFrontmatterField(text, 'status');
      lines.push(`     ${path.basename(f).padEnd(55)} status=${status}`);
    } catch {}
  }
  lines.push('');
  
  lines.push('  COMPLETED PLANS (plans/completed/):');
  lines.push(`  ${sep}`);
  const completed = globFiles('plans/completed', '*.md');
  for (const f of completed) {
    try {
      const text = readFile(f);
      const status = extractFrontmatterField(text, 'status');
      lines.push(`     ${path.basename(f).padEnd(55)} status=${status}`);
    } catch {}
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
