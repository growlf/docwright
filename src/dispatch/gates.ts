/**
 * gates.ts — Lifecycle Gate Evaluation Engine
 *
 * No VS Code deps — runs in any Node context.
 * Implements the base gate mechanism (phase-gate-sign-off) plus:
 * - Phase 1a: multi-reviewer quorum
 * - Phase 1b: time-based schedule triggers
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface GateDefinition {
  id: string;
  trigger: 'all-plans-in-phase-completed' | 'status-transition' | 'schedule';
  from?: string;
  to?: string;
  document_type?: string;
  reviewer_field: string;
  /** Phase 1a — list of role tiers required for review */
  reviewers?: string[];
  /** Phase 1a — minimum approvals needed (default 1) */
  quorum?: number;
  blocks: string;
  description: string;
  /** Phase 1b — cadence for schedule triggers: annually | quarterly | monthly | ISO 8601 duration */
  cadence?: string;
  /** Phase 1b — only documents in these statuses are evaluated by schedule gates */
  status_filter?: string[];
  /** Phase 3 — AI pre-review prompt (optional, per gate type). Overrides the default prompt. */
  ai_pre_review_prompt?: string;
}

export interface GateReview {
  reviewer: string;
  role: string;
  status: 'pending' | 'approved' | 'critique' | 'waived';
  date: string;
  note?: string;
}

export interface GateResult {
  blocked: boolean;
  reason?: string;
  reviews: GateReview[];
  quorum_met: boolean;
  /** Which gates matched this document */
  matched_gates: GateDefinition[];
}

// ── Cadence parsing ────────────────────────────────────────────────────────

/**
 * Parse a cadence string into milliseconds.
 * Accepts: 'annually', 'quarterly', 'monthly', or ISO 8601 duration (e.g. P90D, P6M, P1Y).
 * Returns milliseconds, or null if unparseable.
 */
export function parseCadence(cadence: string): number | null {
  const day = 86_400_000;
  const year = 365.25 * day;
  switch (cadence) {
    case 'annually':  return Math.round(year);
    case 'quarterly': return Math.round(year / 4);
    case 'monthly':   return Math.round(year / 12);
  }
  // Try ISO 8601 duration: P[n]Y[n]M[n]D
  const isoMatch = cadence.match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1] || '0', 10);
    const m = parseInt(isoMatch[2] || '0', 10);
    const d = parseInt(isoMatch[3] || '0', 10);
    return Math.round(y * year + m * (year / 12) + d * day);
  }
  return null;
}

/**
 * Get the last gate review date from a document's frontmatter.
 * Returns a Date, or null if no gate_date is set.
 */
