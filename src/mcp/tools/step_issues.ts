import { readFile, writeFile, getRepoRoot } from '../lib/paths';
import { extractFrontmatterField } from '../lib/frontmatter';
import { splitTableRow } from '../lib/steps';
import { logTransition } from '../lib/audit';
import { spawnSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  // Strip markdown: **bold**, `code`, [link](url), *italic*
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

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*(.+?)\*/g, '$1');
}

function getRepoSlug(): string {
  try {
    const result = spawnSync('git', ['remote', 'get-url', 'origin'], {
      cwd: getRepoRoot(),
      encoding: 'utf8',
    });
    if (result.status !== 0) return '';
    const url = result.stdout.trim();
    // SSH: git@github.com:owner/repo.git
    const sshMatch = url.match(/^git@[^:]+:(.+?)(?:\.git)?$/);
    if (sshMatch) return sshMatch[1];
    // HTTPS: https://github.com/owner/repo.git
    const httpsMatch = url.match(/^https?:\/\/[^/]+\/(.+?)(?:\.git)?$/);
    if (httpsMatch) return httpsMatch[1];
    return '';
  } catch {
    return '';
  }
}

interface StepRowInfo {
  lineIdx: number;
  action: string;
  details: string;
  status: string;
  issue: string;
  branch: string;
  issueColIdx: number;   // raw index in splitTableRow(line)
  branchColIdx: number;
}

function findStepRow(lines: string[], stepNum: number): StepRowInfo | null {
  let inSteps = false;
  let issueRawIdx = -1;
  let branchRawIdx = -1;
  let statusRawIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ## resets section; ### does NOT
    if (/^## /.test(line)) {
      inSteps = /implementation steps/i.test(line);
      issueRawIdx = -1;
      branchRawIdx = -1;
      statusRawIdx = -1;
      continue;
    }

    if (!inSteps) continue;
    if (!line.includes('|')) continue;

    const rawParts = splitTableRow(line);

    // Detect header row: must contain both 'action' and 'status' cells
    const lowerCells = rawParts.map(p => p.trim().toLowerCase());
    if (lowerCells.includes('action') && lowerCells.includes('status')) {
      // Record raw indices for each column we care about
      for (let ci = 0; ci < rawParts.length; ci++) {
        const cell = rawParts[ci].trim().toLowerCase();
        if (cell === 'status')  statusRawIdx  = ci;
        if (cell === 'issue')   issueRawIdx   = ci;
        if (cell === 'branch')  branchRawIdx  = ci;
      }
      continue;
    }

    // Skip separator rows (---|---|...)
    if (/^\|[-| :]+\|/.test(line)) continue;

    // Data rows: rawParts[1] is the Step column (cells[0] is '' before first |)
    if (statusRawIdx < 0) continue;
    if (rawParts[1] === undefined) continue;
    if (rawParts[1].trim() !== String(stepNum)) continue;

    // Found the matching row
    const action  = rawParts[2] !== undefined ? rawParts[2].trim() : '';
    const details = rawParts[3] !== undefined ? rawParts[3].trim() : '';
    const status  = rawParts[statusRawIdx] !== undefined ? rawParts[statusRawIdx].trim() : '';
    const issue   = issueRawIdx >= 0 && rawParts[issueRawIdx] !== undefined
      ? rawParts[issueRawIdx].trim()
      : '—';
    const branch  = branchRawIdx >= 0 && rawParts[branchRawIdx] !== undefined
      ? rawParts[branchRawIdx].trim()
      : '—';

    return {
      lineIdx: i,
      action,
      details,
      status,
      issue,
      branch,
      issueColIdx: issueRawIdx,
      branchColIdx: branchRawIdx,
    };
  }

  return null;
}

function setRowCell(line: string, rawColIdx: number, value: string): string {
  const parts = splitTableRow(line);
  parts[rawColIdx] = ' ' + value + ' ';
  return parts.join('|');
}

// ---------------------------------------------------------------------------
// Exported MCP tool functions
// ---------------------------------------------------------------------------

