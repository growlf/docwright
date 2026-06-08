---
title: "Research: Plan Execution Mode — Naming, Enforcement, and Default"
author: NetYeti
created: 2026-06-07
tags:
  - research
  - governance
  - ai
  - workflow
  - plan-modes
  - ux
complexity: medium
estimated_effort: M
priority: high
approved: true
created_by: NetYeti@phoenix
assigned_to: netyeti
_path: proposals/research-plan-execution-modes.md
consumed_by: plans/research-plan-execution-modes.md
---
---

## Problem

Plans have an `automated` frontmatter field with values `off | guided | full`. The
intent is to describe the execution mode — how much the AI does vs. how much the
human does. But the current naming is actively misleading in three ways: it implies
a binary on/off state, mislabels a positive collaborative mode as a disabled state,
and uses a field name that suggests a quantity slider rather than a named workflow.

**`automated: off`** — sounds like "automation is disabled / nothing is running."
What it actually means is **Mentorship Mode**: the human leads, the AI advises.
This is a *positive, intentional choice* — not the absence of something. Calling
it `off` makes it feel like a degraded state.

**`automated`** as a field name implies a dial for "how much automation." But what
we actually want is an *execution mode* — a named, first-class way of working with
the plan. The field name should reflect that.

**`full`** is the closest to correct — "just get it done" reads as intended. But
"full automation" also sounds risky without a clear model of what the AI is actually
doing, especially since autonomous execution is aspirational and not yet implemented.

**Mentor mode should be the default** — not as a fallback when nothing is set, but
as the explicit, named, preferred mode for human-led work. `off` as a default name
implies we haven't turned something on yet, which undermines adoption of the mode
concept itself.

**Enforcement gap.** Beyond these naming problems, the field is barely enforced.
The linter validates the value, the Properties Pane shows a dropdown, and AI skills
reference it — but no Web UI behavior changes based on it, and the `## Mode` section
in plan bodies is static text that never updates when the field changes. The field
is advisory only, which means it has no teeth.

---

## Research Questions

1. **Naming**: What should the field and its values be called?
   - Should the field be renamed `mode` instead of `automated`?
   - Should `off` become `mentor`, `mentorship`, or `human-led`?
   - Should `guided` stay or become `collaborative`?
   - Should `full` become `autonomous`?

2. **Default**: How do we make mentor mode feel like the intentional default,
   not a fallback?

3. **The `## Mode` section**: Should it be dynamic (auto-rendered from the field)?
   Or removed from the plan body entirely and shown only in the Properties Pane?
   The current Handlebars-style template syntax (`{{#if (eq automated "full")}}`)
   is never evaluated and renders as literal text.

4. **Web UI enforcement**: Should the mode change which action buttons appear?
   - In `mentor`: human-led buttons only, no AI-trigger buttons
   - In `guided`: a "Request AI Draft" button alongside standard controls
   - In `autonomous`: an "Execute" button that kicks off an AI work cycle

