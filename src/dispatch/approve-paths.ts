/**
 * approve-paths.ts — shared path resolution for proposal→approved transitions.
 *
 * Both the MCP `transitionToApproved` tool and the Web-UI `/api/approve-proposal`
 * route used to normalize the proposal name independently, each stripping only a
 * leading `proposals/` prefix. An input that already pointed at the approved
 * location (`proposals/approved/x.md`) therefore produced a doubly-nested
 * destination (`proposals/approved/approved/x.md`) and a `plans/approved/`
 * skeleton. This module is the single source of truth both surfaces import
 * (harden-plan-proposal-lifecycle-tooling step 2.1; Constraint 1: no per-surface
 * reimplementation).
 *
 * Pure string/path helpers — no filesystem, no MCP, no VS Code deps.
 */

/**
 * Collapse any `proposals/` and/or `approved/` leading segments and normalize to
 * a bare `<slug>.md` basename. Idempotent for already-approved inputs.
 *
 *   'x'                            -> 'x.md'
 *   'x.md'                         -> 'x.md'
 *   'proposals/x.md'              -> 'x.md'
 *   'approved/x.md'               -> 'x.md'
 *   'proposals/approved/x.md'     -> 'x.md'
 */
export function normalizeProposalName(input: string): string {
  const base = input
    .replace(/^proposals\//, '')
    .replace(/^approved\//, '')
    .replace(/\.md$/, '');
  return `${base}.md`;
}

/**
 * Given a normalized `<slug>.md` name, the canonical vault paths for the approve
 * transition. `approved` never double-nests; `plan` always lands at `plans/`.
 */
export function approvePaths(name: string): {
  slug: string;
  root: string;
  approved: string;
  plan: string;
} {
  const safe = normalizeProposalName(name);
  const slug = safe.replace(/\.md$/, '');
  return {
    slug,
    root: `proposals/${safe}`,
    approved: `proposals/approved/${safe}`,
    plan: `plans/${safe}`,
  };
}
