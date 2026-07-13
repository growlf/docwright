---
title: "Purpose-based authorization — retire the global HUMAN_APPROVED gate"
author: "NetYeti"
created: "2026-07-13"
created_by: "NetYeti@cluster-llm"
status: draft
proposal_source: "proposals/retire-human-approved-global-gate-for-purpose-based-authorization.md"
priority: high
automated: guided
assigned_to: ["NetYeti"]
verification_type: unit
related_to:
  - proposals/retire-human-approved-global-gate-for-purpose-based-authorization.md
  - docs/authz-model-hardening-review.md
  - docs/authz-model-implementation-plan-draft.md
depends_on: []
blocks: []
tests_defined: true
tests_human_reviewed: false
template_version: "1.0"
scenario_synthesis: "Retire the blunt global HUMAN_APPROVED gate for a purpose-based model. Authorization is classed by reversibility: reversible work needs none (logged); irreversible/outward + governance-doc lifecycle need a signed, single-use, target-scoped grant minted by an OUT-OF-PROCESS signer the AI process cannot forge, fronted by a pluggable IdP (built-in simple auth / GitHub OAuth first; Google + external OIDC later). Verify the signature, never file-presence. Real boundary for push/merge/tag is the git server's protection + a capability-scoped bot token; delete/external-send gate server-side in the MCP tool. Audit hardened (attributed, fail-closed, hash-chained) as a prerequisite. Staged so the gate is never absent, only doubled: A0 signer+IdP first → additive warn-only → parallel double-gate (MCP B3 first) → retire legacy last + CI grep-gate. Closes the pre-existing git-commit.ts/AUTH_MODE=none self-seal hole at C1."
total_steps: 0
completed_steps: 0
---

# Purpose-based authorization — retire the global HUMAN_APPROVED gate

## Overview

Replace the global `HUMAN_APPROVED=1` env-var/commit-marker gate with a purpose-based,
audited model. Full rationale + two adversarial-review passes:
[[docs/authz-model-hardening-review]]; buildable spec: [[docs/authz-model-implementation-plan-draft]];
proposal: [[proposals/retire-human-approved-global-gate-for-purpose-based-authorization]].

**Core primitive:** a grant = a **signed**, single-use, target-scoped authorization minted by an
**out-of-process signer** (a key custodian the AI process cannot read — separate uid/service,
IdP-agnostic). Verify the **signature**, never file-presence. Identity is a **pluggable IdP**
(built-in simple auth + GitHub OAuth first; Google + external OIDC like Authentik later),
decoupled from the signer.

## Constraints & Invariants

1. **The gate is never absent, only doubled.** Build additive/warn-only, run in parallel with
   legacy `HUMAN_APPROVED`, remove legacy LAST.
2. **AI never assumes/infers/stretches authorization**; no AI-reachable mint path for gated classes.
3. **Strong bar keys on reversibility, not doc-vs-action.** Signed grant required for every
   irreversible/outward action AND governance-doc lifecycle.
4. **The real boundary for push/merge/tag is the git server** (GitHub today: branch/tag protection
   + a capability-scoped bot token). The Bash-matcher is defense-in-depth only. Delete/external-send
   gate server-side in the MCP tool (no downstream backstop).
5. **Keep the field-level MCP default-deny guards verbatim.** AI still cannot self-set
   `approved`/`completed`/`gate_status` — the human act just becomes a signed grant, not an env var.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| A0 | Out-of-process signer + pluggable IdP (blocking) | Signer holds the signing key the AI process can't read (separate uid/service); define signed payload `{nonce,action_class,target,content_hash,operator_id,issued_at,expiry}` + `verifyGrant`=signature check. IdP layer: ship built-in simple auth + GitHub OAuth first. Retire `AUTH_MODE=none` synthetic-admin for gated classes. | ⏳ Pending |