export function getLastGateDate(fm: Record<string, any>): Date | null {
  const raw = fm.gate_date ?? fm.last_gate_date ?? fm.reviewed_date;
  if (!raw) return null;
  const d = new Date(String(raw));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Evaluate whether a document is overdue for a schedule gate.
 * A doc is overdue if: last_gate_date + cadence < now
 * Documents with no gate_date are considered overdue if they match status_filter.
 */
export function isOverdue(gate: GateDefinition, fm: Record<string, any>): boolean {
  if (gate.trigger !== 'schedule' || !gate.cadence) return false;

  // Check status_filter — only evaluate docs in matching statuses
  if (gate.status_filter && gate.status_filter.length > 0) {
    const docStatus = fm.status ?? '';
    if (!gate.status_filter.includes(docStatus)) return false;
  }

  const cadenceMs = parseCadence(gate.cadence);
  if (!cadenceMs) return false;

  const lastDate = getLastGateDate(fm);
  if (!lastDate) {
    // No prior review — overdue (needs initial review)
    return true;
  }

  return (lastDate.getTime() + cadenceMs) < Date.now();
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function getGateDefinition(profileJson: any): GateDefinition[] {
  return profileJson?.gates ?? [];
}

/**
 * Find schedule gates that apply to a document regardless of transition.
 * A schedule gate matches if:
 * - trigger === 'schedule'
 * - document_type matches (if specified)
 * - doc status matches status_filter (if specified)
 */
export function getScheduleGatesForDocument(
  gates: GateDefinition[],
  fm: Record<string, any>,
): GateDefinition[] {
  return gates.filter((g) => {
    if (g.trigger !== 'schedule') return false;
    if (g.document_type && g.document_type !== (fm.type ?? fm._type)) return false;
    if (g.status_filter && g.status_filter.length > 0) {
      const docStatus = fm.status ?? '';
      return g.status_filter.includes(docStatus);
    }
    return true;
  });
}

/**
 * Find all gates that match a given document's state at transition time.
 */
export function getGatesForTransition(
  gates: GateDefinition[],
  doc: { document_type?: string; from?: string; to?: string; phase?: number },
): GateDefinition[] {
  return gates.filter((g) => {
    if (g.trigger === 'all-plans-in-phase-completed') {
      // Phase completion — matches when a phase-level document transitions
      return doc.document_type === 'phase' || typeof doc.phase === 'number';
    }
    if (g.trigger === 'status-transition') {
      if (g.document_type && g.document_type !== doc.document_type) return false;
      if (g.from && g.from !== doc.from) return false;
      if (g.to && g.to !== doc.to) return false;
      return true;
    }
    return false;
  });
}

/**
 * Evaluate whether a gate blocks the transition.
 *
 * Checks:
 * 1. If gate_status is 'approved' or 'waived' — not blocked
 * 2. If multi-reviewer quorum (gate_reviews[]) meets the quorum count — not blocked
 * 3. If no reviewer assigned — blocked with explanatory reason
 * 4. Otherwise — pending
 */
export function evaluateGate(
  gate: GateDefinition,
  frontmatter: Record<string, any>,
): GateResult {
  const gateStatus = frontmatter.gate_status;
  const gateReviews: GateReview[] = frontmatter.gate_reviews ?? [];
  const quorum = gate.quorum ?? 1;
  const matchedGates = [gate];

  // Already cleared
  if (gateStatus === 'approved') {
    return { blocked: false, reviews: gateReviews, quorum_met: true, matched_gates: matchedGates };
  }
  if (gateStatus === 'waived') {
    return { blocked: false, reviews: gateReviews, quorum_met: false, matched_gates: matchedGates };
  }

  // Multi-reviewer quorum check (Phase 1a)
  const approvedCount = gateReviews.filter((r) => r.status === 'approved').length;
  const quorumMet = approvedCount >= quorum;

  if (gateReviews.length > 0 && quorumMet) {
    return { blocked: false, reviews: gateReviews, quorum_met: true, matched_gates: matchedGates };
  }

  // Resolve reviewer(s) from the designated field
  const rawReviewer = frontmatter[gate.reviewer_field];
  const reviewerSet: string[] = Array.isArray(rawReviewer)
    ? rawReviewer.filter(Boolean)
    : rawReviewer
      ? [String(rawReviewer)]
      : [];

  if (reviewerSet.length === 0) {
    return {
      blocked: true,
      reason: `Gate "${gate.id}" has no reviewer assigned. Set "${gate.reviewer_field}" in frontmatter.`,
      reviews: gateReviews,
      quorum_met: false,
      matched_gates: matchedGates,
    };
  }

  if (gateReviews.length > 0 && !quorumMet) {
    return {
      blocked: true,
      reason: `Gate "${gate.id}" requires ${quorum} approval(s). ${approvedCount}/${quorum} approved.`,
      reviews: gateReviews,
      quorum_met: false,
      matched_gates: matchedGates,
    };
  }

  // No reviews yet — pending
  return {
    blocked: true,
    reason: `Gate "${gate.id}" is pending review by ${reviewerSet.join(', ')}.`,
    reviews: gateReviews,
    quorum_met: false,
    matched_gates: matchedGates,
  };
}

/**
 * Apply a reviewer action to the document's gate state.
 * Returns the updated frontmatter (immutable).
 */
export function applyReview(
  frontmatter: Record<string, any>,
  reviewer: string,
  role: string,
  status: 'approved' | 'critique' | 'waived',
  note?: string,
): Record<string, any> {
  const now = new Date().toISOString().slice(0, 10);
  const reviews: GateReview[] = frontmatter.gate_reviews
    ? [...frontmatter.gate_reviews]
    : [];

  reviews.push({ reviewer, role, status, date: now, note });

  // Determine overall gate_status from quorum
  const approvedCount = reviews.filter((r) => r.status === 'approved').length;
  const quorum = frontmatter.gate_quorum ?? 1;
  const overallStatus = status === 'waived'
    ? 'waived'
    : approvedCount >= quorum
      ? 'approved'
      : 'pending';

  return {
    ...frontmatter,
    gate_reviews: reviews,
    gate_status: overallStatus,
    gate_date: now,
    gate_note: note || frontmatter.gate_note,
  };
}

/**
 * Scan all lifecycle docs and return a summary of pending/waived gates
 * and overdue schedule gates.
 */
export function scanAllGates(
  gates: GateDefinition[],
  docs: Array<{ path: string; fm: Record<string, any> }>,
): {
  pending: Array<{ path: string; gate: GateDefinition; result: GateResult }>;
  approved: Array<{ path: string; gate: GateDefinition; result: GateResult }>;
  waived: Array<{ path: string; gate: GateDefinition; result: GateResult }>;
  overdue: Array<{ path: string; gate: GateDefinition; next_review: string }>;
} {
  const pending: Array<{ path: string; gate: GateDefinition; result: GateResult }> = [];
  const approved: Array<{ path: string; gate: GateDefinition; result: GateResult }> = [];
  const waived: Array<{ path: string; gate: GateDefinition; result: GateResult }> = [];
  const overdue: Array<{ path: string; gate: GateDefinition; next_review: string }> = [];

  for (const doc of docs) {
    // Transition-triggered gates
    const matched = getGatesForTransition(gates, {
      document_type: doc.fm.type || doc.fm._type,
      from: doc.fm.status,
      to: doc.fm._next_status,
      phase: doc.fm.phase,
    });

    for (const gate of matched) {
      const result = evaluateGate(gate, doc.fm);
      if (result.blocked) {
        pending.push({ path: doc.path, gate, result });
      } else if (doc.fm.gate_status === 'waived') {
        waived.push({ path: doc.path, gate, result });
      } else {
        approved.push({ path: doc.path, gate, result });
      }
    }

    // Schedule-triggered gates (Phase 1b)
    const scheduleGates = getScheduleGatesForDocument(gates, doc.fm);
    for (const gate of scheduleGates) {
      if (isOverdue(gate, doc.fm)) {
        const lastDate = getLastGateDate(doc.fm);
        const cadenceMs = parseCadence(gate.cadence!);
        const nextReview = lastDate && cadenceMs
          ? new Date(lastDate.getTime() + cadenceMs).toISOString().slice(0, 10)
          : 'initial review needed';
        overdue.push({ path: doc.path, gate, next_review: nextReview });
      }
    }
  }

  return { pending, approved, waived, overdue };
}

// ── Retroactive Audit (Phase 2b) ──────────────────────────────────────────

export interface AuditFinding {
  path: string;
  title: string;
  transition_from: string;
  transition_to: string;
  gate_id: string;
  gate_description: string;
  expected_reviewer: string;
  current_gate_status: string;
  current_gate_note?: string;
  matched: boolean;  // true = gate was properly satisfied, false = gap found
}

/**
 * Retroactively scan all lifecycle docs for transitions that should have been
 * gated but were not. Compares current doc state against gate rules.
 *
 * A finding is flagged when:
 * - A doc's status matches a gate's "to" state
 * - The gate_status is not 'approved' (or 'waived' with note)
 * - No gate review was recorded for that transition
 *
 * Set `fix = true` to return a modified frontmatter that stamps
 * gate_status: waived on each finding (docs are NOT written — caller decides).
 */
export function retroactiveAudit(
  gates: GateDefinition[],
  docs: Array<{ path: string; fm: Record<string, any> }>,
  fix: boolean = false,
): { findings: AuditFinding[]; fixes: Array<{ path: string; frontmatter: Record<string, any> }> } {
  const findings: AuditFinding[] = [];
  const fixes: Array<{ path: string; frontmatter: Record<string, any> }> = [];

  for (const doc of docs) {
    const now = doc.fm.gate_date || doc.fm.created;
    const title = String(doc.fm.title ?? doc.path.replace(/^.*\//, '').replace('.md', ''));
    const docType = doc.fm.type || (doc.path.startsWith('plan') ? 'plan' : 'proposal');

    // For each gate that could apply to this doc type, check if the transition was gated
    for (const gate of gates) {
      if (gate.trigger !== 'status-transition') continue;
      if (gate.document_type && gate.document_type !== docType) continue;

      const currentStatus = doc.fm.status ?? '';
      const gateStatus = doc.fm.gate_status ?? '';
      const gateReviews: GateReview[] = doc.fm.gate_reviews ?? [];
      const reviewer = doc.fm[gate.reviewer_field];

      // Check if this doc has reached or passed the "to" state for this gate
      // but doesn't have proper gate sign-off
      if (currentStatus === gate.to || currentStatus === 'completed' || currentStatus === 'active') {
        const matched = gateReviews.some(r =>
          r.status === 'approved' || r.status === 'waived'
        ) || gateStatus === 'approved' || gateStatus === 'waived';

        if (!matched) {
          const finding: AuditFinding = {
            path: doc.path,
            title,
            transition_from: gate.from ?? '*',
            transition_to: gate.to ?? '*',
            gate_id: gate.id,
            gate_description: gate.description,
            expected_reviewer: reviewer ? String(reviewer) : 'not assigned',
            current_gate_status: gateStatus || 'not set',
            current_gate_note: doc.fm.gate_note,
            matched: false,
          };
          findings.push(finding);

          if (fix) {
            const fixed = applyReview(
              doc.fm,
              'retroactive-audit',
              'system',
              'waived',
              `Gate "${gate.id}" did not exist when this transition occurred. Retroactively waived by audit scanner.`,
            );
            fixes.push({ path: doc.path, frontmatter: fixed });
          }
        }
      }
    }
  }

  return { findings, fixes };
}
