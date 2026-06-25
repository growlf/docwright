/**
 * promote.ts — Status Transition Validation
 *
 * The integration layer between the profile state machine, gate evaluation,
 * ACL enforcement, and audit logging. All document status transitions go
 * through here.
 *
 * No VS Code API dependencies — runs in any Node context.
 *
 * Prerequisites already shipped (all imported below):
 *   gates.ts   — GateDefinition, GateResult, evaluateGate, getGatesForTransition
 *   audit.ts   — logTransition, writeAuditEntry
 *   profile.ts — ProfileConfig, getActiveProfile
 *   linter.ts  — LintResult, lintDocument
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { parseFrontmatter, setFrontmatterField } from './frontmatter';
import { GateDefinition, GateResult, getGatesForTransition, evaluateGate } from './gates';
import { logTransition } from './audit';
import { ProfileConfig, getActiveProfile } from './profile';
import { buildIndex } from './vault-index';
import { lintDocument, LintResult } from './linter';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ActorContext {
  actor: string;
  actorType: 'human' | 'ai';
}

export interface TransitionCheckResult {
  allowed: boolean;
  reason?: string;
  gates: GateDefinition[];
  gateResults: GateResult[];
  lintViolations: LintResult[];
  /** Populated by checkWithAI() when a gate has ai_pre_review_prompt */
  aiReadinessNote?: string;
}

export interface PromoteResult {
  success: boolean;
  reason?: string;
  newStatus?: string;
}