export async function createStepIssue(
  planPath: string,
  stepNum: number,
  assignee?: string
): Promise<string> {
  let text: string;
  try {
    text = readFile(planPath);
  } catch {
    return `ERROR: Plan file not found: ${planPath}`;
  }

  const lines = text.split('\n');
  const row = findStepRow(lines, stepNum);
  if (!row) {
    return `ERROR: Step ${stepNum} not found in Implementation Steps table in '${planPath}'.`;
  }

  if (row.issueColIdx < 0 || row.branchColIdx < 0) {
    return `ERROR: Issue or Branch column missing from step table — run npm run migrate:plan-steps first.`;
  }

  if (row.issue && row.issue !== '—' && row.issue !== '') {
    return `Step ${stepNum} already has issue ${row.issue}`;
  }

  const planTitle  = extractFrontmatterField(text, 'title') || planPath;
  const phase      = extractFrontmatterField(text, 'phase');
  const priority   = extractFrontmatterField(text, 'priority');

  const plainActionText = stripMarkdown(row.action);
  const issueTitle = `[${planTitle}] Step ${stepNum}: ${plainActionText}`;

  const issueBody = [
    `**Plan:** ${planPath}`,
    `**Step:** ${stepNum}`,
    '',
    '## Details',
    '',
    row.details || '_No details provided._',
    '',
    '## Suggested branch',
    '',
    `\`feat/<issue-number>-${slugify(plainActionText)}\``,
  ].join('\n');

  const labels: string[] = ['plan-step'];
  if (priority) labels.push(`priority-${priority}`);
  if (phase)    labels.push(`phase-${phase}`);

  const repoSlug = getRepoSlug();

  // Create labels (ignore individual errors — label may already exist)
  for (const label of labels) {
    spawnSync('gh', ['label', 'create', label, '--force', '--repo', repoSlug], {
      cwd: getRepoRoot(),
      encoding: 'utf8',
    });
  }

  // Build gh issue create args
  const args = ['issue', 'create', '--title', issueTitle, '--body', issueBody];
  for (const label of labels) {
    args.push('--label', label);
  }
  if (assignee)  args.push('--assignee', assignee);
  if (repoSlug)  args.push('--repo', repoSlug);

  const result = spawnSync('gh', args, { cwd: getRepoRoot(), encoding: 'utf8' });
  if (result.status !== 0) {
    return `ERROR: gh issue create failed: ${result.stderr || result.stdout}`;
  }

  const issueUrl = result.stdout.trim();
  const numMatch = issueUrl.match(/\/issues\/(\d+)$/);
  if (!numMatch) {
    return `ERROR: could not parse issue number from: ${issueUrl}`;
  }
  const issueNumber = parseInt(numMatch[1], 10);

  const branchName = `feat/${issueNumber}-${slugify(plainActionText)}`;

  // Update the plan row in-place
  let updatedLine = setRowCell(lines[row.lineIdx], row.issueColIdx, `#${issueNumber}`);
  updatedLine = setRowCell(updatedLine, row.branchColIdx, `\`${branchName}\``);
  lines[row.lineIdx] = updatedLine;
  writeFile(planPath, lines.join('\n'));

  logTransition(
    'STEP_ISSUE_CREATED',
    `${planPath} step ${stepNum}: #${issueNumber} ${branchName}`
  );

  return [
    `✅ Issue #${issueNumber} created: ${issueUrl}`,
    `   Branch: ${branchName}`,
    `   Plan updated: ${planPath}`,
  ].join('\n');
}

export async function linkStepIssue(
  planPath: string,
  stepNum: number,
  issueNumber: number
): Promise<string> {
  let text: string;
  try {
    text = readFile(planPath);
  } catch {
    return `ERROR: Plan file not found: ${planPath}`;
  }

  const lines = text.split('\n');
  const row = findStepRow(lines, stepNum);
  if (!row) {
    return `ERROR: Step ${stepNum} not found in Implementation Steps table in '${planPath}'.`;
  }

  if (row.issueColIdx < 0 || row.branchColIdx < 0) {
    return `ERROR: Issue or Branch column missing from step table — run npm run migrate:plan-steps first.`;
  }

  if (row.issue && row.issue !== '—' && row.issue !== '') {
    return `Step ${stepNum} already has issue ${row.issue}`;
  }

  const repoSlug = getRepoSlug();

  const ghResult = spawnSync(
    'gh',
    ['issue', 'view', String(issueNumber), '--json', 'title', '--jq', '.title', '--repo', repoSlug],
    { cwd: getRepoRoot(), encoding: 'utf8' }
  );
  if (ghResult.status !== 0) {
    return `ERROR: could not fetch issue #${issueNumber}: ${ghResult.stderr || ghResult.stdout}`;
  }

  const issueTitle = ghResult.stdout.trim();
  const branchName = `feat/${issueNumber}-${slugify(issueTitle)}`;

  // Update the plan row in-place
  let updatedLine = setRowCell(lines[row.lineIdx], row.issueColIdx, `#${issueNumber}`);
  updatedLine = setRowCell(updatedLine, row.branchColIdx, `\`${branchName}\``);
  lines[row.lineIdx] = updatedLine;
  writeFile(planPath, lines.join('\n'));

  logTransition(
    'STEP_ISSUE_LINKED',
    `${planPath} step ${stepNum}: #${issueNumber} ${branchName}`
  );

  return [
    `✅ Issue #${issueNumber} linked to step ${stepNum}`,
    `   Branch: ${branchName}`,
    `   Plan updated: ${planPath}`,
  ].join('\n');
}
