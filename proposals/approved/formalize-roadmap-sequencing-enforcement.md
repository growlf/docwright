---
title: "Formalize mechanical enforcement of roadmap sequencing"
author: "NetYeti"
created: "2026-06-17"
tags: [governance, roadmap, lifecycle, tooling-gap]
category:
  - governance
complexity: medium
approved: true
consumed_by: plans/adopt-milestone-driven-roadmap-discipline.md
priority: 3
created_by: "NetYeti@phoenix"
assigned_to: []
related_to: [docs/roadmap.md, policies/core/workflow-layer-governance.md, policies/core/code-over-memory.md]
depends_on: [plans/completed/sub-plan-ts-mcp-server.md]
blocks: []
milestone: backlog
---

# Formalize mechanical enforcement of roadmap sequencing

## Summary
Implement a "Roadmap Linter" and corresponding MCP tool logic to mechanically enforce the sequencing rules defined in `docs/roadmap.md`. This ensures that work on plans or proposals that are "locked" behind current phase gates is flagged or blocked, transitioning roadmap adherence from a behavioral contract to a code-enforced constraint.

## Problem Statement
Currently, `docs/roadmap.md` is the authoritative source for project sequencing, but its enforcement relies entirely on human and AI discipline ("memory").
1.  **Invisible Gates:** AI agents can (and do) start work on high-priority plans that are technically gated by earlier phase milestones because `dw-mcp_next_action` only looks at plan priority/status, not roadmap phase.
2.  **Sequential Drift:** Without mechanical enforcement, the project risks "skipping ahead" to feature work before foundational governance or API layers are stable, violating the "Bugs before Features" and "Code over Memory" core philosophies.
3.  **Governance Gap:** The current PreToolUse hooks and MCP tools validate *how* a file is modified, but not *if* it should be modified given the current project state.

## Proposed Solution
1.  **Roadmap Parser & Schema:** 
    *   Formalize the structure of `docs/roadmap.md`. Use specific header patterns (e.g., `## Phase N — Name (Status)`) and identifiers for blockers (⚡) and parallel tracks (🔀).
    *   Implement a parser in `src/dispatch/roadmap.ts` that builds a directed acyclic graph (DAG) of project phases and their dependencies.
2.  **Roadmap Integrity Linter:**
    *   Add a check to the `pre-commit` hook that detects **"Roadmap Drift"**: if the roadmap claims a phase is active but all associated plans in `plans/` are `status: completed`, flag it as a lint error.
    *   Conversely, if an agent attempts to work on a Phase 4 plan while Phase 3 still has open ⚡ blockers, reject the action.
3.  **MCP Tool: `get_roadmap_status`:** 
    *   Returns a structured summary of the current gate. 
    *   Example: `Current Phase: 3. Blockers: 3a (Vault API), 3b (MSP Pilot). Locked Phases: 4, 5.`
4.  **UX & Feedback:**
    *   **Contextual Rejection:** When the git hook or MCP tool blocks an action, it must output a "Roadmap context" message listing exactly which ⚡ items in the previous phase are preventing progress.
    *   **Web UI Integration:** Unify the parsing logic so the Web UI's status page visually "locks" or grays out plans that are roadmap-gated.
5.  **Automated Phase Transitions:**
    *   Update `scripts/phase-close.ts` to automatically update the `(Current)` marker and `Last reviewed` date in `docs/roadmap.md` upon successful phase closeout.

## Expected Outcomes
- **Zero Sequential Drift:** The project cannot move to high-level features until foundations are mechanically verified as "Closed".
- **Self-Healing Roadmap:** The system prompts humans to update the roadmap when it no longer matches the filesystem reality.
- **Improved AI Onboarding:** New AI sessions (like this one) immediately "feel" the roadmap gates through tool feedback rather than having to discover them via manual reading.

## Resources Required
- TypeScript/Node.js for parser implementation.
- Updates to the MCP server.

## Related Documents
- [[docs/roadmap.md]]
- [[policies/core/code-over-memory.md]]
- [[docs/ai-governance-enforcement.md]]

## Discussion Notes
- Should parallel tracks (🔀) be allowed to bypass gates automatically? Yes, the parser must respect the 🔀 symbol in `roadmap.md`.
- How does the parser handle plans not yet written to disk? It should check for wikilinks in `roadmap.md` and verify if the target file exists.
