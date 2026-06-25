---
title: Add next_action MCP tool — intelligent step-level recommendation
author: NetYeti
created: 2026-06-11
tags:
  - mcp
  - tooling
  - ux
  - lifecycle
approved: true
created_by: NetYeti@phoenix
assigned_to: netyeti
_path: proposals/next-action-mcp-tool.md
consumed_by: plans/completed/next-action-mcp-tool.md
---

## Problem

When asked "what's next?", agents currently dump broad deliverable names without
considering step-level completion, priority, or dependency chains. There's no
single tool that answers "what should I work on right now."

The answer requires manually composing data from 3-4 separate MCP calls. This
leads to vague, context-free recommendations.

## Proposed Solution

Add a `next_action` MCP tool that returns a structured recommendation:

```json
{
  "plan": "phase-3-vault-foundation",
  "priority": "high",
  "completed_steps": 5,
  "total_steps": 11,
  "phase_gate_progress": { "checked": 4, "total": 8 },
  "recommended_step": 6,
  "recommended_action": "vault:migrate script + MIGRATION.md",
  "blockers": [],
  "sub_plan_status": "proposal not yet approved (proposals/sub-plan-vault-migration-system.md)"
}
```

### Logic

1. **Find active plans** sorted by priority (high → medium → low), then by
   completion ratio (ascending — least done first)
2. **For the top plan**, scan Implementation Steps for the first ⏳ Pending step
   that is not blocked by a dependency
3. **Check dependency chain**: if the step references a sub-plan proposal,
   check if it's approved and has a plan in-progress
4. **Return the recommendation** as structured JSON

### Fallback

If all active plans have no pending steps, return:
```json
{ "status": "all-clear", "message": "No pending steps in any active plan." }
```

## Alternatives Considered

**Modifying `session_context` to include this.** Rejected — `session_context`
is already complex. A focused tool is clearer and independently composable.

**Adding a `what-next` npm script.** Rejected — this needs to be available
to AI agents via MCP, not just CLI.

## Future

- Teach it about explicit `depends_on` in plan frontmatter
- Add `--verbose` mode for full context dump
- Surface sub-plan step counts when recommending a deliverable

---