export interface DiffAnnotation {
  changedFields: string[];
  transitionFrom?: string;
  transitionTo?: string;
  transitionValid: boolean;
  gatesFired: GateDefinition[];
  gateResults: GateResult[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Infer doc type from path prefix when not specified in frontmatter.
 */
function inferDocType(docPath: string, fm: Record<string, unknown>): string {
  if (fm['type'] && typeof fm['type'] === 'string') return fm['type'] as string;
  const normalized = docPath.replace(/\\/g, '/');
  if (normalized.startsWith('proposals/')) return 'proposal';
  if (normalized.startsWith('plans/')) return 'plan';
  if (normalized.startsWith('policies/')) return 'policy';
  if (normalized.startsWith('decisions/')) return 'decision';
  if (normalized.startsWith('research/')) return 'research';
  if (normalized.startsWith('inbox/')) return 'inbox';
  return 'document';
}

/**
 * Return valid states for a given doc type from the profile, or [] if unknown.
 */
function validStates(profile: ProfileConfig, docType: string): string[] {
  return profile.states?.[docType] ?? [];
}

// ── Core API ───────────────────────────────────────────────────────────────

/**
 * Check whether a fromStatus → toStatus transition is valid for the given
 * document under the active profile's state machine and gate rules.
 *
 * Pure read — safe to call from UI for preview. Writes nothing.
 *
 * Wired by:
 *   Chat Panel Tier 2 Step 9  — diff panel transition preview
 *   Lifecycle Gates Phase 2 Step 1 — AI readiness check wraps this
 */
export function checkTransition(
  vaultRoot: string,
  docPath: string,
  fromStatus: string,
  toStatus: string,
  frontmatter: Record<string, unknown>,
  profile: ProfileConfig,
): TransitionCheckResult {
  const docType = inferDocType(docPath, frontmatter);
  const states = validStates(profile, docType);

  // Validate target status is known to this profile
  if (states.length > 0 && !states.includes(toStatus)) {
    return {
      allowed: false,
      reason: `'${toStatus}' is not a valid status for doc type '${docType}'. Valid: ${states.join(', ')}`,
      gates: [],
      gateResults: [],
      lintViolations: [],
    };
  }

  // Collect applicable gates
  const allGates: GateDefinition[] = (profile as any).gates ?? [];
  const matchedGates = getGatesForTransition(allGates, {
    document_type: docType,
    from: fromStatus,
    to: toStatus,
    phase: typeof frontmatter['phase'] === 'number' ? frontmatter['phase'] as number : undefined,
  });

  const gateResults = matchedGates.map(g =>
    evaluateGate(g, frontmatter as Record<string, any>)
  );

  const blockedGate = gateResults.find(r => r.blocked);
  if (blockedGate) {
    return {
      allowed: false,
      reason: blockedGate.reason ?? 'A gate is blocking this transition.',
      gates: matchedGates,
      gateResults,
      lintViolations: [],
    };
  }

  // Lint the document at its prospective new status
  const prospective = { ...frontmatter, status: toStatus };
  const lintViolations = lintDocument(
    docPath,
    prospective as Record<string, any>,
    profile,
  ).filter(r => r.severity === 'error');

  return {
    allowed: true,
    gates: matchedGates,
    gateResults,
    lintViolations,
  };
}

/**
 * Execute a validated transition: write the new status, stamp audit fields,
 * and log to audit/lifecycle.jsonl.
 *
 * Callers are responsible for persisting via vault-write.setDocumentField
 * if they need wikilink cascade. This function writes the single file at
 * docPath directly (status field only — not a full move operation).
 *
 * Wired by:
 *   Phase 4 Step 5 — AI write ACL enforcement stamps ai-last-action:
 *   Lifecycle Gates Phase 2 Step 1 — gate_note is stamped here
 */
export function executeTransition(
  vaultRoot: string,
  docPath: string,
  toStatus: string,
  actor: ActorContext,
  frontmatter: Record<string, unknown>,
  profile: ProfileConfig,
): PromoteResult {
  const fromStatus = String(frontmatter['status'] ?? '');

  const check = checkTransition(
    vaultRoot, docPath, fromStatus, toStatus, frontmatter, profile,
  );

  if (!check.allowed) {
    return { success: false, reason: check.reason };
  }

  const absPath = path.resolve(vaultRoot, docPath);
  if (!absPath.startsWith(path.resolve(vaultRoot))) {
    return { success: false, reason: 'docPath escapes vault root' };
  }

  try {
    let raw = fs.readFileSync(absPath, 'utf-8');
    raw = setFrontmatterField(raw, 'status', toStatus as any);
    if (actor.actorType === 'ai') {
      raw = setFrontmatterField(raw, 'ai-last-action', `transition:${fromStatus}->${toStatus}` as any);
    }
    fs.writeFileSync(absPath, raw);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, reason: `File write failed: ${msg}` };
  }

  // Audit log
  const gateId = check.gates[0]?.id;
  const gatePassed = check.gateResults[0]?.blocked === false;
  logTransition(
    docPath,
    fromStatus,
    toStatus,
    actor.actor,
    actor.actorType,
    gateId && gatePassed ? { gate_id: gateId, gate_status: 'passed' } : undefined,
  );

  return { success: true, newStatus: toStatus };
}

/**
 * checkTransition + optional AI pre-review pass.
 *
 * For each gate that has an ai_pre_review_prompt, calls the OpenCode engine
 * to produce a readiness summary that is returned as aiReadinessNote. If
 * OpenCode is unavailable, returns the plain checkTransition result.
 *
 * Wired by:
 *   Lifecycle Gates Phase 2 Step 1 — THE ONLY REMAINING STEP IN THAT PLAN
 */
export async function checkWithAI(
  vaultRoot: string,
  docPath: string,
  fromStatus: string,
  toStatus: string,
  frontmatter: Record<string, unknown>,
  profile: ProfileConfig,
): Promise<TransitionCheckResult> {
  const base = checkTransition(
    vaultRoot, docPath, fromStatus, toStatus, frontmatter, profile,
  );

  const promptGate = base.gates.find(g => g.ai_pre_review_prompt);
  if (!promptGate) return base;

  const opencodeUrl = process.env['OPENCODE_URL'];
  if (!opencodeUrl) return base;

  try {
    const docContent = fs.readFileSync(
      path.resolve(vaultRoot, docPath), 'utf-8',
    );

    const systemPrompt =
      promptGate.ai_pre_review_prompt ??
      'You are a governance reviewer. Identify blockers, incomplete items, and gaps. Be concise.';

    const userPrompt = [
      `Document: ${docPath}`,
      `Transition: ${fromStatus} → ${toStatus}`,
      '',
      'Document content:',
      docContent.slice(0, 8000),
      '',
      'Produce a short readiness summary for the human reviewer.',
    ].join('\n');

    const res = await fetch(`${opencodeUrl}/v2/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `gate-review:${docPath}` }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return base;

    const session = await res.json() as { id: string };
    const msgRes = await fetch(`${opencodeUrl}/v2/session/${session.id}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user', parts: [{ type: 'text', text: userPrompt }], providerOptions: { system: systemPrompt } }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!msgRes.ok) return base;

    const text = await msgRes.text();
    // Extract last assistant text from SSE stream
    const lines = text.split('\n');
    let note = '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      try {
        const d = JSON.parse(line.slice(5));
        if (d?.role === 'assistant' && d?.parts) {
          for (const p of d.parts) {
            if (p.type === 'text') note += p.text;
          }
        }
      } catch { /* ignore */ }
    }

    return { ...base, aiReadinessNote: note.trim() || undefined };
  } catch {
    // Non-blocking — any OpenCode failure returns the plain result
    return base;
  }
}

