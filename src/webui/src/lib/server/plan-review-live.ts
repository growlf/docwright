/**
 * plan-review-live — server orchestration for the live (streamed) plan review.
 *
 * Live AI Visibility plan (live-ai-visibility-event-relay.md) step 3.2. Behind
 * LIVE_AI_REVIEW: the whole review runs in ONE owned session (2.2). Its prompts
 * (per-step, per-section, overview — the same prompts the legacy parallel path
 * used) are sent SEQUENTIALLY via prompt_async, awaiting each turn's session.idle
 * before the next, so the user watches a single coherent narrative in
 * AgentActivityView over /api/ai/stream. Nothing here renders — the display is
 * driven entirely by the relayed /event bus.
 *
 * All logic is dependency-injected so it is unit-testable without a network or a
 * running OpenCode server.
 */

import path from 'node:path';
import { parseFrontmatter } from '../../../../dispatch/frontmatter';
import { opencodeHeaders } from '../../../../dispatch/opencode-auth';
import { subscribe, unsubscribe, type OpencodeEvent } from './opencode-events';

export interface ReviewPrompt {
  key: string;
  label: string;
  prompt: string;
}

// --- Plan parsing (mirrors the legacy plan-review server) -------------------

function extractSteps(raw: string): Array<{ number: string; action: string; details: string }> {
  const rows: Array<{ number: string; action: string; details: string }> = [];
  let inTable = false;
  let headerPassed = false;
  for (const line of raw.split('\n')) {
    if (line.startsWith('## Implementation Steps')) { inTable = true; continue; }
    if (!inTable) continue;
    if (!line.startsWith('|')) { if (line.trim()) inTable = false; continue; }
    if (!headerPassed) { headerPassed = true; continue; }
    if (line.includes('---')) continue;
    const cols = line.split('|').map((c) => c.trim());
    const data = cols.slice(1, -1);
    if (data.length >= 3) rows.push({ number: data[0], action: data[1], details: data[2] });
  }
  return rows;
}

function extractSection(raw: string, name: string): string {
  const re = new RegExp(`## ${name}\\n([\\s\\S]*?)(?:\\n## |\\n---|$)`);
  const m = raw.match(re);
  return m ? m[1].trim() : '';
}

/**
 * Build the ordered review prompt list from a plan's raw markdown. Matches the
 * legacy server's prompt wording so review quality is unchanged — only the
 * transport (one streamed session vs many blocking calls) differs.
 */
export function buildReviewPrompts(planRaw: string): ReviewPrompt[] {
  const fm = parseFrontmatter(planRaw) as Record<string, any>;
  const steps = extractSteps(planRaw);
  const nonEmpty = steps.filter((s) => s.action.trim().length > 0);
  const testing = extractSection(planRaw, 'Testing Plan');
  const risk = extractSection(planRaw, 'Risk Assessment');
  const rollback = extractSection(planRaw, 'Rollback Procedures');

  const prompts: ReviewPrompt[] = [];

  if (nonEmpty.length === 0) {
    // No step table — holistic analysis prompts (mirror the legacy noSteps path).
    const bodyMatch = planRaw.match(/^---[\s\S]*?\n---\n([\s\S]*)$/);
    const body = (bodyMatch ? bodyMatch[1].trim() : planRaw).slice(0, 3000);
    prompts.push(
      { key: 'goal', label: 'Goal', prompt: `In 1-2 sentences, what is the core goal of this plan?\n\nPLAN:\n${body}` },
      { key: 'steps', label: 'Steps', prompt: `List 3-5 concrete implementation steps for this plan. One per line.\n\nPLAN:\n${body}` },
      { key: 'gaps', label: 'Gaps', prompt: `What are the key gaps, assumptions, or outside-the-box observations about this plan?\n\nPLAN:\n${body}` },
      { key: 'preconditions', label: 'Preconditions', prompt: `What preconditions, dependencies, or prerequisites should be noted for this plan?\n\nPLAN:\n${body}` },
    );
  } else {
    for (const step of nonEmpty) {
      prompts.push({
        key: `step-${step.number}`,
        label: `Step ${step.number}`,
        prompt: `Review this step (2-3 sentences). Concrete? Clear done? Missing preconditions?\n\nStep ${step.number}: ${step.action}\n${step.details ? `Details: ${step.details}` : ''}`,
      });
    }
    for (const sec of [
      { key: 'testing', label: 'Testing', body: testing },
      { key: 'risk', label: 'Risk', body: risk },
      { key: 'rollback', label: 'Rollback', body: rollback },
    ]) {
      if (!sec.body) continue;
      prompts.push({
        key: sec.key,
        label: sec.label,
        prompt: `Review this section (1-2 sentences). Gaps? Improvements?\n\n${sec.label}:\n${sec.body.slice(0, 500)}`,
      });
    }
  }

  // Overview always last.
  const headlines = nonEmpty.map((s) => `Step ${s.number}: ${s.action.slice(0, 80)}`).join('\n');
  prompts.push({
    key: 'overview',
    label: 'Overview',
    prompt: `Review this plan overview (2-3 sentences). Coherent? Gaps?\n\nPlan: ${fm.title || '(untitled)'} (${fm.status || '?'}, ${fm.priority || '?'})\n\nSteps:\n${headlines || '(none listed)'}\n\nTesting: ${(testing || 'Not defined').slice(0, 150)}\nRisk: ${(risk || 'Not defined').slice(0, 150)}\nRollback: ${(rollback || 'Not defined').slice(0, 150)}`,
  });

  return prompts;
}

