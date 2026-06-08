---
title: "Plan Execution Mode — Enforcement Contract"
status: concluded
question: "Which behaviors branch on mode, and where is each enforced — Web UI, MCP, linter, or AI preamble?"
conclusion: recommends
author: NetYeti
created: 2026-06-08
author-role: contributor
tags:
  - research
  - plan-modes
  - enforcement
  - mcp
  - web-ui
linked_proposals:
  - proposals/approved/research-plan-execution-modes.md
related_research:
  - research/plan-execution-mode-naming.md
  - research/plan-execution-mode-ui-mocks.md
---

# Plan Execution Mode — Enforcement Contract

## Questions Explored

- Which behaviors branch on mode?
- Where is each behavior enforced: Web UI, MCP server, linter, or AI preamble?
- Is mode a self-instruction to the AI, a system constraint, or both?
- What is the single source of truth for the enforcement rules?

## Core Principle (from tool survey)

> System enforcement over AI self-regulation.

The tool survey finding is definitive: enforcement must come from the system (Web UI
gating, MCP server checks), not from the AI reading a document field and deciding how
to behave. AI preamble injection is a secondary reinforcement layer, not the primary
enforcement mechanism.

---

## Enforcement Table — Complete Contract

| Behavior | mentor | guided | autonomous | Enforcement layer |
|----------|--------|--------|------------|-------------------|
| AI direct write to plan body | ❌ Blocked → staged | ⏸ Staged → queue | ✅ Allowed + audit stamp | Web UI intercept |
| `update_step` MCP tool (AI caller) | ⏸ Staged | ⏸ Staged | ✅ Allowed | Web UI intercept; MCP passes through |
| `write_plan` MCP tool (AI caller) | ⏸ Staged | ⏸ Staged | ✅ Allowed | Web UI intercept; MCP passes through |
| `append_history` MCP tool (AI caller) | ⏸ Staged | ⏸ Staged | ✅ Allowed | Web UI intercept; MCP passes through |
| `set_plan_field` MCP tool (AI caller) | ⏸ Staged | ⏸ Staged | ✅ Allowed | Web UI intercept; MCP passes through |
| `update_plan_status` → `in-progress` | ✅ Allowed (human) | ✅ Allowed | ✅ Allowed | No gate |
| `update_plan_status` → `completed` | ❌ Always human | ❌ Always human | ❌ Always human | MCP hard-block |
| `approved: true` on proposal | ❌ Always human | ❌ Always human | ❌ Always human | MCP hard-block + pre-commit |
| `gate_status: approved/waived` | ❌ Always human | ❌ Always human | ❌ Always human | MCP hard-block + pre-commit |
| `HUMAN_APPROVED=1` commit | ❌ Always human | ❌ Always human | ❌ Always human | Pre-commit env var check |
| ✨ Improve button | Advisory panel | Staging diff | Direct write | Web UI button mode |
| ⚡ Plan Review button | Analysis only | Staged updates | Direct updates | Web UI button mode |
| `ai-last-action:` stamp | Not added | Added to staged | Added on write | MCP server |
| AI preamble injected | "Advise only" | "Draft and stage" | "Execute; gates are human" | Chat panel on plan open |
| Linter: `mode:` field missing | INFO: suggest explicit | INFO: suggest explicit | INFO: suggest explicit | Linter (not a block) |
| Linter: deprecated `automated:` field | WARN: rename to `mode:` | WARN | WARN | Linter |
| Linter: deprecated `off`/`full` values | WARN: use `mentor`/`autonomous` | WARN | WARN | Linter |

---

## Enforcement Layers — Defined

### Layer 1: MCP Server (hard blocks — mode-independent)

The MCP server enforces rules that cannot change regardless of mode. These are
governance invariants, not mode preferences:

```
HARD BLOCKS (all modes):
  - update_plan_status(status="completed") → blocked, return error
  - set_plan_field(field="approved", value="true") → blocked
  - set_plan_field(field="gate_status", value="approved"|"waived") → blocked
  - transition_to_approved() → validates approved=true was set externally
```

