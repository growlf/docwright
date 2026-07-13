# Release notes — v0.5.2

Patch release within Phase 5. Completes the AI-agent lifecycle-tooling hardening
and makes the governance surfaces operable from the Web UI. No breaking changes.

## Features

- **"Needs your attention" queue on `/status`** (#346, fixes #345) — a panel
  pinned to the top of every view that distills the items gated on the human's
  decision now (plans whose work is done, awaiting Certify → Complete; a phase
  ready to close), each with a direct action. No more hunting the full spew.
- **Phase close-out from the Web UI** (#344) — a "Phase N ready to close" banner
  + a human-gated Close Phase button that bumps the version via the shared
  phase-close core (tagging/pushing stays an explicit BDFL step).

## Fixes (lifecycle-tooling hardening — completes plans/harden-plan-proposal-lifecycle-tooling)

- **Approve pipeline** (#340) — shared `approve-paths` normalization: no more
  `proposals/approved/approved/…` double-nest or `plans/approved/` skeleton;
  re-approve is an idempotent, race-safe no-op that never clobbers an
  in-progress plan.
- **Completion gate `verification_type`** (#341, fixes #315) — plans declare
  `unit` (default) / `runtime` (human attestation) / `none`, so runtime-verified
  infra/deployment plans are no longer deadlocked by the repo unit suite; the MCP
  generator now scaffolds a `## Phase Gate`.
- **PreToolUse gate actually blocks** (#342) — the lifecycle hook now exits 2
  (deny) instead of the non-blocking exit 1, so a direct `plans/*.md` Write/Edit
  is truly prevented, not just warned.
- **Deterministic live plan-review completion** (#343, fixes #311) — the server
  (which drives a known prompt list) owns the done signal via a `status` action;
  the client polls it instead of counting fragile `session.idle` events.

## Verification

`test:dispatch` (431), `test:mcp`, `test:hooks`, and `test:integration` green
across the merged PRs; webui `vite build` clean.
