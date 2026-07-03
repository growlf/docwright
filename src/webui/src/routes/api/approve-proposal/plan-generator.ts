/**
 * Atomic plan section generator.
 *
 * Replaces the naive template parser with sequential OpenCode API calls,
 * each scoped to a specific ai_category. Demonstrates the AI Task Category
 * Taxonomy in practice: the right cognitive task goes to the right call,
 * not one monolithic prompt.
 *
 * Call sequence:
 *   1. classification — parse proposal structure, identify phases
 *   2. generation     — write Implementation Steps table
 *   3. generation     — write Testing Plan
 *   4. generation     — write Rollback Procedures
 *   5. reasoning      — write Risk Assessment
 *
 * Falls back to null on any failure — the caller uses the old template parser.
 */

interface PlanSections {
  steps: string;
  testingPlan: string;
  rollback: string;
  riskAssessment: string;
}

/**
 * Create a session, send one prompt, poll until the assistant responds.
 *
 * The OpenCode message POST returns an SSE stream — we can't parse it as JSON.
 * Instead we POST the message, then poll GET /session/{id}/message until the
 * assistant's response appears (identified by having more messages than we sent).
 */
async function callOpenCode(
  opencodeUrl: string,
  dirParam: string,
  prompt: string,
  model?: string,
): Promise<string> {
  const sessionBody = model ? (() => {
    const slash = model.indexOf('/');
    return slash > 0
      ? { providerID: model.slice(0, slash), modelID: model.slice(slash + 1) }
      : {};
  })() : {};

  // Create session
  const sessRes = await fetch(`${opencodeUrl}/session?${dirParam}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sessionBody),
  });
  if (!sessRes.ok) throw new Error(`Session create failed: ${sessRes.status}`);
  const sess = await sessRes.json();
  const sessionId: string = sess?.id ?? sess?.sessionID;
  if (!sessionId) throw new Error('no session id');

  // Send message (POST returns SSE stream — we don't read the body)
  const msgRes = await fetch(`${opencodeUrl}/session/${sessionId}/message?${dirParam}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parts: [{ type: 'text', text: prompt }] }),
  });
  if (!msgRes.ok) throw new Error(`Message send failed: ${msgRes.status}`);
  // Consume and discard the streaming response body so the connection closes
  await msgRes.body?.cancel();

  // Poll GET /session/{id}/message until the assistant replies (up to 120s)
  const POLL_INTERVAL_MS = 3000;
  const MAX_POLLS = 40;
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const histRes = await fetch(`${opencodeUrl}/session/${sessionId}/message?${dirParam}`);
    if (!histRes.ok) continue;
    const messages: Array<{ role?: string; parts?: Array<{ type: string; text?: string }> }> =
      await histRes.json();

    // Look for a message with assistant text that isn't just our prompt
    for (const msg of messages) {
      if (!msg.parts) continue;
      const texts = msg.parts
        .filter(p => p.type === 'text' && p.text && p.text.length > 10)
        .map(p => p.text ?? '');
      // Skip messages that are just our prompt
      if (texts.some(t => t !== prompt && t.length > 20)) {
        const combined = texts.filter(t => t !== prompt).join('');
        if (combined.length > 10) return combined;
      }
    }
  }
  throw new Error(`no assistant response after ${MAX_POLLS} polls`);
}

/** ai_category: classification — extract structure from proposal */
async function extractProposalStructure(
  proposalBody: string,
  opencodeUrl: string,
  dirParam: string,
  model?: string,
): Promise<{ phases: string[]; summary: string }> {
  const prompt = `You are analyzing a governance proposal document.

Extract the following from the proposal body below:
1. Implementation phases or steps (numbered list). Look for sections named "Implementation Steps", "Notes for Plan Generation", "Suggested plan phases", or numbered items under "Proposed Solution".
2. A 2-sentence summary of what this proposal delivers.

Return ONLY a JSON object in this exact format (no markdown, no explanation):
{"phases":["Phase 1 description","Phase 2 description"],"summary":"Two sentence summary."}

PROPOSAL BODY:
${proposalBody.slice(0, 6000)}`;

  const raw = await callOpenCode(opencodeUrl, dirParam, prompt, model);
  const jsonMatch = raw.match(/\{[\s\S]*"phases"[\s\S]*\}/);
  if (!jsonMatch) throw new Error('no JSON in classification response');
  return JSON.parse(jsonMatch[0]);
}

/** ai_category: generation — write Implementation Steps table */
async function generateSteps(
  phases: string[],
  opencodeUrl: string,
  dirParam: string,
  model?: string,
): Promise<string> {
  const prompt = `Write a DocWright Implementation Steps markdown table for these phases.

Phases:
${phases.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Rules:
- Use exactly this table format with 4 columns: | Step | Action | Details | Status |
- Action: short title (5 words max)
- Details: one sentence describing what to implement
- Status: ⏳ Pending for all rows
- Return ONLY the markdown table, no other text

Example row:
| 1 | Extend AiCategory schema | Add 'coding' and 'agentic' to the TypeScript union type in schema.ts | ⏳ Pending |`;

  return callOpenCode(opencodeUrl, dirParam, prompt, model);
}