The MCP server does NOT enforce the mentor/guided/autonomous mode distinction.
That is the Web UI's responsibility — the MCP server is a headless governance layer
used by both AI and humans. Mode gating happens at the session layer.

### Layer 2: Web UI — Write Intercept

The Web UI is the only layer that knows whether the current session is human or AI,
and which mode the open plan is in. It intercepts MCP write tool calls made from
an AI chat session and routes them based on mode:

```
if (sessionIsAI && plan.mode === 'mentor'):
  → intercept write → staging panel → await human Apply/Dismiss

if (sessionIsAI && plan.mode === 'guided'):
  → intercept write → staging queue → show pending indicator → await human Review

if (sessionIsAI && plan.mode === 'autonomous'):
  → pass through → MCP executes → add ai-last-action: stamp
```

Human-initiated writes (user clicks button in UI) always pass through regardless of
mode — a human clicking "Mark step complete" is never blocked.

### Layer 3: AI Preamble Injection (secondary reinforcement)

When the chat panel opens on a plan, the plan's `mode:` frontmatter is read and an
instruction is prepended to the system context:

```
mentor:
  "You are in Mentor mode on this plan. Your role is to advise and suggest.
   Do not call write tools (write_plan, update_step, etc.) directly.
   Present suggestions as text and let the human apply them."

guided:
  "You are in Guided mode on this plan. You may draft changes using write tools,
   but they will be placed in a staging queue for human review before applying.
   Present your reasoning alongside each proposed change."

autonomous:
  "You are in Autonomous mode on this plan. You may execute steps and call write
   tools directly. All your writes will carry an ai-last-action: audit stamp.
   Governance gates (approved, gate_status, status: completed) always require
   human action — do not attempt to set them."
```

This is reinforcement, not enforcement. The Web UI and MCP hard blocks are the
authoritative gates. The preamble reduces unnecessary tool call attempts.

### Layer 4: Linter

The linter enforces field correctness, not mode behavior. It:
- Accepts `automated:` as a deprecated alias for `mode:` (WARN level)
- Accepts `off` and `full` as deprecated value aliases (WARN level, shows migration path)
- Treats missing `mode:` as `mentor` (INFO level suggestion to make it explicit)
- Does NOT block commits for wrong values — deprecation warnings only

---

## Mode Self-Instruction vs. System Constraint — Answer

**Mode is both, at different layers, in different strengths.**

| Layer | Type | Strength |
|-------|------|---------|
| Web UI write intercept | System constraint | Hard — AI cannot bypass |
| MCP governance hard blocks | System constraint | Hard — applies to all modes |
| AI preamble | Self-instruction | Soft — reduces unnecessary attempts |
| Linter deprecation warnings | Advisory | Informational |

The tool survey was clear: the primary gate must be the system. The preamble is a
UX optimization that reduces churn (fewer "blocked, please stage" cycles), not the
security mechanism.

---

## Migration: `automated` → `mode`

Existing plans use `automated: off|guided|full`. Backward compatibility rules:

1. **Linter accepts `automated:` with WARN** — existing plans keep working, surface
   the rename as a non-blocking suggestion
2. **Value aliases** — `off` reads as `mentor`, `full` reads as `autonomous` at runtime
3. **Automated migration script** — `npm run migrate:mode-field` does a vault-wide
   `sed`-style replacement: `automated: off` → `mode: mentor`, etc. Idempotent.
4. **Templates updated immediately** — all profile templates and example-vault use
   `mode:` from the moment the plan ships

---

## Conclusion

The enforcement contract has two hard layers (MCP server + Web UI write intercept)
and two soft layers (AI preamble + linter). The hard layers handle security and
governance invariants. The soft layers handle developer experience.

Mode is not a single thing — it is a session-visible property that gates write
behavior at the Web UI, informs AI behavior via preamble, and is validated (not
blocked) by the linter. This layered approach is consistent with DocWright's
"code over memory" principle: system gates enforce, AI guidance advises.

Next step: Step 5 — synthesize naming recommendation + UI mocks + enforcement
contract into a single implementation proposal.
