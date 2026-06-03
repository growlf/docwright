---
title: Collation — dependency fields, overlap detection, and related-proposals panel
status: completed
completed_date: 2026-06-03
author: NetYeti
created: 2026-06-02
tags:
  - webui
  - ux
  - ai
  - planning
proposal_source:
  - proposals/approved/ux-collating-proposals-into-apropriate-plans.md
priority: high
automated: off
assigned_to: NetYeti
scenario_synthesis: UI prototype only — AI calls are stubbed with keyword similarity; no shell commands or deployment steps
depends_on:
  - properties-pane
---

## Overview

Build the foundation and UX of the collation system before the AI engine
exists. Features 1 and 2 are prototyped with keyword similarity so the engine's
API surface is fully defined and the UX is validated. The AI replaces the stub
later without any UI changes.

Build order: 3a (dependency fields) → 1 stub (overlap detection) → 2 stub
(collation panel) → 3b Gantt (deferred until fields are populated).

## Tasks

### 1. Feature 3a — Dependency frontmatter fields

Add to `org-operations/profile.json` optionalFrontmatter:
- `depends_on: []` — slugs this doc blocks on
- `estimated_effort: ""` — XS/S/M/L/XL
- `due_date: ""`

Add to the `newProposal` template in `+layout.svelte`:
```yaml
depends_on: []
estimated_effort: ""
```

Properties pane already renders all frontmatter fields — `depends_on` becomes
a chip editor, `estimated_effort` a dropdown, `due_date` a date picker.
No pane changes needed.

### 2. Feature 3a — Inline dependency links in read view

In `+page.svelte` read mode, below the frontmatter strip, if `depends_on` is
non-empty render a "Depends on:" row with each slug as a clickable wikilink.
Pure client-side — no API call needed.

### 3. Feature 1 stub — `/api/overlap` keyword similarity endpoint

`GET /api/overlap?path=proposals/foo.md`

Server scans `proposals/` (excluding `proposals/approved/`) and `plans/`
(excluding `plans/completed/`). For each file, reads content, parses frontmatter
+ body, extracts significant word set. Computes Jaccard similarity against the
target file. Returns matches above threshold (default 0.15):

```json
{
  "matches": [
    {
      "path": "proposals/misc.md",
      "title": "Misc / Catch-all Inbox",
      "score": 0.31,
      "sections": [
        { "heading": "Problem / Ideas", "content": "..." }
      ]
    }
  ]
}
```

**This is the exact interface the AI engine will implement.** When the real LLM
replaces the keyword stub, the response shape stays identical.

### 4. Feature 1 stub — Overlap toast on proposal save

After a successful save of a proposal, call `/api/overlap` in the background
(non-blocking). For each match returned, show a **persistent** toast (no auto-
dismiss) with the match title and a link: "Possible overlap with [title] →".
Cache the last result in memory to avoid re-firing on re-saves.

### 5. Feature 2 stub — `CollationPanel.svelte`

Right-side overlay panel triggered by a **"Find Related"** button added to
the properties pane for proposals. Shows related proposals (from `/api/overlap`)
with their sections expanded. Each section has an **Insert** button that:
- Formats the section as a Markdown quote block: `> *from [[slug]]*\n> content`
- Appends it to the document body
- Switches the editor to WYSIWYG mode so the user sees what was inserted

A "mark as subsumed" checkbox per proposal sets `subsumed_by: <current-slug>`
in the related proposal's frontmatter (via `/api/write`).

### 6. Wire Find Related into PropertiesPane

Add a "Find Related" button in PropertiesPane action row, visible only for
proposals. Emits an `onfindrelated` callback. Parent (`+page.svelte`) handles
the API call, sets loading state, and shows `CollationPanel`.

### 7. Feature 3b — Gantt (tracked, deferred)

Once `depends_on` and `estimated_effort` fields are in active use, a Gantt SVG
view at `/_status/gantt` can render them. Tracked here but not built in this
plan — depends on the status page plan and real field data.
