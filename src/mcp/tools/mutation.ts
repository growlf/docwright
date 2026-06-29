import { readFile, writeFile } from '../lib/paths';
import { extractFrontmatterField, setFrontmatterField } from '../lib/frontmatter';
import { logTransition } from '../lib/audit';
import { getHumanIdentity } from '../lib/identity';
import { dispatchTestGen } from '../../dispatch/test-gen';
import {
  updateStepCounts,
  replaceStepStatus,
  hasPendingSteps,
  checkCompletionGate,
  hasTestingPlan,
  hasPlaceholderSteps
} from '../lib/steps';
import { atomRoutingCheck } from './atom-routing';

const STEP_STATUS_MAP: Record<string, string> = {
  'done': '✅ Done', 'complete': '✅ Done', 'completed': '✅ Done',
  '✅': '✅ Done', '✅ done': '✅ Done',
  'pending': '⏳ Pending', 'todo': '⏳ Pending', 'not done': '⏳ Pending',
  '⏳': '⏳ Pending', '⏳ pending': '⏳ Pending',
};

const VALID_PLAN_STATUSES = new Set(['draft', 'approved', 'in-progress', 'completed', 'canceled']);

const RESTRICTED_PLAN_FIELDS: Record<string, string> = {
  'status': 'Use update_plan_status() instead.',
  'gate_status': 'gate_status must be set by a human reviewer.',
  'approved': 'Plans do not use the approved field.',
  'total_steps': 'total_steps is auto-managed by DocWright.',
  'completed_steps': 'completed_steps is auto-managed by DocWright.',
};

function safePlanName(name: string): string {
  return name.endsWith('.md') ? name : `${name}.md`;
}

export async function updateStep(planName: string, stepMatch: string, newStatus: string): Promise<string> {
  const safe = safePlanName(planName);
  let text: string;
  try {
    text = readFile(`plans/${safe}`);
  } catch {
    return `ERROR: Plan '${planName}' not found in plans/.`;
  }

  const normalized = STEP_STATUS_MAP[newStatus.toLowerCase().trim()];
  if (!normalized) {
    return `ERROR: Unknown status '${newStatus}'. Use: done, pending (or ✅ Done, ⏳ Pending).`;
  }

  const { text: newText, found } = replaceStepStatus(text, stepMatch, normalized);
  if (!found) {
    return `ERROR: No step row matching '${stepMatch}' found in '${safe}'.`;
  }

  let final = updateStepCounts(newText);
  final = setFrontmatterField(final, 'tests_defined', false);
  
  writeFile(`plans/${safe}`, final);
  logTransition('STEP_UPDATE', `plan/${safe}: '${stepMatch.slice(0, 50)}' -> ${normalized}`);

  let dispatchMsg = '';
  if (normalized === '✅ Done') {
    const stepAction = extractFrontmatterField(text, 'title') || stepMatch;
    const result = dispatchTestGen(safe, stepMatch, stepAction);

    let planText = readFile(`plans/${safe}`);
    if (result.untestable && result.gateNote) {
      planText = setFrontmatterField(planText, 'gate_note', result.gateNote);
    } else if (result.dispatched && !result.untestable) {
      const humanReviewed = extractFrontmatterField(planText, 'tests_human_reviewed');
      if (String(humanReviewed) === 'true') {
        planText = setFrontmatterField(planText, 'tests_defined', true);
      }
    }
    writeFile(`plans/${safe}`, planText);

    if (result.dispatched) {
      dispatchMsg = `\n${result.message}`;
    }
  }

  return `✅ Step updated in '${safe}': '${stepMatch.slice(0, 50)}' -> ${normalized}.${dispatchMsg}`;
}

