import { readFile, writeFile, fileExists, getRepoRoot } from '../lib/paths';
import { logTransition } from '../lib/audit';
import { spawnSync, execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { captureSuggest, captureConfirm, captureCreate } from '../../dispatch/capture';

function run(cmd: string, args: string[]): { ok: boolean; stdout: string; stderr: string } {
  try {
    const result = spawnSync(cmd, args, {
      cwd: getRepoRoot(),
      encoding: 'utf8',
      timeout: 30000,
    });
    return {
      ok: result.status === 0,
      stdout: (result.stdout || '').trim(),
      stderr: (result.stderr || '').trim(),
    };
  } catch (e: any) {
    return { ok: false, stdout: '', stderr: e.message };
  }
}

function runPipe(cmd: string): { ok: boolean; stdout: string; stderr: string } {
  try {
    const result = execSync(cmd, {
      cwd: getRepoRoot(),
      encoding: 'utf8',
      timeout: 60000,
    });
    return { ok: true, stdout: (result || '').trim(), stderr: '' };
  } catch (e: any) {
    return {
      ok: false,
      stdout: (e.stdout || '').trim(),
      stderr: (e.stderr || e.message || '').trim(),
    };
  }
}

function getRepoSlug(): string {
  const r = run('git', ['remote', 'get-url', 'origin']);
  if (!r.ok) return '';
  const url = r.stdout;
  const sshMatch = url.match(/^git@[^:]+:(.+?)(?:\.git)?$/);
  if (sshMatch) return sshMatch[1];
  const httpsMatch = url.match(/^https?:\/\/[^/]+\/(.+?)(?:\.git)?$/);
  if (httpsMatch) return httpsMatch[1];
  return '';
}

function slugify(text: string): string {
  const s = text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*(.+?)\*/g, '$1');
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function ghIssueView(num: number): Record<string, any> | null {
  const r = run('gh', [
    'issue', 'view', String(num),
    '--json', 'state,title,labels,body,url',
  ]);
  if (!r.ok) return null;
  try { return JSON.parse(r.stdout); } catch { return null; }
}

function ghPRList(num: number): any[] {
  const r = run('gh', ['pr', 'list', '--state', 'open', '--json', 'number,title,headRefName,url']);
  if (!r.ok) return [];
  try {
    const all: any[] = JSON.parse(r.stdout);
    return all.filter((pr: any) => String(pr.number).includes(String(num)) || (pr.title || '').includes(`#${num}`));
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// 0. capture_bug_report — three sub-actions wrapping the bridge
// ---------------------------------------------------------------------------

export async function captureBugReport(action: string, args: Record<string, any>): Promise<string> {
  const repoRoot = getRepoRoot();

  switch (action) {
    case 'suggest': {
      const title = String(args.title || '');
      if (!title) return 'ERROR: title is required';
      const category = args.category === 'feature' ? 'feature' : 'bug';
      const suggestions = await captureSuggest(repoRoot, title, category);
      return JSON.stringify({ ok: true, suggestions });
    }

    case 'confirm': {
      // Local canonical path (issues/foo.md) or a GitHub ref (gh:123) — the facade routes.
      const ref = String(args.canonical_path || args.path || args.ref || '');
      if (!ref) return 'ERROR: canonical_path is required';
      const report = {
        title: String(args.title || ''),
        description: String(args.description || ''),
        reporter: String(args.reporter || process.env.OPCODE_USER_NAME || 'agent'),
        priority: args.priority || 'medium',
        system_info: String(args.system_info || ''),
      };
      if (!report.title || !report.description) return 'ERROR: title and description are required';
      const result = await captureConfirm(repoRoot, ref, report);
      return JSON.stringify({ ok: true, ...result });
    }

    case 'create': {
      const report = {
        title: String(args.title || ''),
        description: String(args.description || ''),
        reporter: String(args.reporter || process.env.OPCODE_USER_NAME || 'agent'),
        priority: args.priority || 'medium',
        system_info: String(args.system_info || ''),
        category: args.category === 'feature' ? 'feature' as const : 'bug' as const,
        channel: String(args.channel || 'dev'),
      };
      if (!report.title || !report.description) return 'ERROR: title and description are required';
      const related = Array.isArray(args.related) ? args.related : [];
      const result = await captureCreate(repoRoot, report, related);
      return JSON.stringify({ ok: true, ...result });
    }

    default:
      return `ERROR: unknown action '${action}'. Use suggest, confirm, or create.`;
  }
}

// ---------------------------------------------------------------------------
// 1. issue_preflight
// ---------------------------------------------------------------------------

export async function issuePreflight(num: number): Promise<string> {
  if (!num || num < 1) return 'ERROR: invalid issue number';

  const issue = ghIssueView(num);
  if (!issue) return `ERROR: issue #${num} not found or gh CLI unavailable`;

  if (issue.state !== 'OPEN') {
    return JSON.stringify({
      ready: false,
      issue: { state: issue.state, title: issue.title },
      warnings: [`Issue #${num} is ${issue.state} — not actionable`],
    });
  }

  // Check existing branches
  const branchResult = run('git', ['branch', '-a']);
  const existingBranches = branchResult.ok
    ? branchResult.stdout.split('\n')
        .map(b => b.trim().replace(/^\*?\s*/, '').replace(/^remotes\/origin\//, ''))
        .filter(b => b.includes(String(num)))
    : [];

  // Check existing PRs
  const existingPRs = ghPRList(num);

  // Check issues/ folder for a matching file
  let issueFile: string | null = null;
  let issueFileHasLink = false;
  const issuesDir = path.join(getRepoRoot(), 'issues');
  if (fs.existsSync(issuesDir)) {
    for (const f of fs.readdirSync(issuesDir)) {
      if (!f.endsWith('.md') || f === 'README.md') continue;
      const raw = fs.readFileSync(path.join(issuesDir, f), 'utf8');
      const m = raw.match(/^github_issue:\s*(\d+)/m);
      if (m && m[1] === String(num)) {
        issueFile = f;
        issueFileHasLink = true;
        break;
      }
    }
    // If no direct link found, check titles
    if (!issueFile) {
      const slug = slugify(issue.title);
      const candidate = `${slug}.md`;
      if (fs.existsSync(path.join(issuesDir, candidate))) {
        issueFile = candidate;
      }
    }
  }

  // Check plans/proposals
  const plansDir = path.join(getRepoRoot(), 'plans');
  let planMatches: string[] = [];
  if (fs.existsSync(plansDir)) {
    planMatches = fs.readdirSync(plansDir)
      .filter(f => f.endsWith('.md') && (f.includes(String(num)) || (issueFile && f.includes(issueFile.replace('.md', '')))))
      .map(f => `plans/${f}`);
  }

  const warnings: string[] = [];
  if (existingBranches.length > 0) warnings.push(`Existing branches referencing #${num}: ${existingBranches.join(', ')}`);
  if (existingPRs.length > 0) warnings.push(`Existing open PRs referencing #${num}: ${existingPRs.map((p: any) => `#${p.number}`).join(', ')}`);
  if (issueFile && !issueFileHasLink) warnings.push(`issues/${issueFile} exists but missing github_issue: ${num} frontmatter`);

  return JSON.stringify({
    ready: existingBranches.length === 0 && existingPRs.length === 0,
    issue: { state: issue.state, title: issue.title, labels: issue.labels, url: issue.url },
    existingBranches,
    existingPRs: existingPRs.map((p: any) => ({ number: p.number, title: p.title, url: p.url })),
    issueFile: issueFile ? `issues/${issueFile}` : null,
    issueFileHasLink,
    planMatches,
    warnings,
  });
}

// ---------------------------------------------------------------------------
// 2. sync_issue_file
// ---------------------------------------------------------------------------

export async function syncIssueFile(num: number, force?: boolean): Promise<string> {
  if (!num || num < 1) return 'ERROR: invalid issue number';

  const issue = ghIssueView(num);
  if (!issue) return `ERROR: issue #${num} not found or gh CLI unavailable`;

  const slug = slugify(issue.title);
  const fileName = `${slug}.md`;
  const relPath = `issues/${fileName}`;

  // Check if already exists and has correct github_issue
  if (fileExists(relPath)) {
    const existing = readFile(relPath);
    const hasLink = new RegExp(`^github_issue:\\s*${num}$`, 'm').test(existing);
    if (hasLink && !force) {
      return JSON.stringify({
        created: false,
        updated: false,
        path: relPath,
        message: `issues/${fileName} already exists with github_issue: ${num}`,
      });
    }
    // Update existing file
    const labels = Array.isArray(issue.labels) ? issue.labels.map((l: any) => `  - ${l.name}`).join('\n') : '';
    const updated = existing.replace(/^github_issue:.*$/m, `github_issue: ${num}`);
    writeFile(relPath, updated);
    logTransition('ISSUE_FILE_SYNC', `Updated issues/${fileName} with github_issue: ${num}`);
    return JSON.stringify({
      created: false,
      updated: true,
      path: relPath,
    });
  }

  // Create new file
  const labelNames = Array.isArray(issue.labels) ? issue.labels.filter((l: any) => l.name !== 'bug' && l.name !== 'governance' && l.name !== 'priority:high' && l.name !== 'priority:medium') : [];
  const effectiveLabels = labelNames.map((l: any) => `  - ${l.name}`).join('\n');

  const body = issue.body || '';
  const bodySnippet = body.length > 2000 ? body.slice(0, 2000) + '\n\n*(truncated from full GH issue)*' : body;

  const frontmatter = `---
title: "${issue.title.replace(/"/g, '\\"')}"
status: new
github_issue: ${num}
category: ${Array.isArray(issue.labels) && issue.labels.some((l: any) => l.name === 'bug') ? 'bug' : 'feature'}
priority: ${Array.isArray(issue.labels) && issue.labels.some((l: any) => l.name.startsWith('priority:')) ? 'high' : 'medium'}
tags:
  - github-issue
  - issue-workflow${effectiveLabels ? `\n${effectiveLabels}` : ''}
created: ${new Date().toISOString().slice(0, 10)}
created_by: "${process.env.OPCODE_USER_NAME || 'NetYeti'}@${process.env.HOSTNAME || 'host'}"
assigned_to: ""
---

${bodySnippet}
`;

  writeFile(relPath, frontmatter);
  logTransition('ISSUE_FILE_CREATED', `Created issues/${fileName} from GH #${num}`);
  return JSON.stringify({
    created: true,
    updated: false,
    path: relPath,
  });
}

// ---------------------------------------------------------------------------
// 3. start_issue_branch
// ---------------------------------------------------------------------------

export async function startIssueBranch(num: number, type: string): Promise<string> {
  if (!num || num < 1) return 'ERROR: invalid issue number';
  const validTypes = ['fix', 'feat', 'docs', 'refactor', 'chore'];
  if (!validTypes.includes(type)) {
    return `ERROR: type must be one of: ${validTypes.join(', ')}`;
  }

  const issue = ghIssueView(num);
  if (!issue) return `ERROR: issue #${num} not found or gh CLI unavailable`;

  // Ensure on latest main
  const fetch = run('git', ['fetch', 'origin', 'main']);
  if (!fetch.ok) return `ERROR: failed to fetch origin/main: ${fetch.stderr}`;

  const slug = slugify(issue.title);
  const branchName = `${type}/${num}-${slug}`;

  // Check if branch already exists
  const branchCheck = run('git', ['branch', '-a']);
  if (branchCheck.ok && branchCheck.stdout.split('\n').some(b => b.trim().replace(/^\*?\s*/, '').replace(/^remotes\/origin\//, '') === branchName)) {
    return JSON.stringify({
      created: false,
      branch: branchName,
      message: `Branch ${branchName} already exists — checkout and use it`,
    });
  }

  const co = run('git', ['checkout', '-b', branchName, 'origin/main']);
  if (!co.ok) return `ERROR: failed to create branch: ${co.stderr}`;

  logTransition('BRANCH_CREATED', `Created branch ${branchName} for issue #${num}`);
  return JSON.stringify({
    created: true,
    branch: branchName,
  });
}

// ---------------------------------------------------------------------------
// 4. complete_issue_branch
// ---------------------------------------------------------------------------

export async function completeIssueBranch(num: number, options?: {
  merge?: boolean;
  skipTests?: boolean;
}): Promise<string> {
  if (!num || num < 1) return 'ERROR: invalid issue number';

  const { merge: shouldMerge = false, skipTests = false } = options || {};

  // Determine current branch
  const branchResult = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (!branchResult.ok) return 'ERROR: not in a git repository';
  const branch = branchResult.stdout;
  if (branch === 'main') return 'ERROR: currently on main — checkout the feature branch first';

  // Run tests unless skipped
  const testResults: Record<string, { ok: boolean; output: string }> = {};
  if (!skipTests) {
    const suites = ['typecheck', 'test:webui', 'test:dispatch'];
    for (const suite of suites) {
      const r = runPipe(`npm run ${suite} 2>&1 | tail -3`);
      testResults[suite] = { ok: r.ok, output: r.ok ? r.stdout : r.stderr || r.stdout };
      if (!r.ok) {
        return JSON.stringify({
          pushed: false,
          pr: null,
          merged: false,
          testResults,
          error: `npm run ${suite} failed — fix before creating PR`,
        });
      }
    }
  }

  // Push branch
  const push = run('git', ['push', '-u', 'origin', branch]);
  if (!push.ok) {
    return JSON.stringify({
      pushed: false,
      pr: null,
      merged: false,
      testResults,
      error: `git push failed: ${push.stderr}`,
    });
  }

  // Create PR
  const issue = ghIssueView(num);
  const prBody = [
    `Closes #${num}`,
    '',
    '## Changes',
    '',
    '_(auto-generated — expand with implementation details)_',
    '',
    '## Testing',
    !skipTests ? Object.entries(testResults).map(([suite, r]) => `- \`npm run ${suite}\`: ${r.ok ? 'passed' : 'failed'}`).join('\n') : '- _(manual verification)_',
  ].join('\n');

  const prResult = run('gh', [
    'pr', 'create',
    '--base', 'main',
    '--head', branch,
    '--title', `fix: issue #${num} — ${issue?.title?.slice(0, 60) || 'fix'} (#${num})`,
    '--body', prBody,
  ]);
  if (!prResult.ok) {
    return JSON.stringify({
      pushed: true,
      pr: null,
      merged: false,
      testResults,
      error: `gh pr create failed: ${prResult.stderr}`,
    });
  }
  const prUrl = prResult.stdout;

  if (!shouldMerge) {
    logTransition('PR_CREATED', `Created PR for #${num}: ${prUrl}`);
    return JSON.stringify({
      pushed: true,
      pr: prUrl,
      merged: false,
      testResults,
    });
  }

  // Merge
  const mergeResult = run('gh', [
    'pr', 'merge', '--squash',
    '--subject', `fix: ${issue?.title?.slice(0, 60) || `issue #${num}`} (#${num})`,
    '--body', `Closes #${num}`,
  ]);
  if (!mergeResult.ok) {
    return JSON.stringify({
      pushed: true,
      pr: prUrl,
      merged: false,
      testResults,
      error: `gh pr merge failed: ${mergeResult.stderr}`,
    });
  }

  // Verify issue closed
  let issueClosed = false;
  const verify = ghIssueView(num);
  if (verify) {
    issueClosed = verify.state === 'CLOSED';
  }

  // Cleanup
  const coMain = run('git', ['checkout', 'main']);
  const fetchMain = run('git', ['fetch', 'origin', 'main']);
  const resetHard = run('git', ['reset', '--hard', 'origin/main']);
  const delBranch = run('git', ['branch', '-D', branch]);

  logTransition('ISSUE_COMPLETED', `Completed #${num}: ${prUrl}`);

  return JSON.stringify({
    pushed: true,
    pr: prUrl,
    merged: true,
    issueClosed,
    cleanup: {
      mainSynced: coMain.ok && fetchMain.ok && resetHard.ok,
      branchDeleted: delBranch.ok,
    },
    testResults,
  });
}
