import { readFile, moveFile, writeFile, fileExists, getRepoRoot } from '../lib/paths';
import { parseFrontmatter, formatYamlList, setFrontmatterField, extractFrontmatterField } from '../lib/frontmatter';
import { logTransition } from '../lib/audit';
import { hasPendingSteps, updateParentDeliverable, replaceStepStatus, splitTableRow } from '../lib/steps';
import { getAIEngine } from '../../dispatch/ai';

interface ProposalSection {
  name: string;
  content: string;
}

function parseProposalSections(body: string): ProposalSection[] {
  const sections: ProposalSection[] = [];
  const lines = body.split('\n');
  let currentName = 'Overview';
  let currentLines: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)/);
    if (headerMatch) {
      if (currentLines.length > 0 || sections.length === 0) {
        sections.push({ name: currentName, content: currentLines.join('\n').trim() });
      }
      currentName = headerMatch[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length > 0 || sections.length === 0) {
    sections.push({ name: currentName, content: currentLines.join('\n').trim() });
  }

  return sections;
}

function extractNumberedSteps(content: string): string[] {
  const steps: string[] = [];
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*\d+\.\s+(.+)/);
    if (m) steps.push(m[1].trim());
  }
  return steps;
}

function buildPlanFromSections(
  title: string,
  fields: string[],
  sections: ProposalSection[],
  today: string,
): string {
  const KNOWN = ['testing plan', 'risk assessment', 'rollback procedures', 'implementation steps', 'proposed solution', 'proposed approach'];

  const mapped: Record<string, ProposalSection> = {};
  const context: ProposalSection[] = [];

  for (const s of sections) {
    const key = s.name.toLowerCase();
    if (KNOWN.includes(key)) {
      mapped[key] = s;
    } else {
      context.push(s);
    }
  }

  // Build implementation steps from Proposed Solution / Proposed Approach
  let stepsBody = '';
  if (mapped['implementation steps']) {
    stepsBody = mapped['implementation steps'].content;
  } else if (mapped['proposed solution']) {
    const items = extractNumberedSteps(mapped['proposed solution'].content);
    if (items.length > 0) {
      stepsBody = items.map((item, i) => `| ${i + 1} | ${item} | | ⏳ Pending |`).join('\n');
    }
  } else if (mapped['proposed approach']) {
    const items = extractNumberedSteps(mapped['proposed approach'].content);
    if (items.length > 0) {
      stepsBody = items.map((item, i) => `| ${i + 1} | ${item} | | ⏳ Pending |`).join('\n');
    }
  }
  if (!stepsBody) {
    stepsBody = '| Step | Action | Details | Status |\n| --- | --- | --- | --- |\n| 1 | | | ⏳ Pending |';
  }

  // Build context sections (everything that isn't a mapped section)
  let contextBody = '';
  for (const s of context) {
    if (s.content) {
      contextBody += `\n### ${s.name}\n\n${s.content}\n`;
    }
  }

  const testingBody = mapped['testing plan'] ? mapped['testing plan'].content : '_Testing plan TBD_';
  const rollbackBody = mapped['rollback procedures'] ? mapped['rollback procedures'].content : '_Rollback procedures TBD_';
  let riskBody = '';
  if (mapped['risk assessment']) {
    riskBody = mapped['risk assessment'].content;
  }

  return `---
${fields.join('\n')}
---

# ${title}

## Overview

_Plan generated from approved proposal: ${title}_
${contextBody}

## Implementation Steps

${stepsBody}

## Testing Plan

${testingBody}

## Rollback Procedures

${rollbackBody}

## Risk Assessment

${riskBody || '_Risk assessment TBD_'}

## Document History

| Date | Change | Author |
| --- | --- | --- |
| ${today} | Created from approved proposal | NetYeti |
`;
}

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
  fields.push(`tests_human_reviewed: false`);
  fields.push(`_path: plans/${safe}`);

  // Extract proposal body (content after frontmatter)
  const bodyMatch = text.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  const proposalBody = bodyMatch ? bodyMatch[1].trim() : '';
  const sections = parseProposalSections(proposalBody);

  const planContent = buildPlanFromSections(title, fields, sections, today);

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

  // Detect phase plan close-out — add reminder
  let phaseMsg = '';
  const phaseMatch = safe.match(/^phase-(\d+)-/);
  if (phaseMatch) {
    const phaseNum = phaseMatch[1];
    phaseMsg = `\n\n⚠  PHASE ${phaseNum} CLOSE-OUT REQUIRED:\n   Run: npm run phase:close -- ${phaseNum}\n   This bumps the version, commits, tags, and pushes the release.`;
  }

  return `✅ Plan '${safe}' completed and moved to plans/completed/. Docs generated at docs/${docSlug}.${parentMsg}${phaseMsg}`;
}

