---
title: "Formalize validation and auto-sync for step counters"
author: "NetYeti"
created: "2026-06-08"
tags: [tooling-gap, governance, lifecycle]
category:
  - governance
complexity: low
approved: false
priority: high
created_by: "NetYeti@phoenix"
assigned_to: ["NetYeti"]
related_to: ["plans/auto-plan-executor.md", "plans/sub-plan-ts-mcp-server.md"]
depends_on: []
blocks: []
---

# Formalize validation and auto-sync for step counters

## Summary
Automate the synchronization of `completed_steps` and `total_steps` frontmatter fields with the actual table rows in the "Implementation Steps" section. This prevents manual editing errors from triggering pre-commit hook rejections.

## Problem Statement
The DocWright lifecycle depends on accurate step counts in plan frontmatter for status transitions (e.g., moving to `completed` when `completed_steps == total_steps`). Currently:
- The pre-commit hook (`scripts/lifecycle-gate.js`) correctly rejects commits where these values are out of sync.
- However, when the primary MCP tools (like `update_step`) are not used—such as during manual edits or while porting the MCP server itself—agents and humans frequently forget to manually sync the integer counters with the markdown table rows.
- This creates a "tooling gap" where the system's "training wheels" (git hooks) are working, but the "happy path" (the editing experience) is not assisted by automation.

**Triggering Event:**
During the "TypeScript MCP Server Migration," multiple commits were blocked because the agent (acting as the manual editor) updated the table rows but failed to update the frontmatter count.

## Proposed Solution
1. **CLI Auto-Fix:** Add a `--fix` flag to `scripts/lifecycle-gate.js`. When a count mismatch is detected, the script should offer to automatically rewrite the frontmatter to match the actual row count.
2. **MCP Tooling:** Implement a new MCP tool `sync_step_counts(plan_name)` that performs this synchronization on demand.
3. **Upstream Integration:** Ensure the `update_plan_status` and `write_plan` tools always call the counting logic internally to guarantee consistency.
4. **UI Warning:** Add a visual indicator in the Web UI's PropertiesPane if the declared count does not match a live scan of the document body.

## Expected Outcomes
- Reduced friction for developers and agents editing plans.
- Eliminates "count mismatch" as a reason for git hook failure.
- Transitions DocWright further away from "git hook enforcement" and towards "correct-by-design" tooling.

## Resources Required
- Update to `scripts/lifecycle-gate.js` (Node.js/JS)
- Update to `src/mcp/tools/mutation.ts` (TypeScript)

## Related Documents
- `.opencode/rules/hook-failure-feedback.md`
- `AGENTS.md`

## Discussion Notes
- This proposal was automatically triggered by a pre-commit hook failure under the "Hook Failure Feedback" policy.
