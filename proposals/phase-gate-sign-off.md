---
complexity: high
title: "Lifecycle Gates — Checkpoint Sign-off Before Transition"
author: NetYeti
created: 2026-06-03
tags:
  - governance
  - lifecycle
  - gates
  - dispatch
  - profile-engine
  - dog-fooding
approved: false
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
---

## Problem

DocWright tracks work through lifecycle states — phases complete, plans
transition, proposals get approved, policies go active, devices get
decommissioned. Currently nothing enforces a human checkpoint before any of
those transitions happen. Work moves forward because the tooling allows it, not
because the responsible person verified it was ready.

This gap was discovered directly while using DocWright to manage its own
development: Phase 1 plans all showed `completed`, the status page looked
finished, but the assigned developer still had unresolved UI critiques. The
tooling said "done" when the human said "not yet."

That is a governance failure. DocWright is a governance layer. It should prevent
this in every organization that adopts it — and it must enforce it on itself first.

## Proposed Solution

A **lifecycle gate** mechanism: a configurable checkpoint on any lifecycle
transition that requires a designated reviewer to either sign off or open a
remediation cycle before the transition is allowed to complete.

Gates are not special-cased for phases. They are a general primitive, configured
per-profile and per-transition, applicable anywhere in the lifecycle: phase
completions, plan sign-offs, proposal approvals, policy activations, status
promotions, sprint reviews — any point where "checked by a human" is the right
answer.

### Gate definition in profile.json

Each profile defines which transitions require gates:

```json
"gates": [
  {
    "id": "phase-complete",
    "trigger": "all-plans-in-phase-completed",
    "reviewer_field": "gate_reviewer",
    "blocks": "next-phase-activation",
    "description": "Phase completion sign-off before next phase begins"
  },
  {
    "id": "policy-activate",
    "trigger": "status-transition",
    "from": "draft",
    "to": "active",
    "document_type": "policy",
    "reviewer_field": "gate_reviewer",
    "description": "Policy must be reviewed before going active"
  },
  {
    "id": "plan-complete",
    "trigger": "status-transition",
    "from": "in-progress",
    "to": "completed",
    "document_type": "plan",
    "reviewer_field": "assigned_to",
    "description": "Plan owner confirms completion before closing"
  }
]
```

The `org-operations` profile ships with sensible defaults. Other profiles define
gates appropriate to their domain (e.g. `infra-topology` gates
`active → decommissioned` to require a sign-off before removing a device).

### Gate state on documents

Any document subject to a gate carries gate fields in its frontmatter:

```yaml
gate_reviewer: NetYeti       # who must act
gate_status: pending         # pending | approved | waived
gate_date:                   # stamped when gate_status is set
gate_note:                   # optional reviewer note
```

`gate_status: pending` blocks the transition. `approved` clears it. `waived`
allows a bypass with a mandatory `gate_note` explaining why.

### Reviewer options

When a gate fires, the reviewer is presented with three choices:

**Approve.** The transition is satisfactory. `gate_status: approved`,
`gate_date` stamped. The blocked transition proceeds.

**Critique round.** Not satisfied. The reviewer provides feedback; DocWright
(or the assigned agent) drafts proposals capturing it, creates a remediation
plan, and re-blocks the gate. The transition cannot proceed until the
remediation plan is also completed and the gate is re-triggered.

**Waive.** Exceptional bypass with a mandatory written reason. Logged in
frontmatter for audit. Waives are visible on the status page so they are
never silent.

### Enforcement points

1. **Pre-commit hook** — `scripts/gate-check.ts` detects pending gates on
   any file being committed. Blocks the commit and prints reviewer instructions.
   Hardest to bypass accidentally.
2. **MCP tool** — `docwright_gate_check` callable by any AI agent or the
   Web UI. Returns gate state, reviewer, and available actions.
3. **Status page** — a **Pending Gates** section appears whenever any gate
   is in `pending` state, showing document, reviewer, and action buttons.
   Waived gates appear in a separate audit row.

### Status page integration

```
Pending Gates
──────────────────────────────────────────────────────────
⚠  Phase 1 complete — sign-off required       NetYeti  [ Approve ]  [ Critique round ]
⚠  Policy: data-retention — draft → active    NetYeti  [ Approve ]  [ Critique round ]

Waived Gates (audit)
──────────────────────────────────────────────────────────
⚡  Plan: dispatch-module — completed (waived) "Time pressure; re-review in Phase 3"
```

### Dog-fooding

This proposal was itself discovered via the gap it describes. The first live
gate will be Phase 1 sign-off on DocWright's own Web UI. The reviewer's UI
critique will become the first remediation plan processed through the gate —
validating the full mechanism before it is deployed for any other organization.

Every organization that adopts DocWright gets gates configured for their profile
from day one. The bundled `opencode-instructions.md` files will instruct the AI
to remind contributors that gates exist and to prompt for gate review when
transitions approach.

## Scope

- `profile.json` schema: add `gates` array with trigger, reviewer, and block
  definitions
- `src/dispatch/gates.ts` — gate evaluation engine (pure TS, no VS Code deps)
- Document frontmatter: `gate_reviewer`, `gate_status`, `gate_date`, `gate_note`
- `scripts/gate-check.ts` — pre-commit hook integration
- MCP server: `docwright_gate_check` tool
- Web UI: Pending Gates section on `/status` with approve/waive/critique actions
- All bundled profile `profile.json` files updated with default gate definitions
- All plan and policy templates updated with gate frontmatter fields
- `opencode-instructions.md` for all profiles: instruct AI to surface gate
  requirements when transitions are approached

## Out of scope

Each item below is captured as a deferred proposal for the improvements phase
after launch.

- Multi-reviewer quorum — [[proposals/gates-multi-reviewer-quorum.md]]
- Time-based and scheduled gate triggers — [[proposals/gates-time-based-triggers.md]]
- Retroactive audit of past transitions — [[proposals/gates-retroactive-audit.md]]
- AI-assisted gate preparation (AI surveys scope, human still decides) — [[proposals/gates-ai-assisted-preparation.md]]

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created | NetYeti |
| 2026-06-03 | Broadened from phase-only to general lifecycle gate primitive | NetYeti |
