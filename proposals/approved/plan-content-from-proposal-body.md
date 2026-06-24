---
title: Populate plan content from proposal body on approval
author: NetYeti
created: 2026-06-11
tags:
  - tooling
  - lifecycle
  - plan-generation
  - automation
approved: true
created_by: NetYeti@phoenix
assigned_to: netyeti
_path: proposals/plan-content-from-proposal-body.md
consumed_by: plans/completed/plan-content-from-proposal-body.md
---

## Problem

Every time a proposal is approved, `transition_to_approved` generates a plan with
an empty skeleton — no implementation steps, no testing plan, no risk assessment,
no context. The entire proposal body is discarded. The human or AI then has to
manually backfill the plan from the proposal text.

This has been a recurring pain point since the project began. Every single approved
proposal requires a second pass to populate the plan. It wastes time, introduces
inconsistency, and breaks flow.

## Proposed Solution

The fix is already implemented in `src/mcp/tools/transitions.ts` and
`src/webui/src/routes/api/approve-proposal/+server.ts`. This proposal formalizes it.

### Section mapping

When generating a plan from an approved proposal, the system now:

1. **Parses the proposal body** into sections by `## ` headers
2. **Maps recognized sections** to plan template sections:
   - `## Implementation Steps` → copied verbatim into plan
   - `## Testing Plan` → copied verbatim into plan
   - `## Risk Assessment` → copied verbatim into plan
   - `## Rollback Procedures` → copied verbatim into plan
   - `## Proposed Solution` → numbered list items become implementation step rows
   - `## Proposed Approach` → same as Proposed Solution
3. **Preserves context** — all other sections (Problem, Dependencies, Alternatives,
   Future, etc.) are included as sub-sections under the plan's Overview.
4. **Carries over tags** from proposal frontmatter into plan frontmatter.

### Fallback

If the proposal has no `## Proposed Solution`, `## Proposed Approach`, or
`## Implementation Steps` section, the plan gets a single empty step row (same
as before). This prevents breakage for bare-minimum proposals.

### Scope

| Surface | Status |
|---------|--------|
| MCP `transition_to_approved` | ✅ Fixed in `src/mcp/tools/transitions.ts` |
| Web UI `/api/approve-proposal` | ✅ Fixed in `src/webui/.../approve-proposal/+server.ts` |
| Web UI `/api/create-plan` | Separate endpoint, uses template file — lower priority |

## Acceptance Criteria

1. Approve a proposal with `## Proposed Solution` containing numbered items →
   plan has those items as implementation step rows (⏳ Pending)
2. Approve a proposal with `## Implementation Steps` table → plan copies it verbatim
3. Approve a proposal with `## Testing Plan` and `## Risk Assessment` →
   those sections populated in plan
4. Approve a proposal with minimal sections (only Problem + Proposed Solution) →
   plan is still usable, context is preserved
5. Approve a proposal with tags in frontmatter → plan has same tags
6. All existing tests pass (190+ tests across MCP + dispatch)

## Tests Added

- **Proposed Solution steps**: Verifies numbered items become ⏳ Pending step rows
- **Proposed Approach steps**: Same for "Proposed Approach" header
- **Direct Implementation Steps table**: Carried over verbatim
- **Full proposal**: Verifies context sections, testing plan, tags all carried over
- **Existing tests**: All pass with no regressions

## Alternatives Considered

**AI-assisted plan generation.** Rejected for now — adds latency, API dependency,
and nondeterminism. The section mapping approach is deterministic, fast, and
zero-dependency.

**Template file per proposal type.** Rejected — too much overhead. The section
mapping is simpler and works for any proposal structure.

**Do nothing (manual backfill).** This is the status quo that already failed
repeatedly. Rejected.

## Future

- Add section mapping for the `/api/create-plan` endpoint
- Support `###` subsections in section detection
- Emit a warning when proposal has no recognized section for implementation steps