// --- Orchestration ----------------------------------------------------------

const OPENCODE_URL = process.env.OPENCODE_URL ?? 'http://localhost:4096';

function vaultRoot(): string {
  return process.env.DOCWRIGHT_ROOT ? path.resolve(process.env.DOCWRIGHT_ROOT) : process.cwd();
}

/** Fire one prompt into a session (non-blocking; events flow on the /event bus). */
export async function sendPromptAsync(sessionID: string, text: string): Promise<void> {
  const dir = `directory=${encodeURIComponent(vaultRoot())}`;
  const res = await fetch(`${OPENCODE_URL}/session/${sessionID}/prompt_async?${dir}`, {
    method: 'POST',
    headers: opencodeHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ parts: [{ type: 'text', text }] }),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`prompt_async failed: HTTP ${res.status}`);
  }
}

/** Resolve once the session emits session.idle (or after timeoutMs). */
export function waitForIdle(sessionID: string, timeoutMs = 180_000): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      unsubscribe(sessionID, onEvent);
      clearTimeout(timer);
      resolve();
    };
    const onEvent = (e: OpencodeEvent) => {
      if (e.type === 'session.idle') finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    subscribe(sessionID, onEvent);
  });
}

export interface RunLiveReviewDeps {
  /** Send one prompt into the session (default: sendPromptAsync). */
  send?: (sessionID: string, text: string) => Promise<void>;
  /** Await a turn's completion (default: waitForIdle). */
  awaitIdle?: (sessionID: string) => Promise<void>;
  /** Reviewer persona prepended to the first prompt so the whole turn-chain stays in-role. */
  systemPrompt?: string;
  /** Optional per-turn hook (observability/tests). */
  onTurn?: (index: number, prompt: ReviewPrompt) => void;
}

/**
 * Send the review prompts into `sessionID` one at a time, awaiting each turn's
 * idle before the next. The reviewer persona is prepended to the first prompt;
 * the model retains it across the conversation.
 */
export async function runLiveReview(
  sessionID: string,
  prompts: ReviewPrompt[],
  deps: RunLiveReviewDeps = {},
): Promise<void> {
  const send = deps.send ?? sendPromptAsync;
  const awaitIdle = deps.awaitIdle ?? waitForIdle;
  const sys = deps.systemPrompt?.trim();

  for (let i = 0; i < prompts.length; i++) {
    const p = prompts[i];
    deps.onTurn?.(i, p);
    const text = i === 0 && sys ? `${sys}\n\n${p.prompt}` : p.prompt;
    await send(sessionID, text);
    await awaitIdle(sessionID);
  }
}
