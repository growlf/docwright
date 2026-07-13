---
title: "Plan: Retire the global HUMAN_APPROVED gate for a purpose-based, audited authorization model"
status: draft
author: "NetYeti"
created: "2026-07-13"
created_by: "NetYeti@phoenix"
tags: [planning]
proposal_source: "proposals/retire-human-approved-global-gate-for-purpose-based-authorization"
priority: medium
phase: 
automated: guided
waiting_reason:  # Populated when status = waiting-for-user
assigned_to: ["NetYeti"]
# parent_plan: phase-N-overview.md   # filename of parent plan (omit if top-level)
# parent_deliverable: "1"            # row number in parent's Deliverables table
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
# Gate fields — populated when a lifecycle gate applies to this document
gate_reviewer:  # Who must review (set automatically by gate rules)
gate_status:    # pending | approved | waived
gate_date:      # Stamped when gate_status is set
gate_note:      # Optional reviewer note
gate_reviews: []  # Phase 1a — array of {reviewer, role, status, date, note}
gate_quorum: 1    # Phase 1a — minimum approvals needed
---

# Plan: Retire the global HUMAN_APPROVED gate for a purpose-based, audited authorization model

## Mode

Plan modes: `off` (mentorship), `guided` (agent drafts, human approves), `full` (autonomous).

**MENTORSHIP MODE — Human leads, LLM advises**

- Human carries out tasks their own way
- LLM provides SOP compliance checks and safety warnings
- LLM offers suggestions when human asks for help

## Overview

### Summary

Replace the blunt, global `HUMAN_APPROVED=1` blocker with a **purpose-based authorization
model**: policy defines *classes* of action and the authorization each requires; a human's
authorization is an **explicit, scoped, audit-logged grant** (conversational is fine when
explicit) rather than a magic environment variable typed into a commit string. The one
safety property preserved verbatim: **the AI may never *assume, infer, or stretch*
authorization** — it must act only within an explicit grant it can quote, and never widen
that grant's scope. This aligns AI governance with DocWright's own thesis — *govern by
policy + validation + audit trails, not by blocking access* — instead of contradicting it.
BDFL direction, 2026-07-13.

### Review outcome — model revised (2026-07-13, pending bdfl confirmation)

A three-perspective adversarial review (injection red-team · mechanical enforceability ·
guarantee-regression audit) hardened this design. Full analysis:
[[docs/authz-model-hardening-review]]. The direction holds; three corrections change the
model and are folded in below (they await BDFL + BigPickle confirmation):

1. **The strong bar keys on *reversibility*, not "document vs action."** A non-conversational,
   code-verified second factor is required for **every irreversible/outward action**
   (merge-to-trunk, delete, release/tag, external send) — not only governance-doc lifecycle.
   You cannot audit your way out of a `git push --tags`, a delete, or an external send.
2. **Provenance becomes a token, not a prose rule.** The enforceable primitive is a
   **single-use, target-scoped grant token** (a `DW-GRANT` trailer / tool arg, verified +
   consumed). The conversation *triggers* it; the token is the seal. **Second-pass refinement
   (critical):** in DocWright's single-process, single-uid deployment a *file-based* token is
   AI-mintable/forgeable — so the token must be a **secret-keyed signature from an
   out-of-process signer**, verified by *signature*, **never file-presence**. The design
   **decouples two concerns** (BDFL decision, 2026-07-13): a **pluggable identity layer** that
   authenticates the human + confirms operator role (built-in simple auth as the default/no-dep
   baseline; **GitHub OAuth**; maybe Google; external OIDC like **Authentik**, later-defined),
   and a **separate out-of-process signer** (a key custodian the AI process cannot read —
   forge/IdP-agnostic) that mints the signed grant. This closes provenance + scope-stretch +
   replay together. The `AUTH_MODE=none`/store-integrity questions become blocking prerequisites,
   and the real boundary for push/merge/tag is **the git server's branch/tag protection (GitHub
   today) + a capability-scoped bot token** (the Bash-matcher is only defense-in-depth). Full
   analysis + staged plan: [[docs/authz-model-hardening-review]] §Second-pass,
   [[docs/authz-model-implementation-plan-draft]].
3. **Audit hardening is a blocking prerequisite** (real actor attribution, fail-closed on
   write error, append-only/hash-chained) — the current audit sink can't attribute and
   swallows errors, so "audit-proof" isn't yet true.

The review also surfaced a **pre-existing security hole independent of this proposal**
(`git-commit.ts` stamps `HUMAN_APPROVED:'1'` on every UI commit; `AUTH_MODE=none` synthesizes
an admin) — filed separately, not blocked on this.

### Settled decisions (bdfl, 2026-07-13)

1. **Direction approved:** retire the global `HUMAN_APPROVED=1` gate; replace with the
   purpose-based, audited authorization model below. (Framing confirmed: protect against
   *assumed/stretched* authorization, not against *conversational* authorization.)
