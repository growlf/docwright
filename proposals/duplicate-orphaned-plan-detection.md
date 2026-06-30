---
title: "Duplicate / Orphaned Plan Detection"
author: NetYeti
author-role: contributor
created: 2026-06-30
category: feature
priority: medium
complexity: medium
estimated_effort: M
tags:
  - governance
  - lifecycle
  - code-over-memory
  - linter
approved: false
created_by: "NetYeti@cluster-llm"
assigned_to: ""
related_to:
  - proposals/formalize-roadmap-sequencing-enforcement.md
  - plans/governance-engine-view-container.md
---

> Triggered by a real incident on 2026-06-30: `plans/governance-engine-view-container.md`
> sat `approved` at 0/9 steps while the work it describes had **already shipped**
> under a different plan (Step 11 of `ui-layout-view-container-refactor`). Two
> plans for one piece of work, with nothing linking them — discovered only by
> manual git archaeology. Per **code-over-memory**, a drift this detectable must
> be caught by a check, not by someone happening to notice.

## Problem

Plans drift from code. The governance-VC case is the archetype:

- An `approved` plan reported `completed_steps: 0` not because work was pending,
  but because the work flowed through a *different* plan — the doc was orphaned.
- Its frontmatter "Resources Required" listed files (`GovernancePanel.svelte`,
  `govVc.ts`, …) that **already existed** in the repo.
- No `related_to` / `supersedes` link tied the two plans together.

None of this was surfaced anywhere. It misrepresents roadmap state, wastes effort
("is this still TODO?"), and — worst — risks deferred ideas being lost when the
stale plan is eventually closed. Relying on humans or AI to notice is the exact
failure mode code-over-memory forbids.

## Proposed Solution

A **drift/duplicate linter** — an MCP tool plus a pre-commit/CI check — that flags
suspicious plans for human review (it never auto-closes anything):

1. **Already-built detection.** An `approved`/`in-progress` plan whose
   `completed_steps` is 0 (or stalled) **and** whose declared target files
   already exist on disk → flag "may already be implemented; verify & reconcile."
2. **Duplicate detection.** Two plans/proposals with overlapping target files or
   near-identical titles and **no** `related_to` / `supersedes` / `proposal_source`
   link between them → flag "possible duplicate; link or supersede."
3. **Surfacing.** Results appear in the Governance VC Lifecycle view and in MCP
   tool feedback (so the next agent/human sees the warning in context), not just
   a CI log.

This is complementary to [[proposals/formalize-roadmap-sequencing-enforcement]]
(which enforces *phase ordering*); this proposal targets *drift and duplication*
within the existing set.

## Verification

- Unit tests over fixture vaults: a 0/N plan whose resources exist → flagged; a
  genuinely-pending plan → not flagged; two unlinked overlapping plans → flagged;
  two properly `supersedes`-linked plans → not flagged.
- The governance-VC case, replayed as a fixture, must flag.

## Out of Scope

- **Auto-closing or auto-superseding** plans — humans decide; the linter only flags.
- Deep semantic duplicate detection beyond file-target and title overlap (future).

## Alternatives Considered

- **Rely on review / periodic manual audit.** Rejected — memory- and
  discipline-based enforcement is precisely what code-over-memory rules out; this
  incident is the evidence it fails.
- **Fold into the roadmap-sequencing linter.** Reasonable, but that proposal is
  about phase gates; drift/duplicate detection is a distinct check. Keep separate,
  cross-linked; merge later if implementation converges.

## Related

- [[policies/core/code-over-memory]] — the principle this enforces
- [[proposals/formalize-roadmap-sequencing-enforcement]] — sibling lifecycle linter (phase gates)
- [[plans/governance-engine-view-container]] — the triggering incident