/**
 * Return all documents in the vault whose next valid transition requires a
 * gate review that has not been given.
 *
 * Wired by:
 *   Phase 3 Step 13 — Knowledge Graph gap detection overlay
 *   lifecycle-graph Step 1 — funnel view blocked-lane badge
 */
export function getBlockedDocuments(
  vaultRoot: string,
  profile: ProfileConfig,
): Array<{ path: string; frontmatter: Record<string, unknown>; blockReason: string }> {
  const index = buildIndex(vaultRoot);
  const allGates: GateDefinition[] = (profile as any).gates ?? [];
  const blocked: Array<{ path: string; frontmatter: Record<string, unknown>; blockReason: string }> = [];

  for (const [relPath, entry] of Object.entries(index)) {
    const fm = entry.fm as Record<string, unknown>;
    const docType = inferDocType(relPath, fm);
    const currentStatus = String(fm['status'] ?? '');
    const states = validStates(profile, docType);

    for (const nextStatus of states) {
      if (nextStatus === currentStatus) continue;
      const matchedGates = getGatesForTransition(allGates, {
        document_type: docType,
        from: currentStatus,
        to: nextStatus,
        phase: typeof fm['phase'] === 'number' ? fm['phase'] as number : undefined,
      });
      for (const gate of matchedGates) {
        const result = evaluateGate(gate, fm as Record<string, any>);
        if (result.blocked && result.reason) {
          blocked.push({ path: relPath, frontmatter: fm, blockReason: result.reason });
          break;
        }
      }
    }
  }

  return blocked;
}

/**
 * Annotate a before/after frontmatter pair with lifecycle governance diff.
 * Used by the Chat Panel diff view to render governance badges on diff hunks.
 *
 * Wired by:
 *   Chat Panel Tier 2 Step 10 — diffAnnotate is the named function in plan notes
 */
export function diffAnnotate(
  vaultRoot: string,
  docPath: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  profile: ProfileConfig,
): DiffAnnotation {
  const changedFields = Object.keys(after).filter(
    k => JSON.stringify(after[k]) !== JSON.stringify(before[k])
  );

  const fromStatus = String(before['status'] ?? '');
  const toStatus = String(after['status'] ?? '');
  const statusChanged = fromStatus !== toStatus;

  if (!statusChanged) {
    return {
      changedFields,
      transitionValid: true,
      gatesFired: [],
      gateResults: [],
    };
  }

  const docType = inferDocType(docPath, after);
  const allGates: GateDefinition[] = (profile as any).gates ?? [];
  const gatesFired = getGatesForTransition(allGates, {
    document_type: docType,
    from: fromStatus,
    to: toStatus,
    phase: typeof after['phase'] === 'number' ? after['phase'] as number : undefined,
  });
  const gateResults = gatesFired.map(g => evaluateGate(g, after as Record<string, any>));

  const states = validStates(profile, docType);
  const transitionValid = states.length === 0 || states.includes(toStatus);

  return {
    changedFields,
    transitionFrom: fromStatus,
    transitionTo: toStatus,
    transitionValid,
    gatesFired,
    gateResults,
  };
}
