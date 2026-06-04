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
3. Findings are written back into the plan as a `## Critical Review` section
4. The author addresses or explicitly accepts each finding before starting

This is multi-perspective review applied to plans — and it should be
code-enforced, not discipline-enforced.

## Proposed Solution

A Claude Code **skill** (`.claude/skills/critique-plan.md`) invoked as
`/critique-plan [plan-file-path]`.

### What it does

1. Reads the target plan file and all files referenced in `proposal_source:`
2. Checks whether referenced files actually exist and are complete
3. Reads downstream phase plans to understand what this plan enables
4. Runs an adversarial agent with a fixed set of questions:
   - Are deliverables specific enough to know when they're done?
   - What are the most likely failure modes?
   - What dependencies are missing (things that must exist first, but don't)?
   - Are there better existing tools or approaches?
   - What breaks in later phases if this is done wrong?
   - Are any deliverables already complete (plan is stale)?
   - Is anything severely underestimated?
5. **Presents findings to the human for review** — does NOT auto-commit
6. If the human approves, writes the `## Critical Review` section to the plan
   and commits with `HUMAN_APPROVED=1`

### Trigger points

- **Manual (Phase 2):** `/critique-plan plans/phase-2-foundation.md`
- **Prompted (Phase 3):** When a proposal is added to a plan's `proposal_source:`
  frontmatter, the Web UI prompts: "Run plan critique for updated proposals?"
- **CI (Phase 3, harder):** Requires a headless Claude Code invocation mode that
  doesn't exist yet — deferred. See [[proposals/skill-plan-critique-ci.md]].

### Output format

```markdown
## Critical Review — Open Questions Before Starting

*Reviewed [date] by /critique-plan. Each ⚠️ warn or 🚫 block item must be
resolved or explicitly accepted with a written reason before the deliverable begins.*

### [Deliverable name or Cross-cutting] ⚠️ warn
- **Finding:** [specific problem]
- **Action:** [what to do about it]
- **Resolution:** *(fill in when addressed)*
```

Severity levels:
- **📝 note** — worth considering; non-blocking
- **⚠️ warn** — likely to cause problems; address before starting this deliverable
- **🚫 block** — must resolve before this deliverable can begin at all

### Human approval is required

The skill shows the findings and asks: "Write these to the plan? (y/n)"
The author reviews, edits if needed, then approves. Findings are not written
without human sign-off. This preserves the "human is always the synthesizer"
principle from `policies/core/multi-perspective-review.md`.

### Integration with phase gate

When the phase gate reviewer prompt fires, it checks:
> "Does the plan's Critical Review section have any unresolved ⚠️ warn or
> 🚫 block items (no Resolution: line)?"

If yes, the gate does not pass until they are resolved or waived with a reason.

## Out of Scope

| Idea | Why deferred | Deferred proposal |
|------|-------------|-------------------|
| CI trigger (headless) | Requires headless Claude Code mode; doesn't exist yet | [[proposals/skill-plan-critique-ci.md]] |
| Auto re-critique when plan changes | Too noisy without quality gate on output | Post-launch |
| Severity auto-escalation over time | Post-launch | — |
| Critic votes on deliverable ordering | Scope creep | — |

## Critical Review — This Proposal Applied to Itself

*This proposal was critiqued using its own standard. Findings:*

### Skill format ⚠️ warn
- **Finding:** The proposal says "a Claude Code skill" but doesn't specify the
  actual `.claude/skills/critique-plan.md` format or content. Skills in this
  codebase are markdown files with specific structure. Without specifying the
  format, the deliverable isn't done until the format is defined.
- **Action:** The skill file must be specified as part of this deliverable.
- **Resolution:** Added to scope: "skill file in `.claude/skills/`"

### `docwright-critic` is OpenCode, not Claude Code ⚠️ warn
- **Finding:** The original proposal said "uses the `docwright-critic` persona
  from `opencode.json`" — but that's an OpenCode agent config. Claude Code
  uses the Agent tool with a prompt, not OpenCode personas. These are different
  systems entirely.
- **Action:** The skill uses Claude Code's Agent tool with the adversarial
  prompt directly. The OpenCode `docwright-critic` persona is separately useful
  for interactive review sessions.
- **Resolution:** Fixed in this revision — skill uses Claude Code Agent tool.

### Auto-commit without HUMAN_APPROVED violates governance ⚠️ warn
- **Finding:** Original proposal said the skill "commits the updated plan"
  automatically. Our pre-commit hook requires `HUMAN_APPROVED=1` for governance
  document changes. An auto-committing skill would either break the hook or
  bypass it.
- **Action:** Skill must present findings for human review before writing.
  Human approves → commit uses HUMAN_APPROVED flow.
- **Resolution:** Fixed — step 5 now explicitly presents findings for review.

### CI trigger isn't currently possible 📝 note
- **Finding:** "CI triggers the skill via a GitHub Actions workflow" requires
  headless Claude Code invocation, which doesn't exist in a stable form.
- **Action:** Defer CI trigger; ship manual skill first; capture CI as a
  separate deferred proposal.
- **Resolution:** CI trigger explicitly deferred; separate proposal created.

### No staleness handling ⚠️ warn
- **Finding:** When a plan changes substantially after a critique, the existing
  `## Critical Review` section becomes stale (findings may be wrong or resolved
  without being marked). The proposal had no mechanism for this.
- **Action:** Add "Resolution:" field to each finding. When a finding is addressed,
  the author writes the resolution inline. The phase gate checks for empty
  Resolution fields on warn/block items.
- **Resolution:** Resolution field added to output format above.

### No quality gate on agent output 📝 note
- **Finding:** The critic agent output varies in quality. It sometimes
  hallucinates dependencies or misreads the codebase. Auto-writing findings
  without review would pollute plans with wrong information.
- **Action:** Human approval step is the quality gate. The author reviews and
  can edit or reject findings before they're written.
- **Resolution:** Human approval step explicit in the design.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — pattern established during Phase 1/2 planning review | NetYeti |
| 2026-06-04 | Self-critiqued using its own standard; 5 findings surfaced and resolved | NetYeti |
