---
title: "Step 4: Derived roadplan view"
status: completed
completed_date: 2026-07-01
author: "NetYeti"
created: "2026-07-01"
created_by: "NetYeti@gemini"
tags: [governance, roadmap, milestones, status-page]
proposal_source: "proposals/approved/separate-dev-tracking-milestones-and-beta-channel.md"
parent_plan: "separate-dev-tracking-milestones-and-beta-channel.md"
parent_deliverable: "4"
priority: high
mode: guided
assigned_to: netyeti
depends_on: []
blocks: []
tests_defined: true
tests_human_reviewed: true
total_steps: 4
completed_steps: 4
phase: 4
milestone: v0.5.0
scenario_synthesis: "Sub-plan for implementing the Derived Roadplan View feature, updating SvelteKit API endpoints, adding a new Svelte dashboard view, creating a Markdown synchronizing script, and verifying with Mocha unit tests."
---

# Step 4: Derived roadplan view

## Overview

Implement a dynamically computed derived roadplan view derived from `milestone:` frontmatter fields. This replaces the hand-maintained sections of `docs/roadmap.md`, resolves visibility issues for phases and draft plans, and feeds roadmap sequencing enforcement.

## Implementation Steps

| Step | Action | Details | Status | Issue | Branch |
|------|--------|---------|--------|-------|--------|
| 1 | Backend API updates | Update `/api/status` to scan the `issues/` directory and return a structured `roadplan` object. | ✅ Done | — | feat/roadplan-view |
| 2 | Frontend Web UI updates | Add a `Roadplan` tab to the status page and render current, next, and future milestones. | ✅ Done | — | feat/roadplan-view |
| 3 | CLI generator script | Create `scripts/generate-roadplan.ts` to update `docs/roadmap.md` dynamically from the vault state. | ✅ Done | — | feat/roadplan-view |
| 4 | Verification & Tests | Implement unit and integration tests for version-sorting and roadplan generation. | ✅ Done | — | feat/roadplan-view |

## Parallelism Map

All steps are serial on `feat/roadplan-view` for simplicity.

## Testing Plan

- [ ] Verify that `api/status` scans the `issues/` directory and returns the list of open issues.
- [ ] Verify that milestones are sorted semantically (e.g. `v0.4.0` < `v0.5.0` < `v1.0.0`).
- [ ] Verify that items are correctly partitioned into Current Milestone, Next Milestone, and Future Pool.
- [ ] Verify that the Web UI status dashboard displays the roadplan tab and lists all active plans/open issues under the correct milestone sections.
- [ ] Verify that `scripts/generate-roadplan.ts` successfully replaces content between placeholders in `docs/roadmap.md`.