/** ai_category: generation — write Testing Plan section */
async function generateTestingPlan(
  summary: string,
  phases: string[],
  opencodeUrl: string,
  dirParam: string,
  model?: string,
): Promise<string> {
  const prompt = `Write a ## Testing Plan section for a DocWright implementation plan.

Proposal summary: ${summary}

Implementation steps:
${phases.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Rules:
- Use exactly three subsections: ### Step Verification, ### Integration & Regression, ### Gate Criteria
- Step Verification: one - [ ] checkbox per step with a specific, verifiable test condition
- Integration & Regression: 3-5 checkboxes for cross-cutting concerns (npm test, typecheck, existing functionality)
- Gate Criteria: 3-5 checkboxes for completion conditions
- Return ONLY the markdown (starting with ### Step Verification), no preamble`;

  return callOpenCode(opencodeUrl, dirParam, prompt, model);
}

/** ai_category: generation — write Rollback Procedures */
async function generateRollback(
  phases: string[],
  opencodeUrl: string,
  dirParam: string,
  model?: string,
): Promise<string> {
  const prompt = `Write a ## Rollback Procedures section as a markdown table.

Implementation steps:
${phases.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Rules:
- Table columns: | Scenario | Rollback |
- One row per step: describe a failure scenario and how to revert
- Keep rollback descriptions concise and actionable
- Return ONLY the markdown table, no preamble`;

  return callOpenCode(opencodeUrl, dirParam, prompt, model);
}

/** ai_category: reasoning — write Risk Assessment */
async function generateRiskAssessment(
  summary: string,
  phases: string[],
  opencodeUrl: string,
  dirParam: string,
  model?: string,
): Promise<string> {
  const prompt = `Write a ## Risk Assessment section as a markdown table for this implementation.

Summary: ${summary}

Steps: ${phases.slice(0, 6).join('; ')}

Rules:
- Table columns: | Risk | Likelihood | Impact | Mitigation |
- Likelihood: Low / Medium / High
- Impact: Low / Medium / High
- 4-6 realistic risks with concrete mitigations
- Return ONLY the markdown table, no preamble`;

  return callOpenCode(opencodeUrl, dirParam, prompt, model);
}

/**
 * Generate plan sections atomically from a proposal body.
 * Returns null on any failure — caller falls back to template parser.
 */
export async function generatePlanSections(
  proposalBody: string,
  opencodeUrl: string,
  repoRoot: string,
  model?: string,
): Promise<PlanSections | null> {
  if (!opencodeUrl) return null;

  const dirParam = `directory=${encodeURIComponent(repoRoot)}`;

  try {
    // 1. classification — parse structure
    const { phases, summary } = await extractProposalStructure(
      proposalBody, opencodeUrl, dirParam, model,
    );
    if (!phases.length) return null;

    // 2-5. generation + reasoning — write each section
    const [steps, testingPlan, rollback, riskAssessment] = await Promise.all([
      generateSteps(phases, opencodeUrl, dirParam, model),
      generateTestingPlan(summary, phases, opencodeUrl, dirParam, model),
      generateRollback(phases, opencodeUrl, dirParam, model),
      generateRiskAssessment(summary, phases, opencodeUrl, dirParam, model),
    ]);

    return { steps, testingPlan, rollback, riskAssessment };
  } catch {
    return null; // fall back to template
  }
}

// ── Pure plan assembler (extracted for testability — see #108) ────────────────
export interface AssemblePlanInput {
  title: string;
  author: string;
  created: string;          // YYYY-MM-DD
  tags: string[];           // inherited from the proposal, emitted as a YAML list
  priority: string;         // inherited from the proposal
  proposalSource: string;   // proposals/approved/<slug>.md
  assigned: string;
  summary: string;          // the proposal's own Summary section (bounded — NOT the whole body)
  steps: string;
  testingPlan: string;
  rollback: string;
  riskAssessment: string;
  phase?: string;
  related_to?: string[];
}

/**
 * Build the plan markdown from an approved proposal. Pure + deterministic.
 *
 * Guarantees the #108 fixes: the Overview is a summary + link (never a dump of the
 * proposal body), status is `draft` (not `approved`), priority/tags are inherited from
 * the proposal (tags as a YAML list), and tests_defined stays false.
 */
export function assemblePlan(i: AssemblePlanInput): string {
  const tagsYaml = i.tags.length
    ? 'tags:\n' + i.tags.map(t => `  - ${t}`).join('\n')
    : 'tags: []';
  const phaseLine = i.phase ? `\nphase: ${i.phase}` : '';
  const relatedLine = i.related_to && i.related_to.length
    ? '\nrelated_to:\n' + i.related_to.map(r => `  - ${r}`).join('\n')
    : '\nrelated_to: []';
  return `---
title: ${i.title}
status: draft
author: ${i.author}
created: ${i.created}
${tagsYaml}
proposal_source: ${i.proposalSource}
priority: ${i.priority}
automated: guided
assigned_to: ${i.assigned}
tests_defined: false
tests_human_reviewed: false${phaseLine}${relatedLine}
---

# ${i.title}

## Overview

Delivers the approved proposal [[${i.proposalSource}]] — see it for the full *what & why*.
Held at \`status: draft\`; fill in the implementation steps below before moving to \`in-progress\`.

${i.summary}

## Implementation Steps

${i.steps}

## Testing Plan

${i.testingPlan}

## Rollback Procedures

${i.rollback}

## Risk Assessment

${i.riskAssessment}

## Document History

| Date | Change | Author |
|------|--------|--------|
| ${i.created} | Created from approved proposal | ${i.author} |
`;
}
