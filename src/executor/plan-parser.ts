import fs from 'node:fs';

export type StepStatus = 'pending' | 'done' | 'in-progress' | 'partial' | 'waiting' | 'failed' | 'unknown';

export interface PlanStep {
  stepNumber: number;
  action: string;
  details: string;
  status: StepStatus;
  rawStatus: string;
}

const STATUS_MAP: Record<string, StepStatus> = {
  '⏳': 'pending',
  '✅': 'done',
  '⚠️': 'partial',
  '⏸': 'waiting',
  '❌': 'failed',
};

const STATUS_EMOJI: Record<StepStatus, string> = {
  pending: '⏳',
  done: '✅',
  'in-progress': '⏳',
  partial: '⚠️',
  waiting: '⏸',
  failed: '❌',
  unknown: '?',
};

function detectStatus(cell: string): { status: StepStatus; rawStatus: string } {
  const trimmed = cell.trim();
  for (const [emoji, status] of Object.entries(STATUS_MAP)) {
    if (trimmed.startsWith(emoji)) return { status, rawStatus: trimmed };
  }
  return { status: 'unknown', rawStatus: trimmed };
}

function splitRow(line: string): string[] {
  const placeholder = '\x00PIPE\x00';
  const escaped = line.replace(/\\\|/g, placeholder);
  const parts = escaped.split('|');
  const cells = parts.slice(1, -1).map(c =>
    c.trim().replace(new RegExp(placeholder, 'g'), '|')
  );
  return cells;
}

export function parsePlanSteps(content: string): PlanStep[] {
  const steps: PlanStep[] = [];
  let inSteps = false;
  let pipeLineIndex = 0;

  for (const line of content.split('\n')) {
    if (line.startsWith('## ')) {
      if (inSteps) break;
      inSteps = line.includes('Implementation Steps');
      continue;
    }

    if (!inSteps) continue;
    if (!line.startsWith('|')) continue;

    // Track pipe-line position to skip header + separator
    if (pipeLineIndex === 0) { pipeLineIndex++; continue; } // header
    if (pipeLineIndex === 1 && /^\|[\s-]+\|/.test(line) && line.includes('---')) {
      pipeLineIndex++;
      continue;
    } // separator
    pipeLineIndex++;

    const cells = splitRow(line);
    if (cells.length < 2) continue;

    const stepNumber = parseInt(cells[0], 10);
    const action = cells[1] || '';
    const details = cells.length >= 4
      ? cells.slice(2, cells.length - 1).join(' | ')
      : '';
    const statusCell = cells.length >= 2 ? cells[cells.length - 1] : '';

    const { status, rawStatus } = detectStatus(statusCell);

    steps.push({
      stepNumber: isNaN(stepNumber) ? steps.length + 1 : stepNumber,
      action: action.trim(),
      details: details.trim(),
      status,
      rawStatus,
    });
  }

  return steps;
}

export function markStepStatus(
  content: string,
  stepNumber: number,
  newStatus: StepStatus,
): string {
  const emoji = STATUS_EMOJI[newStatus] || '?';
  const label = newStatus === 'in-progress' ? 'In Progress'
    : newStatus === 'done' ? 'Done'
    : newStatus === 'pending' ? 'Pending'
    : newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
  const replacement = `${emoji} ${label}`;

  const lines = content.split('\n');
  let inSteps = false;
  let pipeLineIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      if (inSteps) break;
      inSteps = line.includes('Implementation Steps');
      continue;
    }
    if (!inSteps) continue;
    if (!line.startsWith('|')) continue;

    // Track pipe-line position
    if (pipeLineIndex === 0) { pipeLineIndex++; continue; }
    if (pipeLineIndex === 1 && /^\|[\s-]+\|/.test(line) && line.includes('---')) {
      pipeLineIndex++;
      continue;
    }
    pipeLineIndex++;

    const cells = splitRow(line);
    if (cells.length < 2) continue;
    const rowStep = parseInt(cells[0], 10);
    if (rowStep !== stepNumber) continue;

    // Replace status in last cell
    const lastPipe = line.lastIndexOf('|');
    const secondLastPipe = line.lastIndexOf('|', lastPipe - 1);
    if (secondLastPipe === -1) continue;
    const before = line.slice(0, secondLastPipe + 1);
    lines[i] = `${before} ${replacement} |`;
    break;
  }

  return lines.join('\n');
}

export function readPlanSteps(filePath: string): PlanStep[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err: any) {
    throw new Error(`Cannot read plan file "${filePath}": ${err.message}`);
  }

  try {
    return parsePlanSteps(content);
  } catch (err: any) {
    throw new Error(`Error parsing plan file "${filePath}": ${err.message}`);
  }
}

export function stepStatusLabel(status: StepStatus): string {
  const emoji = STATUS_EMOJI[status] || '?';
  const label = status === 'in-progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1);
  return `${emoji} ${label}`;
}

export function formatStepForPrompt(step: PlanStep, total: number): string {
  return [
    `Step ${step.stepNumber}/${total}: ${step.action}`,
    step.details ? `Details: ${step.details}` : '',
  ].filter(Boolean).join('\n');
}
