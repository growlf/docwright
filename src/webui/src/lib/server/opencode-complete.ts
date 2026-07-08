/**
 * opencodeComplete — single-turn AI completion via OpenCode's session API.
 *
 * Creates a short-lived OpenCode session, sends one prompt, collects the text
 * response, and returns it. All AI calls (plan-review, apply-review, synthesize)
 * go through here so provider/model selection is controlled by OpenCode alone.
 *
 * Session API shape (confirmed against OpenCode v1.17.11):
 *   POST /session?directory=<vault>
 *     body: { model?: { id: string; providerID: string } }
 *     → { id: "ses_..." }
 *
 *   POST /session/<id>/message?directory=<vault>
 *     body: { parts: [{ type: "text"; text: string }] }
 *     → { parts: Array<{ type: string; text?: string }> }
 *     text parts have type === "text"; reasoning/step-start/step-finish are skipped.
 */

import path from 'node:path';

const OPENCODE_URL   = process.env.OPENCODE_URL ?? 'http://localhost:4096';
const VAULT_ROOT     = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : process.cwd();
const DEFAULT_MODEL  = process.env.OPENCODE_DEFAULT_MODEL ?? '';

const DIR_PARAM = `directory=${encodeURIComponent(VAULT_ROOT)}`;
const TIMEOUT_MS = 300_000; // 300s — model cold-start can be slow

export interface OpenCodeModel {
  id: string;
  providerID: string;
}

export interface OpenCodeResponse {
  text: string;
  systemPrompt?: string;
  userPrompt: string;
  thinking?: string;
  model?: string;
}

/**
 * Run a single-turn completion through OpenCode.
 *
 * @param prompt       - The full prompt text to send.
 * @param model        - Optional model override.
 * @param systemPrompt - Optional system prompt injected as a role:system message before
 *                       the user prompt. Use AI_ROLES[roleId].systemPrompt to get the
 *                       DocWright-standard prompt for a given specialist role.
 * @returns Object with text response and metadata (systemPrompt, userPrompt, thinking).
 * @throws  Error with a human-readable message when OpenCode is unreachable
 *          or returns an error status.
 */
export async function opencodeComplete(
  prompt: string,
  model?: OpenCodeModel,
  systemPrompt?: string,
): Promise<OpenCodeResponse> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  // --- 1. Resolve model ---
  // Explicit arg wins; fall back to env var; fall back to OpenCode's current selection.
  let resolvedModel: OpenCodeModel | undefined = model;
  if (!resolvedModel && DEFAULT_MODEL) {
    // OPENCODE_DEFAULT_MODEL can be "providerID/modelID" or just "modelID"
    const slash = DEFAULT_MODEL.indexOf('/');
    resolvedModel = slash >= 0
      ? { providerID: DEFAULT_MODEL.slice(0, slash), id: DEFAULT_MODEL.slice(slash + 1) }
      : { providerID: 'opencode', id: DEFAULT_MODEL };
  }

  // --- 2. Create session ---
  const sessBody: Record<string, unknown> = {};
  if (resolvedModel) sessBody.model = resolvedModel;

  let sessRes: Response;
  try {
    sessRes = await fetch(`${OPENCODE_URL}/session?${DIR_PARAM}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessBody),
      signal,
    });
  } catch (e: any) {
    throw new Error(`OpenCode unreachable (${OPENCODE_URL}): ${e?.message ?? e}`);
  }

  if (!sessRes.ok) {
    throw new Error(`OpenCode session create failed: HTTP ${sessRes.status}`);
  }

  const sess = await sessRes.json() as { id?: string; sessionID?: string };
  const sessionId = sess?.id ?? sess?.sessionID;
  if (!sessionId) throw new Error('OpenCode returned no session ID');

  // --- 2b. Inject system prompt (best-effort) ---
  if (systemPrompt) {
    try {
      await fetch(`${OPENCODE_URL}/session/${sessionId}/message?${DIR_PARAM}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts: [{ type: 'text', text: systemPrompt }], role: 'system' }),
        signal,
      });
    } catch { /* system prompt injection is best-effort */ }
  }

  // --- 3. Send prompt ---
  let msgRes: Response;
  try {
    msgRes = await fetch(`${OPENCODE_URL}/session/${sessionId}/message?${DIR_PARAM}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts: [{ type: 'text', text: prompt }] }),
      signal,
    });
  } catch (e: any) {
    throw new Error(`OpenCode message failed: ${e?.message ?? e}`);
  }

  if (!msgRes.ok) {
    throw new Error(`OpenCode message failed: HTTP ${msgRes.status}`);
  }

  // --- 4. Extract all parts (text, thinking, reasoning, step events, etc.) ---
  const data = await msgRes.json() as { parts?: Array<{ type: string; text?: string }> };
  const textParts = (data?.parts ?? [])
    .filter(p => p.type === 'text')
    .map(p => p.text ?? '')
    .join('');

  // Capture reasoning/thinking from any part type (reasoning, thinking, step-*, etc.)
  const thinkingParts = (data?.parts ?? [])
    .filter(p => ['thinking', 'reasoning', 'step-start', 'step-finish', 'step-progress'].includes(p.type))
    .map(p => p.text ?? '')
    .filter(t => t.trim().length > 0)
    .join('\n');

  if (!textParts) throw new Error('OpenCode returned an empty response');

  return {
    text: textParts,
    systemPrompt,
    userPrompt: prompt,
    thinking: thinkingParts || undefined,
    model: resolvedModel?.id,
  };
}
