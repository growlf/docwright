---
title: "Plan generator (approve → plan) dumps the whole proposal, mangles frontmatter, and mints an unreviewed 'approved' plan"
status: open
author: NetYeti
author-role: contributor
created: 2026-07-01
category: bug
priority: high
complexity: medium
estimated_effort: M
tags:
  - webui
  - lifecycle
  - plan-generation
  - governance
  - data-integrity
created_by: "NetYeti@cluster-llm"
assigned_to: ""
milestone: future
---

> Found by dogfooding on 2026-07-01 while approving the urgent umbrella proposal
> [[proposals/separate-dev-tracking-milestones-and-beta-channel]] (GitHub #68) via the
> Web UI Approve button. The approve flow itself works (sets `approved: true`, moves the
> proposal to `proposals/approved/`, wires `consumed_by:`, and generates a plan) — but the
> **generated plan** has eight distinct defects, two of them dangerous because the output
> looks authoritative and is stamped `approved`.

## Problem

Clicking **Approve** on a proposal auto-generates a plan at
`plans/<proposal-slug>.md`. The generated plan (observed:
`plans/separate-dev-tracking-milestones-and-beta-channel.md`) is broken in several ways.

### High severity — wrong content wearing an authoritative badge

1. **The entire proposal is pasted into `## Overview`.** ~130 lines are copied verbatim,
   including a duplicate H1 title, a `## Overview` → `### Overview` nesting glitch, and all
   the proposal's own sections (Discussion, Problem Statement, Alternatives, Future). The
   file is "the whole proposal, then a plan."

2. **Generated steps/tests re-invent details that contradict the source proposal.** The
   generator appears to re-derive from the proposal's *summary* rather than its detailed
   Implementation / bootstrap sections, and drifts:
   - Step 1 verification asserts *"a PR that changes only runtime code is sorted to
     `governance`"* — **backwards**. The proposal's core sorting test is *diff → code-issue*.
   - Invents a `kind: issue` frontmatter field and an `opencode release --channel beta` CLI
     that do not exist.
   - A risk-table row proposes *"auto-derive milestones … no new metadata,"* which
     **directly contradicts** the proposal's explicit `milestone:` frontmatter-is-truth
     design.

3. **The plan is auto-stamped `status: approved`** even though its body is fresh,
   human-unreviewed AI output and `tests_defined: false`. Approving the *proposal* mints an
   *"approved" plan* whose contents nobody vetted — an approval the human never actually
   gave to this content. **Fix: approve-to-plan should create the plan as `draft` (or
   `needs-review`), never `approved`.** (This is the immediate governance hole; #68's own
   plan is being reset to `draft` by hand as a stopgap.)

### Medium severity — frontmatter fidelity

4. **`priority` is not inherited** — the source proposal is `priority: high`; the generated
   plan is silently `priority: medium` (the default).
5. **`tags` is flattened to a scalar string** (`tags: governance, process, …`) instead of a
   YAML list, diverging from the schema every other plan uses.
6. **Structured fields are missing:** `phase`, `total_steps`, `completed_steps`, `mode`,
   `template_version`, and the gate fields are absent, so progress/health tooling can't count
   the plan cleanly.

### Low severity — markdown

7. **Duplicate `## Testing Plan` heading** emitted back-to-back.
8. **Malformed rollback table** — a 2-column header with a 3-column separator row
   (`|---|---|---|`).

## Impact

An "approved" plan that contradicts its own approved proposal is worse than no plan: it is
authoritative-looking, mis-specifies the work (e.g. the inverted sorting test), and would
mislead whoever executes it. Combined with the premature `approved` status, it can carry
incorrect requirements straight past the human review that approval is supposed to represent.

## Proposed Fix

- **Never emit a proposal body dump.** Generate a real plan skeleton (steps table, testing
  plan, rollback, risk) and link back to the proposal for the *what/why*; do not inline it.
- **Prefer the proposal's own Implementation / bootstrap sections** as the step source when
  present, instead of re-deriving from the summary. If steps can't be derived confidently,
  emit `⏳ Pending` placeholders — never invent fields/CLIs.
- **Create the plan as `draft`/`needs-review`, not `approved`.** Approval of the proposal is
  not approval of freshly generated plan content.
- **Inherit frontmatter faithfully:** `priority`, `tags` (as a list), and populate
  `phase`/`total_steps`/`completed_steps`/`mode`/`template_version`/gate fields from the
  plan template.
- Fix the duplicate `## Testing Plan` header and the rollback table column count.

## Verification

- Approving a proposal produces a plan whose Overview is a short summary + link, not the
  pasted proposal.
- Generated plan `priority`/`tags` match the source proposal; `tags` parses as a list.
- Generated plan `status` is `draft`; `total_steps` reflects the steps table row count.
- No invented fields/CLIs; no step contradicts the source proposal (spot-check the sorting
  test direction).
- Markdown lints clean (single Testing Plan header; well-formed tables).