export async function updatePlanStatus(planName: string, newStatus: string): Promise<string> {
  const safe = safePlanName(planName);
  if (!VALID_PLAN_STATUSES.has(newStatus)) {
    return `ERROR: Invalid status '${newStatus}'. Valid: ${Array.from(VALID_PLAN_STATUSES).sort().join(', ')}.`;
  }

  let text: string;
  try {
    text = readFile(`plans/${safe}`);
  } catch {
    return `ERROR: Plan '${planName}' not found in plans/.`;
  }

  const current = extractFrontmatterField(text, 'status');

  if (newStatus === 'in-progress' && hasPlaceholderSteps(text)) {
    return `ERROR: Plan '${planName}' has only placeholder steps (empty Action cells). Fill in real steps before moving to in-progress.`;
  }

  if (newStatus === 'completed' && hasPendingSteps(text)) {
    return `ERROR: Plan '${planName}' has ⏳ pending steps. Mark all step rows ✅ Done before completing.`;
  }

  if (newStatus === 'completed' && !hasTestingPlan(text)) {
    return `ERROR: Plan '${planName}' Testing Plan section is TBD or empty. Write a real testing plan before completing.`;
  }

  if (newStatus === 'completed') {
    const gateErr = checkCompletionGate(text, planName);
    if (gateErr) return gateErr;
  }

  let final = setFrontmatterField(text, 'status', newStatus);
  final = updateStepCounts(final);
  
  writeFile(`plans/${safe}`, final);
  logTransition('STATUS_CHANGE', `plan/${safe}: ${current} -> ${newStatus}`);
  await atomRoutingCheck(`plans/${safe}`, final, `plan.${newStatus}`);
  return `✅ Plan '${safe}' status: ${current} -> ${newStatus}.`;
}

export async function appendHistory(planName: string, change: string): Promise<string> {
  const safe = safePlanName(planName);
  let text: string;
  try {
    text = readFile(`plans/${safe}`);
  } catch {
    return `ERROR: Plan '${planName}' not found in plans/.`;
  }

  const date = new Date().toISOString().split('T')[0];
  const author = getHumanIdentity();
  const newRow = `| ${date} | ${change} | ${author} |`;
  
  let newText = text;
  const lines = text.split('\n');
  let inHistory = false;
  let lastTableIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      if (inHistory && lastTableIdx >= 0) break;
      inHistory = line.includes('Document History');
    } else if (inHistory && line.startsWith('|')) {
      lastTableIdx = i;
    }
  }

  if (lastTableIdx >= 0) {
    lines.splice(lastTableIdx + 1, 0, newRow);
    newText = lines.join('\n');
  } else {
    newText = text.trimEnd() + `\n\n## Document History\n\n| Date | Change | Author |\n|------|--------|--------|\n${newRow}\n`;
  }

  writeFile(`plans/${safe}`, newText);
  logTransition('HISTORY_APPEND', `plan/${safe}: ${change.slice(0, 60)}`);
  return `✅ History entry added to '${safe}': ${date} | ${change} | ${author}.`;
}

export async function setPlanField(planName: string, field: string, value: any): Promise<string> {
  if (RESTRICTED_PLAN_FIELDS[field]) {
    return `ERROR: Field '${field}' is restricted. ${RESTRICTED_PLAN_FIELDS[field]}`;
  }

  const safe = safePlanName(planName);
  let text: string;
  try {
    text = readFile(`plans/${safe}`);
  } catch {
    return `ERROR: Plan '${planName}' not found in plans/.`;
  }

  const newText = setFrontmatterField(text, field, value);
  writeFile(`plans/${safe}`, newText);
  logTransition('FIELD_SET', `plan/${safe}: ${field} = ${value}`);
  return `✅ Field '${field}' set to '${value}' in '${safe}'.`;
}

export async function writePlan(planName: string, content: string): Promise<string> {
  const safe = safePlanName(planName);
  
  if (!extractFrontmatterField(content, 'title')) {
    return `ERROR: Content is missing required 'title' frontmatter field.`;
  }

  const newStatus = extractFrontmatterField(content, 'status');
  if (newStatus === 'completed' && hasPendingSteps(content)) {
    return `ERROR: Content sets status: completed but plan has ⏳ pending steps. Clear all pending steps first, then resubmit with all steps ✅ Done, or use update_plan_status() which enforces this check explicitly.`;
  }

  if (newStatus === 'completed') {
    const gateErr = checkCompletionGate(content, safe);
    if (gateErr) return gateErr;
  }

  const gate = extractFrontmatterField(content, 'gate_status');
  if (gate === 'approved' || gate === 'waived') {
    return `ERROR: write_plan cannot set gate_status: ${gate}. Gate sign-off requires human authorization.`;
  }

  let final = updateStepCounts(content);
  const hasTests = hasTestingPlan(final);
  final = setFrontmatterField(final, 'tests_defined', hasTests);

  writeFile(`plans/${safe}`, final);
  logTransition('PLAN_REWRITE', `plan/${safe}: structural rewrite`);
  await atomRoutingCheck(`plans/${safe}`, final, 'plan');

  const warning = hasPlaceholderSteps(final)
    ? '\n⚠ Warning: This plan has placeholder steps (empty Action cells). Fill in real steps before transitioning to in-progress.'
    : '';
  return `✅ Plan '${safe}' rewritten successfully.${warning}`;
}
