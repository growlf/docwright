---
title: "Sidebar polish — view mode toggle, hidden directories, context-aware new"
status: completed
completed_date: 2026-06-03
author: NetYeti
created: 2026-06-02
tags:
  - webui
  - sidebar
  - ux
proposal_source:
  - proposals/approved/ui-view_includes_all.md
  - proposals/approved/ux-hide-old-cycle-docs.md
  - proposals/approved/context-of-new.md
priority: medium
automated: off
assigned_to: NetYeti
scenario_synthesis: "UI prototype only — no automation scripts, shell commands, or deployment steps in this plan"
---

## Overview

Polish the file tree sidebar with two related features that both touch
`FileTree.svelte`: a docs/all-files mode toggle, and hidden-by-default
directories for completed/archived content.

Both are client-side only — no API changes required.

## Tasks

### 1. View mode toggle

- Add a segmented control (Docs / All files) at the top of the sidebar,
  above the file tree
- **Docs mode** (default): show only `.md` files and their parent directories;
  exclude root-level meta-files (`AGENTS.md`, `CHANGELOG.md`, `CONTRIBUTING.md`,
  `LICENSE`, `NOTICE.md`, `SECURITY.md`) via a configurable
  `sidebarExcludePatterns` array in `profile.json`
- **All files mode**: show every file the API returns (already excludes
  `node_modules`, `.git` via the server); override all filters
- Non-markdown files in all-files mode: open raw in browser or show a
  "non-text file" placeholder
- Persist selected mode in `sessionStorage`

### 2. Hidden-by-default directories

- Filter `proposals/approved/` and `plans/completed/` out of the tree by default
- Add a "Show archived" toggle (eye icon) in the sidebar footer to reveal them
  inline without reload
- All-files mode overrides the filter — archived dirs always visible there
- Hidden list sourced from `profile.json` → `hiddenDirectories` array;
  `org-operations` default: `["proposals/approved", "plans/completed"]`
- Persist "show archived" state in `sessionStorage`

### 3. Profile.json additions

Add to `org-operations/profile.json`:
```json
"sidebarExcludePatterns": ["AGENTS.md", "CHANGELOG.md", "CONTRIBUTING.md",
                            "LICENSE", "NOTICE.md", "SECURITY.md", "PROPOSAL.md"],
"hiddenDirectories": ["proposals/approved", "plans/completed"]
```

### 4. Context-aware "+" on directory rows

- Hovering any directory row in `DirNode.svelte` reveals a small "+" button
  on the right of the row (opacity 0 → 1 on hover, matching existing style)
- Clicking it performs the default action for that directory:

  | Directory prefix | Action |
  |-----------------|--------|
  | `proposals` | `newProposal()` from `+layout.svelte` |
  | `plans` | Prompt for plan title, create stub with plan frontmatter template |
  | `docs` | Generic new file in that directory |
  | `policies` | New file with policy frontmatter template |
  | Anything else | Generic new file in that directory |

- The mapping is defined in `profile.json` → `directoryActions` (future); for
  now it is a simple prefix match in `DirNode.svelte`
- The global "+" header button keeps its full New File / New Proposal menu

### 5. Tests / verification

- Docs mode: confirm meta-files and archived dirs absent from tree
- All files mode: confirm everything visible including non-markdown
- "Show archived" toggle: reveals hidden dirs, hides on re-toggle
- sessionStorage: mode and archived state survive page navigation within session