| A0b | Git-server branch/tag protection + capability-scoped bot token (blocking) | On GitHub (today): the bot token cannot push to `main`, push tags, or delete protected refs — fails at the server regardless of command. The real boundary. | ⏳ Pending |
| A1 | Audit hardening (blocking prerequisite) | `audit.ts` + UI audit: fail-closed on write error; append-only + hash-chained; `operator_id` from the verified signed grant (not an AI arg / `NetYeti` fallback). Note: chain is detection, not prevention, absent an out-of-process/HMAC-keyed writer. | ⏳ Pending |
| A2 | Grant module (pure, additive) | `src/dispatch/grants.ts`: sign/verify/consume; single-use (atomic compare-and-consume); target-scoped; content_hash re-verified against staged bytes for governance; unit-tested vs an injectable signer+store. Nothing wired. | ⏳ Pending |
| A3 | UI minting + per-action confirmation (warn-only) | Approve/complete/gate endpoints: real per-action human confirmation bound to `{filePath, sha256(content)}`; mint a signed grant; stamp `DW-GRANT`. Still stamp legacy `HUMAN_APPROVED` for now. | ⏳ Pending |
| A4 | Built-in/CLI grant path (warn-only) | The human authorizes via the IdP → signer mints; NO AI-runnable local mint command for gated classes (a plain `docwright grant` the AI can call is a hole). Solo/local uses built-in auth's per-action confirmation. | ⏳ Pending |
| A5 | PreToolUse Bash-matcher (warn mode, defense-in-depth) | Match `git push`/`gh pr merge`/`gh issue delete`/tag push/external-send; LOG grant presence, don't deny yet. Document it's bypassable (A0b is the boundary). | ⏳ Pending |
| A6 | commit-msg token check (warn mode) | Verify a `DW-GRANT` signature on governance commits; log mismatches, don't block (legacy marker still blocks). Defer CI grep-gate. | ⏳ Pending |
| B3 | MCP consumes the grant (FIRST enforcing flip) | `transition_to_*` require a verified signed grant (or stay downstream of a grant-checked write). Delete + external-send gate HERE, server-side. Gate the surface the AI most easily drives before the others. | ⏳ Pending |
| B1 | commit-msg enforce (deny) | Governance commits need BOTH a valid signed grant AND the legacy marker (doubled). | ⏳ Pending |
| B2 | Bash-matcher enforce (deny, defense-in-depth) | Deny irreversible/outward without a matching grant; negatives: conversational-only denied, injected grant denied+logged, replay denied, target-mismatch denied. | ⏳ Pending |
| B4 | Burn-in (both surfaces + both AUTH_MODEs) | Watch grants + hardened audit; prove mint/consume + every negative before leaning on the new path. | ⏳ Pending |
| C1 | Retire legacy (both artifacts together) | Remove `HUMAN_APPROVED` env check (hook), commit-marker logic (pre-commit + commit-msg), unstaple `HUMAN_APPROVED:'1'` from `git-commit.ts` — **closes the pre-existing self-seal hole here**. Coordinate with `plans/adopt-milestone-driven-roadmap-discipline.md` step 19. | ⏳ Pending |
| C2 | Docs + policies + CI gate (last) | Rewrite `ai-governance-boundaries` + `workflow-layer-governance` around the action-class model; purge `HUMAN_APPROVED` from docs; add the CI grep-gate LAST. | ⏳ Pending |

## Testing Plan

- A2: grant lifecycle (sign/verify/consume; expiry; single-use replay-denied; target-scope; content_hash mismatch denied) vs injectable signer.
- A1: audit fail-closed on write error; hash-chain detects tampering; operator_id sourced from grant.
- B2/B3 negatives: conversational-only grant denied for merge/delete/release/send; injected/file-borne grant denied + logged; replay denied; `pr:240`≠`pr:241`.
- A0b: bot token rejected by the server on push-to-main / tag / protected-ref delete.
- Governance transition needs a UI-minted signed grant; AI cannot self-advance.
- C2 grep-gate: no `HUMAN_APPROVED`/`HUMAN-APPROVED` in enforcement/docs.

## Rollback Procedures

- Phases A–B additive/flagged → disable the flag; legacy `HUMAN_APPROVED` still governs.
- After C: revert the C commits (legacy is git-recoverable); the grant store persists.

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Migration window weaker than today | Never absent, only doubled; B3 (MCP) flips first; remove legacy last |
| Signer key reachable by the AI | Out-of-process custodian (separate uid/service); verify signature not file-presence |
| Bash-matcher bypass | It's defense-in-depth; A0b (server protection + scoped token) is the boundary |
| Solo-local can't self-approve | Built-in simple auth per-action confirmation fronts the signer |
| Breaking current approvals during migration | Legacy stays load-bearing until C1; git-commit.ts stamp removed only at C1 |

## Phase Gate

- [ ] A0 signer verifies signatures; a hand-forged grant line fails; no AI-reachable mint path; no synthetic-admin minting
- [ ] A0b git-server protection + scoped bot token shipped + tested
- [ ] Audit hardened (attributed, fail-closed, hash-chained)
- [ ] Grant module unit-tested (all negatives)
- [ ] Burn-in clean on both surfaces + both AUTH_MODEs
- [ ] Legacy artifacts retired together; pre-existing git-commit.ts hole closed (C1)
- [ ] Docs/policies rewritten; CI grep-gate on (last)
- [ ] Test coverage defined + human-reviewed
- [ ] Rollback documented

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-13 | Created (status: draft) from the approved-by-direction proposal + the twice-hardened design (reversibility axis; out-of-process signer + pluggable IdP; git-server boundary; staged never-absent-only-doubled migration). NOTE: the proposal's `approved: true` did not record via the UI (a lifecycle-commit bug) — this plan is draft until the approval lands; AI cannot forge it. | NetYeti |
