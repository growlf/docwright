---
title: "Research Cluster: Plan Execution Mode"
type: index
_path: research/execution-mode/index.md
related_to:
  - research/execution-mode/enforcement.md
  - research/execution-mode/naming.md
  - research/execution-mode/tool-survey.md
  - research/execution-mode/ui-mocks.md
  - proposals/approved/research-plan-execution-modes.md
  - plans/completed/research-plan-execution-modes.md
---

# Research Cluster: Plan Execution Mode

Four research documents exploring how DocWright should model "how much does the AI do"
as a user-facing and enforcement concept. All four are **concluded** with `recommends`.
The resulting plan (`research-plan-execution-modes`) renamed `automated:` → `mode:` and
established the `mentor | guided | autonomous` value set.

| Document | Question | Outcome |
|---|---|---|
| [[research/execution-mode/tool-survey]] | How do comparable tools model AI autonomy? | Validated 3-tier model |
| [[research/execution-mode/naming]] | What should `automated:` be renamed to? | → `mode: mentor\|guided\|autonomous` |
| [[research/execution-mode/enforcement]] | Where is each mode behavior enforced? | Web UI, MCP, linter, AI preamble contract |
| [[research/execution-mode/ui-mocks]] | Which buttons appear per mode? | Per-mode button visibility spec |
