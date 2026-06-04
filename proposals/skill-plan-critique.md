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

This is multi-perspective review applied to plans — code-enforced, not
discipline-enforced. The skill **must work with Claude, OpenCode (BigPickle),
and any other AI tool** — no single model lock-in.

## Proposed Solution

**Architecture: standalone script + AI wrapper.**

Logic lives in `scripts/critique-plan.js`. Any AI tool invokes the same script.
No AI-specific code in the script itself. This follows the established rule:
*"Skills must be tool-agnostic. Put executable logic in standalone scripts."*

```
scripts/critique-plan.js         ← tool-agnostic context gatherer + prompt builder
.claude/skills/critique-plan.md  ← Claude Code wrapper
opencode.json / shell             ← OpenCode / any other AI wrapper
```

### What the script does (`scripts/critique-plan.js`)

Pure context-gathering — **no AI reasoning in the script**:

1. Reads the target plan file
2. Resolves all `proposal_source:` files — records which exist, which are missing
3. Reads downstream phase plans (`depends_on` reverse lookup)
4. Reads core policies from `policies/core/`
5. Outputs a **structured context block** any AI can consume:

```
=== PLAN CRITIQUE CONTEXT ===
Plan: plans/phase-2-foundation.md
[full plan content]

=== REFERENCED PROPOSALS ===
[content of each proposal_source: file, or "⚠️ FILE NOT FOUND: path"]

=== DOWNSTREAM PLANS ===
[plans that list this plan in depends_on]

=== CORE POLICIES ===
[bugs-before-features, code-over-memory, keep-good-ideas, multi-perspective]

=== CRITIC QUESTIONS (answer for each deliverable) ===
1. Specific enough to know when done?
2. Most likely failure modes?
3. Missing dependencies that don't exist yet?
4. Better existing tools or approaches?
5. What breaks in later phases if this is done wrong?
6. Already done (plan is stale)?
7. Severely underestimated?

Severity: 📝 note | ⚠️ warn | 🚫 block
Format each finding as:
### [Deliverable or topic] [severity]
- **Finding:** [specific problem]
- **Action:** [what to do]
- **Resolution:** *(leave blank — author fills in when addressed)*
```

### Using with Claude Code

```
/critique-plan plans/phase-2-foundation.md
```

The `.claude/skills/critique-plan.md` skill:
1. Runs `node scripts/critique-plan.js [path]`
2. Passes the output to the Agent tool with the adversarial instructions
3. Presents findings to the human for review
4. On approval: writes `## Critical Review` section to the plan, commits
   with `HUMAN_APPROVED=1`

### Using with OpenCode (BigPickle or any configured model)

```bash
node scripts/critique-plan.js plans/phase-2-foundation.md
```

Paste or pipe the output into any OpenCode session. The context block and
critic questions are self-contained — any model sees exactly what to do.
BigPickle as `docwright-critic` is the ideal second opinion since it provides
genuine model diversity.

### Using with any other AI

```bash
node scripts/critique-plan.js plans/phase-2-foundation.md | your-llm-cli
# or paste into any chat interface
```

No lock-in. The script output is plain text. The critic questions are embedded
in the output itself.

### Human approval is required

Findings are always presented for human review before being written to the plan.
The human can edit, reject, or accept each finding. Nothing is committed without
`HUMAN_APPROVED=1`. This preserves *"the human is always the synthesizer"* from
`policies/core/multi-perspective-review.md`.

### Trigger points

- **Manual:** `/critique-plan [plan-path]` in Claude Code, OR
  `node scripts/critique-plan.js [plan-path]` piped to any AI
- **Prompted (Phase 3):** Web UI prompts when a proposal is added to `proposal_source:`
- **CI (deferred):** See [[proposals/skill-plan-critique-ci.md]]

### Integration with phase gate

When the phase gate fires, the reviewer is asked:
> "Does the Critical Review section have any unresolved ⚠️ warn or 🚫 block
> items (no Resolution: filled in)?"

If yes, the gate does not pass until they are resolved or explicitly waived.

### Output format

```markdown
## Critical Review — Open Questions Before Starting

*Reviewed [date] by /critique-plan. Resolve or explicitly accept each
⚠️ warn and 🚫 block before the deliverable begins.*

### [Deliverable or topic] ⚠️ warn
- **Finding:** [specific problem]
- **Action:** [what to do about it]
- **Resolution:** *(fill in when addressed)*
```

Severity:
- **📝 note** — worth considering; non-blocking
- **⚠️ warn** — likely to cause problems; address before starting
- **🚫 block** — must resolve before this deliverable can begin

## Out of Scope

| Idea | Why deferred | Deferred proposal |
|------|-------------|-------------------|
| CI trigger (headless) | Requires headless AI invocation; not stable yet | [[proposals/skill-plan-critique-ci.md]] |
| Auto re-critique on every save | Too noisy | Post-launch |
| Severity auto-escalation over time | Post-launch | — |

## Critical Review — This Proposal Applied to Itself

*Self-critiqued using its own standard. 6 findings, all resolved:*

### Skill was Claude-only ⚠️ warn — RESOLVED
- **Finding:** Original design used Claude Code Agent tool directly; unusable
  from OpenCode, BigPickle, or any other model.
- **Action:** Move logic to `scripts/critique-plan.js`; all AI tools call the
  same script. Skill files are thin wrappers only.
- **Resolution:** Architecture revised — script + wrapper pattern throughout.

### `docwright-critic` is OpenCode, not Claude Code ⚠️ warn — RESOLVED
- **Finding:** Original proposal conflated OpenCode agent personas with Claude
  Code agents. These are different systems.
- **Action:** Skill uses Claude Code Agent tool with the adversarial prompt.
  OpenCode users pipe the script output to their configured agent.
- **Resolution:** Usage sections clearly separate Claude Code vs OpenCode paths.

### Auto-commit without HUMAN_APPROVED violates governance ⚠️ warn — RESOLVED
- **Finding:** Original design auto-committed findings. Our pre-commit hook
  requires `HUMAN_APPROVED=1` for governance documents.
- **Action:** Skill presents findings for review; commits only on human approval.
- **Resolution:** Human approval step is now explicit throughout.

### CI trigger not currently possible 📝 note — RESOLVED
- **Finding:** "CI triggers the skill via GitHub Actions" requires headless AI
  invocation that doesn't exist in stable form.
- **Action:** Defer CI trigger to a separate proposal; ship manual skill first.
- **Resolution:** Explicitly deferred with own proposal.

### No staleness handling ⚠️ warn — RESOLVED
- **Finding:** When a plan changes substantially, old findings become stale.
  No mechanism to invalidate them.
- **Action:** Add `Resolution:` field per finding. Phase gate checks for
  empty Resolution fields on warn/block items.
- **Resolution:** Resolution field in output format; phase gate integration defined.

### No quality gate on agent output 📝 note — RESOLVED
- **Finding:** Agent output varies in quality; hallucinated findings would
  pollute plans.
- **Action:** Human approval step is the quality gate.
- **Resolution:** Explicit in the design.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created | NetYeti |
| 2026-06-04 | Self-critiqued; 5 issues resolved | NetYeti |
| 2026-06-04 | Redesigned for tool-agnosticism: script + wrapper, works with Claude AND OpenCode AND any AI | NetYeti |
