---
title: "Rename plan execution mode: automated → mode, off/guided/full → mentor/guided/autonomous"
author: NetYeti
created: 2026-06-08
tags:
  - plan-modes
  - rename
  - linter
  - web-ui
  - mcp
  - governance
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
research_source:
  - research/plan-execution-mode-naming.md
  - research/plan-execution-mode-tool-survey.md
  - research/plan-execution-mode-ui-mocks.md
  - research/plan-execution-mode-enforcement.md
milestone: backlog
---

## Problem

The `automated` field (values: `off | guided | full`) is misleading and under-enforced:

- `off` sounds like a disabled state — it actually means "human-led, AI advises"
- `full` is vague — "full automation" could mean anything
- `automated` as a field name implies a quantity dial, not a named working mode
- Mode is advisory-only today — the system does not gate AI writes based on it
- The Web UI has no visible mode indicator on plans

Four research documents confirm the problem and design the solution. See
[[research/plan-execution-mode-naming.md]], [[research/plan-execution-mode-tool-survey.md]],
[[research/plan-execution-mode-ui-mocks.md]], [[research/plan-execution-mode-enforcement.md]].

## Proposed Solution

### 1. Rename field and values

| Old | New | Notes |
|-----|-----|-------|
| `automated: off` | `mode: mentor` | Positive reframe — AI advises, human executes |
| `automated: guided` | `mode: guided` | Value unchanged; field renamed only |
| `automated: full` | `mode: autonomous` | Industry-standard term for AI-led execution |

### 2. Backward compatibility

- Linter accepts `automated:` as a deprecated alias for `mode:` (WARN, not block)
- Linter accepts `off` and `full` as deprecated value aliases (WARN, migration hint shown)
- Missing `mode:` field treated as `mentor` at runtime (INFO suggestion to make explicit)
- `npm run migrate:mode-field` does vault-wide automated rename — idempotent

### 3. Web UI enforcement (two hard layers)

**Layer 1 — Mode badge in Properties Pane + document header:**
- Persistent dropdown showing current mode with human-readable label
- Colours: mentor=grey, guided=blue, autonomous=amber

**Layer 2 — Write intercept per mode:**
- `mentor`: AI write tool calls → staging panel → human Apply/Dismiss
- `guided`: AI write tool calls → staging queue → human reviews queue → applies
- `autonomous`: AI writes directly → `ai-last-action:` stamp added automatically
- Human-initiated writes always pass through regardless of mode

### 4. AI preamble injection (soft layer)

When the chat panel opens on a plan, the plan's `mode:` value is prepended to the
AI system context with role-appropriate instructions (advise only / draft and stage /
execute with audit). This reduces unnecessary tool call attempts but is not the
security gate.

### 5. MCP server governance hard blocks (mode-independent)

These remain blocked at all modes — they are governance invariants, not mode
preferences:
- `status: completed` transitions
- `approved: true` on proposals
- `gate_status: approved | waived`

### 6. Linter updates

- `mode:` added to required frontmatter for plans
- Deprecated `automated:` field: WARN with rename instruction
- Deprecated `off`/`full` values: WARN with migration mapping
- Plans with `## Mode` body section: INFO cleanup suggestion (not a block)

### 7. Migration

1. Update all profile templates: `automated:` → `mode:` with appropriate default
2. Update `example-vault/` plan templates
3. Update pre-commit hook validation (add `mode:` to required fields; accept old values with warn)
4. Update `AGENTS.md` and AI instruction files
5. Ship `npm run migrate:mode-field` for vault operators to update their existing plans

## Alternatives Considered

**Keep `automated` field name:** Rejected — `automated` implies a quantity, not a
named mode. Every research candidate used `mode`.

**Two modes only (remove `guided`):** Rejected — the tool survey found no parallel for
`guided`, but that's a sign it's a DocWright innovation worth keeping, not a sign it's
wrong. The middle collaborative mode is real and useful.

**`agentic` instead of `autonomous`:** Rejected — `agentic` is developer jargon;
`autonomous` is precise and accessible to non-developer governance users.

## Future

- Per-step mode override (deferred — plan-level mode is sufficient for now)
- Real-time mode indicator in activity feed (depends on enforcement contract; Phase 4+)
- `autonomous` mode in production (Phase 4+ — needs Web UI write intercept built first)
