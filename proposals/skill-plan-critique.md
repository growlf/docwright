---
complexity: medium
title: "Skill: Automated Plan Critique on Creation and Update"
author: NetYeti
created: 2026-06-04
tags:
  - governance
  - ai
  - skills
  - plans
  - automation
  - phase-2
approved: false
created_by: NetYeti@phoenix
assigned_to: NetYeti
related_to:
  - policies/core/multi-perspective-review.md
  - policies/core/code-over-memory.md
---

## Problem

Plans are written optimistically. Deliverables are underspecified. Dependencies
are missing. Failure modes aren't considered. The critique that surfaced these
issues in Phase 1/2 planning was done manually — it should happen automatically
every time a plan is created or updated.

The pattern that worked:
1. Plan is written (or updated)
2. An adversarial agent reads it and asks: how will this fail? what's missing?
   are there better tools? what breaks downstream?
3. Findings are written back into the plan as a "Critical Review" section
4. The author addresses or explicitly accepts each finding before starting

This is multi-perspective review (see `policies/core/multi-perspective-review.md`)
applied to plans — and it should be code-enforced, not discipline-enforced.

## Proposed Solution

A Claude Code **skill** (`/critique-plan`) that:

1. **Takes the active plan file** (current document in the editor, or a path arg)
2. **Spawns a critic agent** (uses the `docwright-critic` persona from `opencode.json`)
   with adversarial instructions:
   - Are deliverables specific enough to know when done?
   - What are the most likely failure modes?
   - What dependencies are missing?
   - Are there better existing tools or approaches?
   - What breaks in later phases if this is done wrong?
   - Are any items already done (plan is stale)?
   - Is anything severely underestimated?
3. **Writes findings back** into the plan under a `## Critical Review` section
4. **Commits** the updated plan with `chore: add critical review to [plan name]`

### Trigger points

- **Manual:** `/critique-plan` skill invoked on any plan file
- **Automatic (future):** Pre-save hook in the Web UI — when a plan is saved
  with a new proposal added to `proposal_source:`, auto-trigger the critique
- **On creation:** When `plans/phase-*.md` is created in a commit, CI triggers
  the skill via a GitHub Actions workflow step

### Agent instructions

The critic agent receives the plan plus:
- All referenced proposals (from `proposal_source:`)
- The current state of referenced files (do they exist? are they complete?)
- The downstream phase plans (what does this plan's completion enable?)
- The core policies (code-over-memory, bugs-before-features, etc.)

It is explicitly instructed to **not be polite about real problems**.

### Output format

The `## Critical Review` section uses a consistent format:

```markdown
## Critical Review — Open Questions Before Starting

*Auto-generated [date]. Each issue must be resolved or explicitly accepted.*

### [Deliverable name] ⚠️ [severity: note|warn|block]
- **Finding:** [what's wrong or missing]
- **Action:** [what to do about it]
```

Severity levels:
- **note** — worth considering, not blocking
- **warn** — likely to cause problems; address before starting
- **block** — must resolve before this deliverable can begin

### Integration with phase gate

The phase gate reviewer prompt is updated to ask:
> "Does the Critical Review section of this plan have any unresolved
> ⚠️ warn or 🚫 block items?"

If yes, the gate does not pass until they are resolved or explicitly waived
with a written reason.

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Automatic re-critique on every save | Too noisy; trigger on proposal additions only |
| Critic votes on deliverable ordering | Scope creep; manual ordering is fine for now |
| Severity auto-escalation over time | Post-launch |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — pattern established during Phase 1/2 planning review | NetYeti |
