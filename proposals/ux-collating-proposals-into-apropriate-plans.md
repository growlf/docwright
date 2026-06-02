---
title: "Collating proposals into appropriate plans"
author: NetYeti
created: 2026-06-02
tags:
  - ux
  - ai
  - engine
  - planning
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
---
## Problem

It is common — especially in team settings — to create proposals that overlap an
existing proposal or plan. Catching that overlap at creation time saves duplicate
effort. Similarly, when promoting a proposal to a plan it is worth surfacing
related open proposals so relevant parts can be folded in, not just the whole
document. Finally, there is no strategic overview layer showing how plans and
proposals relate to each other, their dependencies, or their relative priority.

## Proposed Solution

This proposal covers three related features, delivered in phases:

---

### Feature 1 — Duplicate / overlap detection on save (Phase 2, AI-assisted)

When a proposal is saved, trigger a background similarity check against all
existing open proposals and active plans. The check runs asynchronously and
is non-blocking — the save completes immediately.

- Uses the AI backend (OpenCode / configured LLM) to compare the new proposal
  body against existing documents by semantic meaning, not just keyword match.
- If overlap is detected above a configurable threshold, a persistent (non-auto-
  dismissing) toast appears: "Possible overlap with [proposal-name] — review?"
  with a direct link to the overlapping document.
- Result is cached in a sidecar file (`.docwright/overlap-hints/<filename>.json`)
  so it survives page reload without re-running the check.
- No overlap hint is shown for completed plans or approved-and-promoted proposals.

---

### Feature 2 — Partial collation panel at promotion time (Phase 2, AI-assisted)

When a proposal is approved and a plan is being created from it, a collation
panel appears alongside the new plan editor.

**How it works:**
- The AI identifies open proposals semantically related to the one being promoted
  and lists them in a right-side panel, ordered by relevance.
- Each related proposal is shown with its sections broken out (by heading). The
  user can expand any section to read it in-place.
- Individual sections — or even specific paragraphs — can be dragged into the
  plan being composed. Dropped content lands as a quoted block with a citation
  link back to the source proposal (`> from [[proposal-name]]`).
- A checkbox on each related proposal allows "mark as subsumed" — sets
  `subsumed_by: <plan-slug>` in the proposal's frontmatter and moves it to
  `proposals/approved/` so it disappears from the active queue but retains
  its history.

The granularity is intentional: sometimes only a single acceptance criterion
from a related proposal belongs in the current plan. The UI should not force
an all-or-nothing choice.

---

### Feature 3 — Strategic overview with dependency tracking (Phase 1 partial, Phase 2 full)

**Phase 1 (code-only, no AI):**

Add `depends_on` and `estimated_effort` frontmatter fields to plan and proposal
templates:

```yaml
depends_on: []          # list of plan/proposal slugs this one blocks on
estimated_effort: ""    # XS / S / M / L / XL (t-shirt sizing)
blocks: []              # auto-populated by the index when another doc lists this in depends_on
```

The `/_status` page (see `ui-need-a-status-page-view-and-tool-skill.md`) is
extended with a **Dependencies** section that renders the active
proposal+plan pipeline as a simple list with indented "blocked by" / "blocks"
relationships. Entirely code-driven from frontmatter — no AI, no tokens.

**Phase 2 (Gantt view):**

Once `depends_on` and `estimated_effort` are populated, a Gantt-style timeline
view can be generated. Add `due_date` as an optional frontmatter field. The
Gantt renders as an SVG (using a lightweight library such as `frappe-gantt`
or a hand-rolled SVG component) in a dedicated `/_status/gantt` route.

- Bars sized by `estimated_effort` (XS=1d, S=3d, M=1w, L=2w, XL=1mo by default;
  overridable in `profile.json`).
- Dependency arrows between bars.
- Clicking a bar navigates to the plan/proposal.
- Export to PNG for sharing (browser `canvas` capture).

This view deliberately stays read-only — editing is still done in the document,
not the chart.

---

## Dependencies between features

Feature 1 and 2 require the AI backend (Phase 2 dispatch module).
Feature 3 (Phase 1 portion) is code-only and can be built immediately once
the status page route exists. The Gantt portion follows once effort/date fields
are in use.

Suggested build order: 3a → 1 → 3b → 2.
