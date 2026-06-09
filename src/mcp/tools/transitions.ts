import { readFile, moveFile, writeFile } from '../lib/paths';
import { parseFrontmatter, formatYamlList, setFrontmatterField, extractFrontmatterField } from '../lib/frontmatter';
import { logTransition } from '../lib/audit';
import { hasPendingSteps, updateParentDeliverable } from '../lib/steps';

/**
 * Transition a proposal with approved: true to proposals/approved/ and create a plan.
 */
export async function transitionToApproved(proposalName: string): Promise<string> {
  const safe = proposalName.endsWith('.md') ? proposalName : `${proposalName}.md`;

  let text: string;
  try {
    text = readFile(`proposals/${safe}`);
  } catch {
    return `ERROR: Proposal '${proposalName}' not found in proposals/.`;
  }

  const fm = parseFrontmatter(text);
  const approved = fm['approved'] !== undefined ? String(fm['approved']).toLowerCase() : '';
  const assigned = String(fm['assigned_to'] || '').trim();
  const title = fm['title'] || safe.replace(/\.md$/, '');

  if (approved !== 'true') {
    return `ERROR: Proposal '${proposalName}' has approved=${approved}. Only humans set approved: true.`;
  }
  if (!assigned) {
    return `ERROR: Proposal '${proposalName}' has no assigned_to. Human must set it.`;
  }

  moveFile(`proposals/${safe}`, `proposals/approved/${safe}`);

  let tags = fm['tags'] || [];
  if (typeof tags === 'string') tags = [tags];
  const tagsYaml = formatYamlList(tags);

  const priority = fm['priority'] || 'medium';
  const phase = fm['phase'] || '';
  const parentPlan = fm['parent_plan'] || '';
  const parentDeliverable = fm['parent_deliverable'] || '';
  const complexity = fm['complexity'] || '';

  const fields = [];
  fields.push(`title: ${title}`);
  fields.push(`status: approved`);
  fields.push(`author: ${fm['author'] || 'NetYeti'}`);
  const today = new Date().toISOString().split('T')[0];
  fields.push(`created: ${today}`);
  fields.push(`tags:${tagsYaml}`);
  fields.push(`proposal_source: proposals/approved/${safe}`);
  fields.push(`priority: ${priority}`);
  if (phase) fields.push(`phase: ${phase}`);
  if (complexity) fields.push(`complexity: ${complexity}`);
  fields.push(`automated: guided`);
  fields.push(`assigned_to: ${assigned}`);
  if (parentPlan) fields.push(`parent_plan: ${parentPlan}`);
  if (parentDeliverable) fields.push(`parent_deliverable: ${parentDeliverable}`);
  fields.push(`tests_defined: false`);
  fields.push(`_path: plans/${safe}`);

  const planContent = `---
${fields.join('\n')}
---

# ${title}

## Overview

_Plan generated from approved proposal: ${title}_

<!-- Add high level architecture, approach, or constraints here. -->

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Example step | Details of example step | ⏳ Pending |

## Testing Plan

| Test | Scope | Method |
| --- | --- | --- |
| | | |

## Rollback Procedures

- 

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| | | | |

## Document History

| Date | Change | Author |
| --- | --- | --- |
| ${today} | Created from approved proposal | NetYeti |
`;

  writeFile(`plans/${safe}`, planContent);
  logTransition('APPROVED', `proposals/${safe} → proposals/approved/${safe} + plans/${safe}`);

  return `✅ Proposal '${safe}' approved. Created plans/${safe}.`;
}

/**
 * Transition a plan with status: completed to plans/completed/ and generate doc.
 */
export async function transitionToCompleted(planName: string): Promise<string> {
  const safe = planName.endsWith('.md') ? planName : `${planName}.md`;

  let text: string;
  try {
    text = readFile(`plans/${safe}`);
  } catch {
    return `ERROR: Plan '${planName}' not found in plans/. Has it already been completed?`;
  }

  const status = extractFrontmatterField(text, 'status');
  const title = extractFrontmatterField(text, 'title') || safe.replace(/\.md$/, '');

  if (status !== 'completed') {
    return `ERROR: Plan '${planName}' has status=${status}. Set status: completed first.`;
  }

  if (hasPendingSteps(text)) {
    return `ERROR: Plan '${planName}' has ⏳ pending steps. Mark all step rows ✅ Done before completing.`;
  }

  const parentMsg = updateParentDeliverable(text, safe);
  const completedDate = new Date().toISOString().split('T')[0];

  if (!text.includes('completed_date:')) {
    text = text.replace('status: completed', `status: completed\ncompleted_date: ${completedDate}`);
    writeFile(`plans/${safe}`, text);
  }

  moveFile(`plans/${safe}`, `plans/completed/${safe}`);

  const docSlug = safe;
  const author = extractFrontmatterField(text, 'author') || 'NetYeti';
  const created = extractFrontmatterField(text, 'created') || completedDate;
  const tagsStr = extractFrontmatterField(text, 'tags') || '';
  let tagsBlock = '';
  if (Array.isArray(tagsStr)) {
    tagsBlock = `tags:${formatYamlList(tagsStr)}`;
  } else if (typeof tagsStr === 'string' && tagsStr.trim() !== '') {
    tagsBlock = `tags:\n  - ${tagsStr}`;
  } else {
    tagsBlock = `tags: []`;
  }

  const docContent = `---
title: ${title}
status: completed
completed_date: ${completedDate}
author: ${author}
created: ${created}
${tagsBlock}
---

# ${title}

_Document generated from completed plan: plans/completed/${safe}_

<!-- Document your implementation here -->
`;

  writeFile(`docs/${docSlug}`, docContent);
  logTransition('COMPLETED', `plans/${safe} → plans/completed/${safe} + docs/${docSlug}`);

  return `✅ Plan '${safe}' completed and moved to plans/completed/. Docs generated at docs/${docSlug}.${parentMsg}`;
}

/**
 * Cancel a plan with a reason. Moves to plans/completed/ with canceled status.
 */
export async function transitionToCanceled(planName: string, cancellationReason: string): Promise<string> {
  if (!cancellationReason || !cancellationReason.trim()) {
    return `ERROR: cancellation_reason is required.`;
  }

  const safe = planName.endsWith('.md') ? planName : `${planName}.md`;

  let text: string;
  try {
    text = readFile(`plans/${safe}`);
  } catch {
    return `ERROR: Plan '${planName}' not found in plans/.`;
  }

  const canceledDate = new Date().toISOString().split('T')[0];
  text = setFrontmatterField(text, 'status', 'canceled');

  const lines = text.split('\n');
  const endFm = lines.indexOf('---', 1);
  if (endFm !== -1) {
    const fmBlock = lines.slice(1, endFm).join('\n');
    if (!fmBlock.includes('canceled_date:')) {
      lines.splice(endFm, 0, `canceled_date: ${canceledDate}`, `cancellation_reason: "${cancellationReason.replace(/"/g, '\\"')}"`);
      text = lines.join('\n');
    }
  }

  writeFile(`plans/${safe}`, text);
  moveFile(`plans/${safe}`, `plans/completed/${safe}`);

  logTransition('CANCELED', `plan/${safe} → plans/completed/ (reason: ${cancellationReason})`);

  return `✅ Plan '${safe}' canceled and moved to plans/completed/.`;
}
