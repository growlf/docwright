---
title: "Plan: Verified gate criteria — evidence-backed plan completion, not checkbox theater"
status: draft
author: "NetYeti"
created: "2026-07-13"
created_by: "NetYeti@phoenix"
tags: [planning]
proposal_source: "proposals/approved/verified-gate-criteria-evidence-backed-completion.md"
priority: high
phase: 
automated: guided
waiting_reason:  # Populated when status = waiting-for-user
assigned_to: ["NetYeti"]
related_to: []
depends_on: []
blocks: []
reviewed_by:
reviewed_date:
canceled_date:  # Populated when plan is canceled
cancellation_reason:  # Populated when plan is canceled
template_version: "1.0"
tests_defined: true
tests_human_reviewed: false  # Set to true after human certifies AI-generated tests
verification_type: unit
# Gate fields — populated when a lifecycle gate applies to this document
gate_reviewer:  # Who must review (set automatically by gate rules)
gate_status:    # pending | approved | waived
gate_date:      # Stamped when gate_status is set
gate_note:      # Optional reviewer note
gate_reviews: []  # Phase 1a — array of {reviewer, role, status, date, note}
gate_quorum: 1    # Phase 1a — minimum approvals needed
total_steps: 7
completed_steps: 0
---

# Plan: Verified gate criteria — evidence-backed plan completion, not checkbox theater

## Mode

Plan modes: `off` (mentorship), `guided` (agent drafts, human approves), `full` (autonomous).

**GUIDED MODE — agent drafts each step + verifies against real artifacts; human approves and
holds the tier-2/3 attestations.**

## Overview

### Problem (this is a defect, not an enhancement)

Plan completion is gated on a Phase Gate / Gate Criteria checklist
(`src/dispatch/completion-gate.ts` → `checkCompletionGate`). Today that gate does exactly
one thing: it counts `- [ ]` vs `- [x]` and trusts whoever typed the `x`. That is broken in
two directions, both hit live 2026-07-13 completing `plans/roadmap-date-discipline`:

1. **The gate verifies nothing.** A checked box is taken as truth with zero confirmation the
   underlying claim is satisfied. A human — or an AI — can check a box that isn't true and the
   gate waves it through. A rubber-stamped gate is worse than none: false assurance + a lying
   audit trail. Contradicts *"test verified at every stage"* / *"govern with code, not
   compliance"* ([[policies/core/code-over-memory]]).
2. **The criteria have no write path.** Nothing checks the boxes as work lands (`update_step`
   only touches the steps table) and the UI has no control to check them (`PropertiesPane.svelte`
   only *counts* them into a Complete blocker). Plans dead-end at completion. Tracked as #407.

The real need (BDFL): *"verifying that the human correctly checked them should be happening — the
verification is the part we really need."* The value is whether the claim behind the tick is true.

### Solution — a gate criterion is a verifiable claim (inline-binding grammar)

Criteria stay as the readable body checklist; each carries an optional id + `verify:` binding:

```
## Phase Gate
- [ ] (tests) Validator + CLI unit-tested — verify: tests_pass
- [ ] (status) /status surfaces violations — verify: cmd:status-check
- [ ] (review) Design is sound — verify: human
```

Binding grammar (`verify: <check>`), resolved into tiers (default: machine-derive all that can be):
- **Tier 1 — machine-derived** (`tests_pass`, `steps_done`, `frontmatter:<f>=<v>`, `file_exists:<p>`,
  `cmd:<name>`): the box is *computed* from recorded evidence — auto-checked when it holds,
  auto-unchecked when it stops. Nobody types it; nobody can lie.
- **Tier 2 — human-attested + machine cross-checked** (`human+<check>`): human attests, but blocked
  if the bound check's evidence is false (can't certify "tests reviewed" while `tests_last_result: fail`).
- **Tier 3 — pure judgment** (`human`): safe-guarded by ACL (right role) + audit (who/when/commit) +
  optional second reviewer. Unbound criteria keep today's behaviour (must be `[x]`) — backward compatible.

The agent verifies each criterion against real artifacts and presents evidence beside the box before
sign-off; the validator catches the agent checking something untrue exactly as it catches a human
([[policies/core/mutual-augmentation-cycle]]). Subsumes #407 (its tier-1/UI slice).