5. **AI enforcement**: Is mode an AI self-instruction ("read this and decide how
   to behave") or a runtime constraint ("the system only offers options that match
   the mode")? Currently it is purely self-instruction. Should it become a
   constraint enforced by the MCP tools and Web UI?

6. **`waiting_for_user` flow**: In autonomous mode, the AI sets
   `status: waiting-for-user` at decision points. How does the human know to
   resume? Is there a notification, a dashboard entry, a toast? Currently nothing
   surfaces this state to the user.

7. **Mid-plan mode change**: What happens when mode changes partway through
   execution? Should it be locked once the plan starts, or freely adjustable?

8. **Cross-tool consistency**: Do Claude Code and OpenCode interpret `automated`
   the same way? Almost certainly not — each tool self-regulates independently.
   A shared contract is needed.

---

## What Is Already Enforced (Baseline)

- **Linter**: rejects unknown values (off/guided/full only)
- **PropertiesPane**: dropdown select for the field
- **AI governance boundary**: `approved: true` cannot be set by AI regardless of mode
- **`tests_defined` gate**: blocks completion regardless of mode
- **`approve-proposal` + `create-plan` APIs**: auto-set new plans to `automated: guided`

This baseline reveals the full gap: every enforcement point treats mode identically.
There is no branching behavior anywhere.

---

## Key Observations

- **The rename is a quick win with broad impact.** Changing `off → mentor` (or
  similar) throughout templates, the linter, the dropdown, and AI instructions is
  mechanical and low-risk. It immediately fixes the most visible semantic problem.
- **Enforcement is the hard part.** Making mode actually change Web UI behavior
  requires design decisions about what each mode *prevents* vs. what it *offers*.
  This is where the research is needed.
- **The `## Mode` section is currently dead weight.** It displays static text
  that may be out of sync with the actual field value, and uses template syntax
  that is never evaluated. It should either be replaced with a dynamic UI element
  or removed from the plan body.
- **Autonomous mode is aspirational.** Full AI-driven plan execution does not
  exist today. Pretending it does in the mode description is misleading.
- **Cross-tool consistency requires a contract.** Without a shared specification,
  two AI coding tools will interpret `mode: guided` differently, defeating the
  purpose of having a mode field at all.

---

## Proposed Research Path

1. **Survey comparable tools** — GitHub Copilot Workspace, OpenCode itself,
   Linear Asks, and Cursor — for how they model "how much does the AI do" as a
   user-facing concept. *Deliverable: comparison table with mode models, default
   behavior, and enforcement patterns (1 week).*

2. **Draft naming options and evaluate against user mental models** — Propose 2–3
   candidate name sets for the field and values. Test each against the baseline
   criteria: clarity, default-readiness, and avoidance of false implications.
   *Deliverable: naming recommendation with rationale (1 week, parallel with step 1).*

3. **Sketch Web UI mocks per mode** — For each mode, specify: which buttons appear,
   what is locked/greyed out, what the `## Mode` section shows (if kept), and how
   the human perceives the mode at a glance. Include a mock for mid-mode indicators
   (e.g., "this is a guided plan — you can request an AI draft").
   *Deliverable: annotated mock screenshots or wireframes (1 week).*

4. **Define a minimal enforcement contract** — Specify exactly which behaviors
   branch on mode: MCP tool behavior (e.g., does `update_step` auto-execute?),
   Web UI button visibility, AI instruction preamble injection, and linter validation.
   Document the contract as a single source of truth that both Web UI and AI tools
   can implement against. *Deliverable: enforcement contract document (1 week).*

5. **Synthesize and propose** — Combine the naming recommendation, UI mocks, and
   enforcement contract into a single implementation proposal. Include migration
   path for existing plans (backward-compatible field reading, deprecation warning
   for `off`/`guided`/`full`). *Deliverable: proposal ready for approval (3 days).*

**Total estimated research effort: 3–4 weeks.**

---

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Full autonomous AI plan execution (no human in loop) | Requires significant infrastructure; AI governance boundary must hold |
| Per-step mode (some steps mentor, some autonomous) | Too granular for Phase 2; plan-level mode is sufficient |
| Cross-vault mode synchronization | Enterprise concern; not needed for single-vault deployments |
| Real-time mode indicator in activity feed | Depends on enforcement contract; defer until enforcement is designed |
| Cross-tool enforcement (enforcing mode in Claude Code) | Claude Code is not a DocWright surface; DocWright controls its own Web UI and MCP tools only |

---

## Next Steps

After this research phase completes, the resulting proposal should be reviewed and
approved before any implementation begins. The rename (step 1 from the research
path) can proceed independently of enforcement work if desired, since it is
mechanical and low-risk. All enforcement changes require the enforcement contract
(step 4) to be approved first.

---

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-07 | Created | NetYeti |