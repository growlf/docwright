---
title: "Classifying proposals when created or updated"
author: NetYeti
created: 2026-06-02
tags:
  - ux
  - proposals
  - metadata
  - properties-pane
approved: true
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
subsumed_by: properties-pane
---
## Problem

When creating or updating a proposal, there is no way to categorize it or
estimate its difficulty and time-to-build. Without this, proposals can't be
meaningfully prioritized or grouped, and the status/collation views have no
signal to work with.

Categories for a software engineering profile might include UI, UX, ENGINE,
DATA — and a proposal may fit more than one. Complexity and effort are separate
axes: a proposal can be conceptually simple but large in scope.

## Proposed Solution

Add three optional frontmatter fields to the proposal schema:

```yaml
category: []          # multi-value, profile-defined enum (e.g. UI, UX, ENGINE, DATA)
complexity: ""        # XS | S | M | L | XL  — conceptual difficulty
estimated_effort: ""  # XS | S | M | L | XL  — time/scope sizing
```

**Profile configuration** — each profile defines valid categories in `profile.json`:

```json
"proposalCategories": ["UI", "UX", "ENGINE", "DATA"]
```

**Properties pane** — these fields render as:
- `category`: multi-select chip picker (values from profile config)
- `complexity` / `estimated_effort`: dropdown (XS → XL)

Editable in WYSIWYG mode via the properties pane; display-only in read mode.

**Status page and collation** — these fields are used by the `/_status` page to
group and sort proposals, and by the collation feature to weight similarity results.
The `estimated_effort` field also feeds the Gantt view once that is built.

**New proposal form** — these fields appear in the first-time creation form so
authors are prompted to classify at the point of creation, not as an afterthought.