## Implementation Steps

> Additive + backward-compatible: unbound criteria behave exactly as today at every step.

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Criterion parser + check registry + tier resolver (PURE core) | New `src/dispatch/gate-criteria.ts`. `parseGateCriteria(text)` → `{id,text,checked,binding}[]` from the Phase Gate/Gate Criteria section (reuse completion-gate's section scan); parse inline `- [ ] (id) text — verify: <check>`. `resolveCriterion(crit, evidence, {fileExists?})` → `{tier,satisfied,reason}`. Checks: `tests_pass`(evidence.tests_last_result==='pass'), `steps_done`(no pending steps), `frontmatter:<f>=<v>`, `file_exists:<p>`(via injected predicate), `cmd:<name>`(reads evidence.gate_evidence[id]), `human`(needs attestation), `human+<check>`(tier2). PURE — no fs/exec/VS Code imports; fs only via injected predicate. Unit tests per check + tier + contradiction. NOT wired yet. | ⏳ Pending |
| 2 | Wire resolver into `checkCompletionGate` (backward-compatible) | `completion-gate.ts` consumes parseGateCriteria + resolveCriterion. Unbound criterion → unchanged (must be `[x]`). Machine-bound → derived from evidence (typed box ignored). `human` → requires a recorded attestation for its id, else block. `human+check` → attestation present AND bound check not false. Evidence = plan frontmatter (tests_last_result, tests_defined, tests_human_reviewed…) + `gate_evidence` map (step 3). MUST keep MCP↔UI parity (extend `test/integration/gate-parity.test.ts`) and existing unbound plans byte-for-byte identical in behaviour. | ⏳ Pending |
| 3 | Evidence recorder — the agent verify-and-record path | MCP tool `verify_gate_criteria(plan)` + `/api/lifecycle/verify-gate` endpoint: for each machine-bound criterion, evaluate its check (tests_pass/steps_done/frontmatter from the plan; file_exists via fs; `cmd:<name>` runs a WHITELISTED named check server-side, captures exit) and record `gate_evidence[id]={satisfied,at:<commit>,ts,detail}` via the sanctioned plan write; return evidence for display. Security: `cmd:` names are a fixed allowlist (e.g. `status-check`, `roadmap-check`) — NO arbitrary shell/interpolation. Tests: records evidence; unknown cmd rejected; tier-1 boxes auto-derive after a run. | ⏳ Pending |
| 4 | Human attestation + cross-check (tier 2/3) — ACL-gated + audited | Tool/endpoint records `gate_attestations[id]={by,role,ts,commit,note}` for `human`/`human+check` criteria; ACL-gated (role ≥ steward via `acl.ts`); writes an append-only `audit_log` entry. Consumed by step 2's resolver; tier-2 blocked if the bound check's evidence is false (contradiction, named in the refusal). Tests: ACL denies unauthorized role; contradiction blocks; audit entry has who/when/commit. | ⏳ Pending |
| 5 | Web UI — evidence beside each box + sanctioned controls (closes #407) | `PropertiesPane.svelte`: render each criterion with tier badge + current state + evidence ("✅ 499 tests @ f9abad9" / "human sign-off — role steward @ commit"); a "Verify" button (calls step-3 recorder) for machine criteria; an ACL-gated "Attest" control for human criteria routed through the sanctioned plan write. Tier-1 read-only/auto. Replace the count-only blocker with a per-criterion "why blocked + evidence" list. Tests: webui unit (render + actions); runtime — drive a plan to Complete with NO markdown edit and NO raw MCP call. | ⏳ Pending |
| 6 | Plan template migration + binding docs | Update the plan template's gate to carry bindings for the standard machine-checkable criteria (`steps_done`, `tests_pass`, `frontmatter:tests_human_reviewed=true`) + document the grammar in the template and `docs/`. Backward compat: existing plans' unbound criteria keep working — do NOT force-migrate. Test: a fresh plan from the template auto-derives its machine criteria; its `human` items require attestation. | ⏳ Pending |
| 7 | Policy atom + docs + capture deferred | `policies/core/evidence-backed-completion.md` (or extend code-over-memory); update AGENTS.md/docs. Capture deferred slices as proposals: CI-status binding; a live "why can't this complete?" panel feeding the roadmap/burndown; optional structured-frontmatter criteria migration. | ⏳ Pending |

## Testing Plan

- **Step 1** — `gate-criteria` unit tests: each check id resolves correctly; tier assignment; a `human+check` contradiction (attested but check false) → not satisfied; unbound criterion → legacy semantics; malformed binding → treated as unbound (safe default).
- **Step 2** — `completion-gate` unit tests: unbound plan behaves exactly as before; a machine-bound criterion completes on evidence with the box left `[ ]`; a `human` criterion without attestation blocks; extend `test/integration/gate-parity.test.ts` (MCP == UI verdict + message).
- **Step 3** — recorder writes `gate_evidence`; unknown `cmd:` name rejected; a tier-1 criterion flips to satisfied after a recorded green run and back after a red one.
- **Step 4** — ACL denies a contributor attesting; a steward attestation records who/when/commit + an audit_log row; a tier-2 contradiction blocks with the reason named.
- **Step 5** — webui unit: criteria render with evidence + correct control per tier. Runtime: a plan with all steps done + tests green drives to Complete from the UI with no markdown edit / no raw MCP call; a contradicted attestation is refused in-UI with the contradiction shown.
- **Step 6** — a plan scaffolded from the template auto-derives its machine criteria; template `human` items require attestation.
- **Step 7** — policy atom test (if applicable); docs/AGENTS consistency.

## Rollback Procedures

- Steps 1–4 are additive: unbound criteria are unaffected. Disable the new behaviour by not adding
  bindings; step 2's resolver falls back to legacy `[x]`-counting for any unbound criterion.
- Step 3/4 recorders can be removed without affecting unbound plans (evidence/attestation maps are
  only read for bound criteria).
- Step 5 UI is purely additive; revert the component change to return to the count-only display.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Resolver changes behaviour for existing (unbound) plans | Low | High | Unbound = legacy path, asserted by gate-parity + a "no bindings ⇒ identical verdict" test |
| `cmd:` verification becomes an arbitrary-exec surface | Low | High | Fixed allowlist of named checks; no shell/interpolation; server-side only |
| Criterion identity drifts when text is edited | Medium | Medium | Identity is the explicit `(id)`, not the text; evidence/attestation key by id |
| Human attestation becomes a new rubber-stamp | Medium | Medium | Tier-2 cross-check blocks contradictions; tier-3 requires ACL role + audited who/when/commit |
| MCP↔UI verdict divergence | Low | High | Single shared `checkCompletionGate`; gate-parity integration test extended |

## Phase Gate

- [ ] (steps) All implementation steps resolved or formally deferred with captured proposals — verify: steps_done
- [ ] (tests) Test coverage defined and green — verify: tests_pass
- [ ] (reviewed) Test coverage human-reviewed — verify: frontmatter:tests_human_reviewed=true
- [ ] (parity) MCP↔UI gate parity holds and existing unbound plans are unchanged — verify: human+tests_pass
- [ ] (runtime) A plan drives to Complete from the Web UI with no markdown edit and no raw MCP call — verify: human
- [ ] (deferred) Deferred ideas captured as proposals before closing — verify: human
- [ ] (rollback) Rollback procedures documented — verify: human

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-13 | Created via Approve (auto-stub from proposals/approved/verified-gate-criteria-evidence-backed-completion.md). | NetYeti |
| 2026-07-14 | Fleshed into 7 additive/backward-compatible steps after settling the design fork: inline-suffix binding grammar (`- [ ] (id) text — verify: <check>`) over structured frontmatter, to avoid migrating every plan. Priority set high. This plan's own Phase Gate dogfoods the new grammar (will be machine-derived once step 2 lands). Steps: parser+resolver (pure) → wire into checkCompletionGate (backward-compat) → evidence recorder (agent verify-and-record, cmd allowlist) → human attestation (ACL + audit + cross-check) → Web UI evidence-beside-box (closes #407) → template migration → policy/docs. | NetYeti |