/**
 * Approve a sub-plan proposal from a parent plan.
 * Chains: guard → critique → improve → approve → create plan → update parent deliverable.
 */
export async function approveSubPlan(parentPlanName: string, proposalName: string): Promise<string> {
  const pSafe = parentPlanName.endsWith('.md') ? parentPlanName : `${parentPlanName}.md`;
  const propSafe = proposalName.endsWith('.md') ? proposalName : `${proposalName}.md`;

  // 1. Guard: parent plan must be approved or in-progress
  let parentText: string;
  try {
    parentText = readFile(`plans/${pSafe}`);
  } catch {
    return `ERROR: Parent plan '${parentPlanName}' not found in plans/.`;
  }
  const parentStatus = extractFrontmatterField(parentText, 'status');
  if (parentStatus !== 'approved' && parentStatus !== 'in-progress') {
    return `ERROR: Parent plan '${parentPlanName}' has status=${parentStatus}. Must be approved or in-progress.`;
  }

  // 2. Load proposal
  let propText: string;
  try {
    propText = readFile(`proposals/${propSafe}`);
  } catch {
    return `ERROR: Proposal '${proposalName}' not found in proposals/.`;
  }
  const propFm = parseFrontmatter(propText);
  const propTitle = propFm['title'] || propSafe.replace(/\.md$/, '');

  // 3. Extract proposal body (skip frontmatter)
  const bodyMatch = propText.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  const proposalBody = bodyMatch ? bodyMatch[1] : '';

  // 4. Run critique
  const vaultRoot = getRepoRoot();
  const engine = getAIEngine(vaultRoot);
  let critique = '';
  try {
    critique = await engine.critiqueDocument(propText);
  } catch (err: any) {
    critique = `*(Critique failed: ${err.message})*`;
  }

  // 5. Run improve
  let improvedBody = '';
  try {
    improvedBody = await engine.fillProposal(propFm as Record<string, any>, proposalBody);
  } catch (err: any) {
    improvedBody = proposalBody + `\n\n*(AI fill-in failed: ${err.message})*`;
  }

  // 6. Write improved body back
  const frontmatterEnd = propText.indexOf('---', 1);
  const newPropText = propText.slice(0, frontmatterEnd + 3) + '\n' + improvedBody;
  writeFile(`proposals/${propSafe}`, newPropText);

  // 7. Set approved: true + assigned_to (inherit from parent plan)
  const parentAssignedTo = extractFrontmatterField(parentText, 'assigned_to') || 'netyeti';
  const today = new Date().toISOString().split('T')[0];
  let updatedPropText = readFile(`proposals/${propSafe}`);
  updatedPropText = setFrontmatterField(updatedPropText, 'approved', true);
  updatedPropText = setFrontmatterField(updatedPropText, 'approved_date', today);
  updatedPropText = setFrontmatterField(updatedPropText, 'assigned_to', parentAssignedTo);
  updatedPropText = setFrontmatterField(updatedPropText, 'approved_by', 'agent');
  writeFile(`proposals/${propSafe}`, updatedPropText);

  // 8. Call transitionToApproved — moves to proposals/approved/ and creates plan
  const transResult = await transitionToApproved(propSafe.replace(/\.md$/, ''));

  // 9. Update parent deliverable row — look for a wikilink to this proposal
  const parentLines = parentText.split('\n');
  let inDeliverables = false;
  let deliverableUpdated = false;
  for (let i = 0; i < parentLines.length; i++) {
    const line = parentLines[i];
    if (/^##\s/.test(line)) {
      inDeliverables = /^##\s+Deliverables\b/i.test(line);
      continue;
    }
    if (!inDeliverables || !line.startsWith('|')) continue;
    // Look for wikilink to this proposal, e.g. [[proposals/sub-plan-foo]] or [[proposals/sub-plan-foo.md]]
    const baseName = propSafe.replace(/\.md$/, '');
    const linkPattern = `[[proposals/${baseName}]]`;
    const linkPatternMd = `[[proposals/${baseName}.md]]`;
    if (line.includes(linkPattern) || line.includes(linkPatternMd)) {
      const parts = splitTableRow(line);
      const lastIdx = parts.length - 2; // last cell before final |
      parts[lastIdx] = ' 🚧 In Progress ';
      parentLines[i] = parts.join('|');
      deliverableUpdated = true;
      break;
    }
  }
  let deliverableMsg = '';
  if (deliverableUpdated) {
    writeFile(`plans/${pSafe}`, parentLines.join('\n'));
    deliverableMsg = `\nParent deliverable in ${pSafe} updated to 🚧 In Progress.`;
  }

  logTransition('SUB_PLAN_APPROVED', `${propSafe} → approved via ${pSafe}`);

  return `✅ Sub-plan '${propSafe}' approved from parent '${pSafe}'.

Critique: ${critique.slice(0, 500)}...

${transResult}${deliverableMsg}`;
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
