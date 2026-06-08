---
title: "Plan Execution Mode — Web UI Mocks Per Mode"
status: concluded
question: "For each mode, which buttons appear, what is locked/greyed, and how does the human perceive mode at a glance?"
conclusion: recommends
author: NetYeti
created: 2026-06-08
author-role: contributor
tags:
  - research
  - plan-modes
  - ux
  - web-ui
linked_proposals:
  - proposals/approved/research-plan-execution-modes.md
related_research:
  - research/plan-execution-mode-naming.md
  - research/plan-execution-mode-tool-survey.md
---

# Plan Execution Mode — Web UI Mocks Per Mode

## Questions Explored

- Which buttons/actions appear per mode in the Properties Pane and document header?
- What is disabled or greyed per mode?
- What does the `## Mode` section in plan bodies show (or should it be removed)?
- How does the human perceive current mode at a glance?
- What mid-mode indicators are needed?

## Mode Indicator — Global

A persistent mode badge appears in the Properties Pane header and plan document header.
Human-readable labels (from the naming recommendation):

```
[ Mentor (human-led)   ▾ ]    ← dropdown selector in Properties Pane
```

Badge colours (consistent with existing status colours):
- `mentor` → neutral/grey — calm, advisory
- `guided` → blue — active collaboration
- `autonomous` → amber — elevated AI activity; draws attention without alarm

The mode badge is visible at all times when a plan is open. Clicking it opens the
mode selector dropdown. Mode change takes effect immediately (no page reload needed).

---

## Mode: mentor (human-led)

**Philosophy:** The AI is your advisor. You execute every step. The AI cannot write
to the plan without your explicit action.

### Properties Pane — Action Buttons

| Button | State | Behaviour |
|--------|-------|-----------|
| ✨ Improve | Visible, enabled | Opens AI suggestion panel (read-only diff) — human clicks "Apply" to accept, "Dismiss" to reject. AI does NOT write directly. |
| ⚡ Plan Review | Visible, enabled | Opens analysis panel: findings listed with one-click "Create proposal" per finding. No direct plan mutations. |
| ▶ Execute Step | Hidden | Not shown — execution is always human. |
| Mark Step ✅ | Visible, enabled | Human marks steps complete manually via the step table. |
| Change Status | Visible, enabled | Human changes `status` field (approved → in-progress → completed). |

### Mid-Mode Indicator

When AI chat produces a write suggestion (plan text, step update), the Web UI
intercepts and shows a staging banner:

```
┌─────────────────────────────────────────────────────┐
│  ⚠ Mentor mode: AI suggested a change.             │
│  [Review diff]  [Apply]  [Dismiss]                  │
└─────────────────────────────────────────────────────┘
```

AI write tool calls (`write_plan`, `update_step`, `append_history`) are blocked
at the Web UI layer when the plan is in mentor mode and the caller is identified
as an AI session. The diff is staged; the human applies it.

### `## Mode` Section in Plan Body

Remove the `## Mode` section from plan templates. Mode is a frontmatter field, not
body content. The Properties Pane badge replaces it as the visible indicator.
Existing plans with a `## Mode` section: the linter issues a cleanup suggestion;
the section is harmless but redundant.

---

## Mode: guided (collaborative)

**Philosophy:** You direct, the AI drafts. The AI can produce staged changes for
your review, but does not commit anything autonomously. The human clicks Apply.

### Properties Pane — Action Buttons

| Button | State | Behaviour |
|--------|-------|-----------|
| ✨ Improve | Visible, enabled | AI writes directly into a staging view — shows diff, human clicks "Apply" or edits the diff before applying. |
| ⚡ Plan Review | Visible, enabled | Analysis + suggested step-status updates staged for human review. One-click "Apply all" or per-item accept/reject. |
| ▶ Execute Step | Visible, enabled | AI drafts the step action (code, doc, command) in a panel — human reviews and triggers. |
| Mark Step ✅ | Visible, enabled | Human or AI (with human confirmation) marks steps complete. AI presents "Mark complete?" prompt after executing. |
| Change Status | Visible, enabled | Human changes status. AI may suggest status transitions but cannot apply them. |

### Mid-Mode Indicator

Guided mode shows a persistent "AI has staged changes" indicator when anything is
in the staging queue:

```
┌─────────────────────────────────────────────────────┐
│  💬 Guided: 2 staged changes awaiting review.       │
│  [Review queue]                                     │
└─────────────────────────────────────────────────────┘
```

AI write tool calls are intercepted and placed in a staging queue rather than
applied immediately. The queue is per-session and clears on page reload.

---

## Mode: autonomous (AI-led)

**Philosophy:** The AI executes. You review at governance gates. Every AI write
carries an `ai-last-action:` audit stamp. Governance fields (`approved`,
`gate_status`, `status: completed`) always require human action regardless of mode.

### Properties Pane — Action Buttons

| Button | State | Behaviour |
|--------|-------|-----------|
| ✨ Improve | Visible, enabled | AI writes directly to the document. Change is committed with `ai-last-action:` stamp. |
| ⚡ Plan Review | Visible, enabled | AI updates step statuses directly. Each update carries audit stamp. |
| ▶ Execute Step | Visible, enabled | AI executes step actions autonomously. Human sees live progress. |
| Mark Step ✅ | AI-driven | AI marks steps complete after execution. Human can override. |
| Change Status | Human-only | `status: completed` and governance fields always require human. Amber badge reinforces this. |

### Governance Gate Hardblock

Regardless of mode, these fields are ALWAYS human-only (Web UI disables them for
AI callers; MCP server rejects AI writes):

- `approved: true`
- `gate_status: approved | waived`
- `status: completed`
- `HUMAN_APPROVED=1` commit flag

The autonomous mode amber badge includes a persistent reminder:

```
┌─────────────────────────────────────────────────────┐
│  🤖 Autonomous mode — AI is executing.             │
│  Governance gates always require human approval.    │
└─────────────────────────────────────────────────────┘
```

### Audit Trail

Every AI write in autonomous mode appends to Document History automatically:
```
| 2026-06-08 | ai-last-action: update_step step 3 → ✅ Done | AI (autonomous) |
```

---

## `## Mode` Section — Final Recommendation

Remove from all plan templates. The frontmatter `mode:` field + Properties Pane
badge is the single source of truth. The section in plan bodies is redundant
and creates a maintenance burden (it goes stale as mode changes).

Linter behaviour: emit a cleanup suggestion (not a block) for plans still containing
`## Mode` or `## Execution Mode` sections.

## Conclusion

Three-mode UI model is viable with staged write interception as the core mechanism:
- **mentor:** all AI writes → staging panel → human applies
- **guided:** AI writes → staging queue → human reviews queue → applies
- **autonomous:** AI writes directly → audit stamp; governance gates always human

The Properties Pane badge + mode-aware button states give the human a clear,
persistent signal of which mode is active. No `## Mode` section in plan bodies needed.

Next step: Step 4 — define the enforcement contract precisely.