2. **Governance-doc lifecycle keeps a required second factor** — an explicit out-of-band
   UI action, never collapsible into a conversational grant. The strongest bar stays on
   approvals-of-record (`approved`, `completed`, `gate_status`).
3. **Auth architecture = pluggable identity + separate out-of-process signer** (BDFL,
   2026-07-13). Identity is a **pluggable IdP layer**: a **built-in simple auth** (default,
   no external dependency — also the answer to the solo-local case), **GitHub OAuth**, maybe
   **Google**, and a pluggable **external OIDC** provider (e.g. **Authentik**, defined later).
   The grant **signer is a separate, out-of-process key custodian** (the AI process cannot read
   the key), IdP-agnostic — that is the real security boundary. NOT coupled to any one forge
   (correcting an earlier over-recommendation of Forgejo; the deployments actually run on GitHub,
   and the engine is deliberately git-server-agnostic).

*Provenance question — now answered by review:* a prose rule ("grants only from the live
human") is **not** strict enough (a hook can't distinguish it from injected text). Resolved
via the server-minted grant **token** (Review Outcome #2) — provenance becomes a checkable
property, not AI self-restraint.

*Open for BDFL/BigPickle:* confirm the three model revisions in the Review Outcome
(reversibility axis · token primitive · audit-hardening-first), and the `AUTH_MODE=none`
policy call (whether governance transitions are permitted at all in single-user local mode).

### Problem statement

`HUMAN_APPROVED=1` is a global, binary gate: certain governance mutations (setting
`approved: true`, `status: completed`, `gate_status: approved/waived`) require the literal
string `HUMAN_APPROVED=1` in the command, which the AI is forbidden to generate — the human
must type it and run the command themselves. It is enforced in a pre-commit/hook layer.

Three problems:

1. **It contradicts DocWright's own security thesis.** `mutual-augmentation-cycle` states:
   *"Safety comes from validation + audit trails + gates, not from blocking access.
   Restriction-based safety is fragile."* A global env-var hard-block **is** restriction-
   based safety — the exact pattern the policy warns against. DocWright's AI-governance
   mechanism should be the reference implementation of policy+audit governance, not its
   loudest exception.
2. **It is context-blind and blunt.** The gate knows nothing about *what* is being approved
   or *why*. It cannot distinguish a trivial reversible edit from an irreversible outward
   action; it applies one crude ritual to a whole class. This produces friction that pushes
   work off the sanctioned surfaces (the very failure mode `mutual-augmentation-cycle`
   predicts) without improving the audit record.
3. **It confuses two different things.** "Did a human bless this *document's* lifecycle
   transition?" (approval-of-record, highest audit stakes) and "May the AI perform this
   *action*?" (merge/delete/release) are different questions with different risk profiles.
   The single gate treats them identically. (Correction per review: DocWright code does
   **not** currently gate action-authorization for merge/delete/release at all — those are
   OpenCode-runtime behavior outside this repo, i.e. currently *ungoverned*. So this model
   *formalizes* governance over them for the first time — a net increase, not a loosening —
   for the reversible classes; the correction in point 1 of the Review Outcome ensures the
   irreversible ones gain a real bar rather than a conversational one.)

### The invariant to preserve (the hinge)

The risk this mechanism exists to prevent is **not** "a human authorizes something in
conversation." It is **the AI assuming authorization, inferring it from ambiguity, or
stretching a narrow grant into a broader action.** The redesign must make authorization:

- **Explicit** — a direct, unambiguous human instruction to do the specific thing.
- **Scoped** — bounded to the named action/target; the AI must not extend it to adjacent
  or follow-on actions ("approved X" never implies X′).
- **Attributable + logged verbatim** — recorded on the audit trail with who/when/what, in
  the human's own words, so any overreach is detectable and revocable after the fact.
- **Un-assumable** — absent an explicit grant, the answer is no. The AI must *quote the
  grant it is acting under*; if it cannot quote one, it may not act.

This is the BDFL's own phrasing — "you may not *assume* my authorization." Human and AI
agree on the safety property; the change is purely the *enforcement mechanism* (crude
global env var → policy + explicit audited grant).

### Security implications

This proposal **loosens an AI restriction**, so it demands a rigorous, honest security
analysis — and independent review (the author of this section is the restrained party).

- **What the current gate protects:** the AI unilaterally advancing governance state
  (completing plans, approving proposals, waiving gates) without genuine human intent —
  via bug, misalignment, or prompt injection.
- **Preserved by the replacement** *iff*: gated classes default-deny, the grant is explicit
  + scoped + quoted, the highest-stakes transitions still require a deliberate recorded
  human act (optionally a second factor), and everything is logged + revocable.
- **New risk — grant misinterpretation/stretch.** Mitigation: "quote the grant, never widen
  scope"; policy defines classes so scope is legible; audit makes overreach detectable.
- **New risk — injected/forged grants.** A grant must originate from the **authenticated
  live human operator**, never from tool output, file contents, recalled memory, or an
  untrusted transcript segment (any of which an attacker could control). This is a hard
  rule and itself a security *improvement* over an env var (which says nothing about
  provenance).
- **The "un-fakeable keystroke" is a myth on the primary surface (review correction).** The
  env var is *not* a human act the AI can't fake today: `src/webui/src/lib/server/git-commit.ts`
  stamps `HUMAN_APPROVED:'1'` onto **every** UI commit, and `AUTH_MODE=none` (default)
  synthesizes an admin. So the replacement is not trading a hard keystroke for something
  softer — it's replacing unverified trust with a **verifiable** one. The real un-fakeable
  act is the **server-minted grant token** (Review Outcome #2): issued only by a genuine
  authenticated human action (UI click / CLI grant), recorded server-side, single-use,
  target-scoped — the AI can relay it but cannot mint it.
- **Second factor for the whole irreversible/outward class + governance docs** (revised): the
  token-backed, non-conversational factor covers `approved`/`completed`/`gate_status` **and**
  merge-to-trunk / delete / release-tag / external-send. The dividing line is reversibility.

### Scope of change

- Policy: rewrite `ai-governance-boundaries` around the action-class model; update
  `workflow-layer-governance`; cross-link `mutual-augmentation-cycle` as the rationale.
- Hooks: remove `HUMAN_APPROVED` handling from the git hooks / PreToolUse layer; implement
  default-deny + grant-check for the gated classes; keep git-native format/placement checks.
- Dispatch/MCP: the `transition_to_*` / approval tools consume + log a grant instead of an
  env var.
- Docs: purge `HUMAN_APPROVED=1` from CLAUDE.md, AGENTS.md, and command examples; document
  the grant model + the quote-your-authorization rule.
- Runtime classifier: align its action-authorization with the same action-class policy so
  the two mechanisms stop diverging.

### Verification

- No `HUMAN_APPROVED` reference remains in hooks, policy, or docs (grep gate in CI).
- A gated action **without** an explicit grant is denied (test the default-deny path).
- A gated action **with** an explicit, in-scope grant proceeds **and** writes an audit entry
  quoting the grant; an out-of-scope extension of that grant is still denied.
- Governance-doc lifecycle transitions still require the top-class grant **and the required
  second-factor UI action**; a conversational grant alone is insufficient for this class,
  and the AI cannot self-advance a plan/proposal.
- Injected/file-borne "grants" are rejected (provenance test).

### Risks / tradeoffs

| Risk | Mitigation |
|------|------------|
| Loosening reads as "AI can now self-approve" | Default-deny + explicit-scoped-quoted grant + audit; governance-doc class keeps the strongest bar |
| Grant scope-creep by the AI | "Quote it, never widen it"; class-scoped policy; audit review |
| Prompt-injection forged grants | Grants only from the authenticated human channel; never from tool/file/memory |
| Bigger blast radius than an env var during migration | Stage it: policy + audit primitive first, enforcement swap second, remove env var last, behind tests |

### Multi-perspective review

Per `multi-perspective-review`, and because this changes a **core security policy** authored
in part by the restrained party (the AI), this proposal must get **BigPickle's and the
BDFL's** independent review before any enforcement code changes. The AI's endorsement of
loosening its own restraints is explicitly discounted.

### Related

- [[policies/core/ai-governance-boundaries]] — the policy being rewritten.
- [[policies/core/workflow-layer-governance]] — where mutations are gated today.
- [[policies/core/mutual-augmentation-cycle]] — the thesis this realigns to.
- [[policies/core/code-over-memory]] — enforce the new model in code, not memory.


## Implementation Steps

> When marking a task ✅ Complete, update every step row in this table
> to reflect what was actually built. Stale ⏳ rows mislead reviewers.

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | | | ⏳ Pending |

## Testing Plan



## Rollback Procedures



## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| | | | |

## Phase Gate

- [ ] All implementation steps resolved (delivered or formally deferred with captured proposals)
- [ ] Test coverage defined and human-reviewed (`tests_human_reviewed: true`)
- [ ] Deferred ideas captured as proposals before closing (see [[policies/core/capture-deferred-ideas.md]])
- [ ] Rollback procedures documented
- [ ] Risk assessment completed

## Testing Plan

### Step Verification

- [ ] All implementation steps complete and outcomes verified

### Integration & Regression

- [ ] Existing tests pass without modification (`npm test`)
- [ ] TypeScript compiles cleanly (`npm run typecheck`)
- [ ] Plan: Retire the global HUMAN_APPROVED gate for a purpose-based, audited authorization model functionality works end-to-end

### Gate Criteria

- [ ] `tests_defined` set to `true` in frontmatter
- [ ] Human reviewer has verified step outcomes above
- [ ] No regressions introduced to adjacent workflows

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-13 | Created | NetYeti |
