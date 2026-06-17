import { readFile, fileExists, getMtime, globFiles, getRepoRoot } from '../lib/paths';
import { extractFrontmatterField, parseFrontmatter } from '../lib/frontmatter';
import { countSteps } from '../lib/steps';
import { getHumanIdentity } from '../lib/identity';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';

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
    } catch { /* intentionally empty */ }
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
    } catch { /* intentionally empty */ }
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
    } catch { /* intentionally empty */ }
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
    } catch { /* intentionally empty */ }
  }

  return lines.join('\n');
}

export function getSessionContextStructured(): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Identity
  const root = getRepoRoot();
  let humanName = '';
  let humanEmail = '';
  if (root) {
    const envPath = path.join(root, '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const nameMatch = content.match(/^OPCODE_USER_NAME=(.*)$/m);
      if (nameMatch) humanName = nameMatch[1].trim().replace(/^["']|["']$/g, '');
      const emailMatch = content.match(/^OPCODE_USER_EMAIL=(.*)$/m);
      if (emailMatch) humanEmail = emailMatch[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  if (!humanName) humanName = getHumanIdentity();
  try {
    if (!humanEmail) humanEmail = execSync('git config user.email', { encoding: 'utf8' }).trim();
  } catch { /* ignore */ }

  let hostname = '';
  try { hostname = execSync('hostname', { encoding: 'utf8' }).trim(); } catch { hostname = 'unknown'; }

  let network = '';
  try {
    const trace = execSync('traceroute -n 8.8.8.8 2>&1', { encoding: 'utf8' });
    const lines = trace.trim().split('\n');
    const hop = lines.find(l => l.includes('8.8.8.8')) || lines[lines.length - 2] || lines[0] || '';
    network = hop.replace(/^\s*\d+\s+/, '').split(/\s+/)[0] || 'unknown';
  } catch { network = 'unreachable'; }

  result['identity'] = {
    human: { name: humanName, email: humanEmail },
    machine: hostname,
    network,
  };

  // Active plans with step progress
  const planFiles = globFiles('plans', '*.md');
  const activePlans: Array<Record<string, unknown>> = [];
  for (const f of planFiles) {
    try {
      const text = readFile(f);
      const fm = parseFrontmatter(text);
      const status = String(fm['status'] || '').toLowerCase();
      if (status === 'approved' || status === 'in-progress' || status === 'in_progress') {
        const { total, completed } = countSteps(text);
        activePlans.push({
          file: path.basename(f),
          title: fm['title'] || path.basename(f, '.md'),
          status,
          steps_done: completed,
          steps_total: total,
          assigned_to: fm['assigned_to'] || '',
        });
      }
    } catch { /* skip */ }
  }
  result['active_plans'] = activePlans;

  // Pending proposals
  try {
    const proposals = globFiles('proposals', '*.md');
    const approvedProposals = globFiles('proposals/approved', '*.md');
    result['pending_proposals'] = { unapproved: proposals.length, approved: approvedProposals.length };
  } catch { result['pending_proposals'] = { unapproved: 0, approved: 0 }; }

  // Last session entry
  try {
    const log = readFile('SESSION-LOG.md');
    const entries = log.split(/(?=^##\s)/m);
    const last = entries.filter(e => e.trim()).pop() || '';
    result['last_session'] = last.trim();
    result['session_log_lines'] = log.split('\n').length;
  } catch {
    result['last_session'] = 'No SESSION-LOG.md found';
    result['session_log_lines'] = 0;
  }

  // Git status
  try {
    const git = execSync('git status --porcelain', { cwd: root, encoding: 'utf8' }).trim();
    const lines = git ? git.split('\n') : [];
    const staged = lines.filter(l => l.startsWith('M ') || l.startsWith('A ') || l.startsWith('D ') || l.startsWith('R ') || l.startsWith('C '));
    const modified = lines.filter(l => l.startsWith(' M') || l.startsWith('??'));
    result['git_status'] = {
      staged: staged.length,
      modified: modified.length,
      total: lines.length,
      porcelain: lines.slice(0, 20), // first 20 files
    };
  } catch {
    result['git_status'] = { staged: 0, modified: 0, total: 0, porcelain: [] };
  }

  return result;
}

export interface NextAction {
  status: 'ok' | 'all-clear';
  plan?: string;
  plan_title?: string;
  priority?: string;
  step_number?: number;
  step_action?: string;
  step_status?: string;
  completed_steps?: number;
  total_steps?: number;
  sub_plan_proposal?: string;
  sub_plan_approved?: boolean;
  sub_plan_name?: string;
  message?: string;
}

export function nextAction(): NextAction {
  const root = getRepoRoot();
  if (!root) return { status: 'all-clear', message: 'No repo root found.' };

  const planFiles = globFiles('plans', '*.md');
  const activePlans: Array<{ file: string; text: string; fm: Record<string, any>; total: number; completed: number }> = [];

  for (const f of planFiles) {
    try {
      const text = readFile(f);
      const fm = parseFrontmatter(text);
      const status = String(fm['status'] || '').toLowerCase();
      if (status === 'approved' || status === 'in-progress' || status === 'in_progress') {
        const { total, completed } = countSteps(text);
        activePlans.push({ file: path.basename(f), text, fm, total, completed });
      }
    } catch { /* skip */ }
  }

  if (activePlans.length === 0) {
    return { status: 'all-clear', message: 'No active plans found.' };
  }

  // Sort by priority (high > medium > low), then by completion ratio ascending
  const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
  activePlans.sort((a, b) => {
    const pa = PRIORITY_ORDER[String(a.fm['priority'] || 'medium').toLowerCase()] ?? 1;
    const pb = PRIORITY_ORDER[String(b.fm['priority'] || 'medium').toLowerCase()] ?? 1;
    if (pa !== pb) return pa - pb;
    const ratioA = a.total > 0 ? a.completed / a.total : 0;
    const ratioB = b.total > 0 ? b.completed / b.total : 0;
    return ratioA - ratioB;
  });

  const top = activePlans[0];

  // Find first ⏳ Pending step
  const lines = top.text.split('\n');
  let inSteps = false;
  let stepNumber = 0;
  let pendingStep: { action: string; status: string } | null = null;

  for (const line of lines) {
    if (/^##\s/.test(line)) {
      inSteps = /^##\s+Implementation Steps\b/i.test(line);
      continue;
    }
    if (!inSteps || !line.startsWith('|')) continue;
    if (line.includes('|---') || line.includes('| ---')) continue;

    const parts = line.split('|').map(p => p.trim());
    if (parts.length < 3) continue;
    if (parts[parts.length - 2]?.toLowerCase() === 'status') continue; // header row

    stepNumber++;
    const action = parts[2] || '';
    const statusCell = parts[parts.length - 2] || '';

    if (statusCell.includes('⏳') || statusCell === 'Pending' || statusCell === 'pending' || statusCell === '') {
      pendingStep = { action, status: statusCell };
      break;
    }
  }

  if (!pendingStep) {
    return {
      status: 'all-clear',
      plan: top.file,
      plan_title: top.fm['title'] || top.file,
      message: `All ${top.total} steps are done in '${top.file}'. No pending work.`,
    };
  }

  // Try to detect sub-plan reference in the step action/details
  let subPlanProposal = '';
  let subPlanApproved = false;
  const stepText = pendingStep.action;

  // Check if action references a sub-plan proposal file
  const proposalMatch = stepText.match(/sub-plan-[\w-]+/);
  if (proposalMatch) {
    subPlanProposal = `proposals/approved/${proposalMatch[0]}.md`;
    subPlanApproved = fileExists(subPlanProposal);
    if (!subPlanApproved) {
      subPlanProposal = `proposals/${proposalMatch[0]}.md`;
    }
  }

  return {
    status: 'ok',
    plan: top.file,
    plan_title: top.fm['title'] || top.file,
    priority: top.fm['priority'] || 'medium',
    step_number: stepNumber,
    step_action: pendingStep.action,
    step_status: pendingStep.status,
    completed_steps: top.completed,
    total_steps: top.total,
    sub_plan_proposal: subPlanProposal || undefined,
    sub_plan_approved: subPlanProposal ? subPlanApproved : undefined,
  };
}

export function resetStatusCache() {
  STATUS_CACHE = null;
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
