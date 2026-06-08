---
title: UI Polish Bundle — Panels, Tags, Navigation, Wikilinks, and Deferred Polish
author: NetYeti
created: 2026-06-06
tags:
  - ui
  - ux
  - panels
  - tags
  - navigation
  - wikilinks
  - phase-4
complexity: medium
estimated_effort: L
approved: true
created_by: NetYeti@phoenix
assigned_to: ""
absorbs:
  - proposals/ui-keyboard-panel-shortcuts.md
  - proposals/ui-resizable-panels.md
  - proposals/ui-theme-picker.md
  - proposals/tags-more-useful-to-humans.md
  - proposals/contributor-name-autocomplete.md
  - proposals/drag-and-drop-file-reorganization.md
  - proposals/wikilink-backref-update-on-rename.md
  - proposals/policies-should-be-a-button-on-the-leftmost-button-bar.md
  - proposals/related-docs-ux-improvements.md
_path: proposals/bundle-phase-3-ui-polish.md
consumed_by: plans/plan-ui-polish-bundle-panels-tags-navigation-wikilinks-and-deferred-polish.md
---
## Problem

Nine Phase 2 deferred proposals share the same unblocking conditions: a stable unified panel layout, the Phase 4 dispatch module (vault-wide wikilink index, Forgejo ACL integration), and the activity-bar settings panel. Tracking them as nine separate proposals creates noise with no actionable distinction between them — none can ship before Phase 4 foundations land.

## Proposed Solution

Deliver as a single Phase 4 UI Polish plan. Items are grouped by dependency tier.

### Tier 1 — Depends only on stable panel layout (ship early in Phase 4)

**Keyboard shortcuts for panels**

*   `Ctrl+\` — toggle left sidebar
*   `Ctrl+Shift+\` — toggle right panel (properties / related)
*   Hint text shown in panel toggle button tooltips
*   Shortcuts configurable via a future keybindings system

**Resizable panels**

*   Drag handles on inner edges of sidebar and right panel
*   Width persisted in `localStorage` per panel
*   Clamped: sidebar 180px–400px, right panel 220px–400px
*   Double-click handle resets to default width

**Policies dedicated navigation**

*   Dedicated "Policies" button on the primary navigation strip (leftmost bar)
*   Opens a standalone policy browsing area: categorized listing grouped by domain, quick filter by title/tag/category, visual badge showing policy count
*   Uses the existing document viewer component pre-filtered to policy-type documents

### Tier 2 — Depends on activity-bar settings panel

**In-app theme picker**

*   A Theme section in the DocWright Settings panel (activity bar → ⚙)
*   Lists available themes from `brand/themes/` with live preview
*   One-click apply (copies to `brand/theme.css`), upload custom theme, reset to default
*   Depends on: activity-bar settings panel (approved)

### Tier 3 — Depends on Phase 4 dispatch module

**Tags more useful to humans**

*   Tags field extended to all document types (plans, docs, policies, SOPs)
*   Tag-picker component in the properties pane: autocomplete from vault-wide tag set, visual chips, lowercase normalization on save
*   Vault-wide tag index (`_tags.json`) rebuilt on document changes
*   Tag browser in activity bar: alphabetical list with document counts, clickable to filter the file tree
*   Tag chips on document headers navigate to the filtered view
*   Graph view gains tag-filter mode (colour/cluster nodes by tag)

**Wikilink back-reference updating on rename**

*   On rename via Web UI or dispatch module: reads `_backlinks.json` to find all documents referencing the old path
*   Replaces `[[old-path]]` → `[[new-path]]` (preserving aliases and section anchors)
*   All modified files staged as a single atomic commit alongside the rename
*   Rename API endpoint gains `update_backlinks: true` parameter (default: on in UI)
*   Depends on: vault-wide backlink index in dispatch module

**Drag-and-drop file reorganization**

*   Drag a file node onto a directory node in the sidebar to move it via `git mv`
*   On drop: triggers the same wikilink back-reference update as a rename
*   Visual feedback during drag (highlight valid drop targets)
*   Toast notification with git-undo option (consistent with existing CRUD)
*   Lifecycle guardrail: warns and requires confirmation before moving a file to an unrecognised directory that would break lifecycle rules
*   Depends on: wikilink backref updating (above)

### Tier 4 — Depends on Phase 4 ACL / Forgejo integration

**Contributor name autocomplete in properties pane**

*   Autocomplete on `author` and `assigned_to` inputs in the properties pane
*   Source priority: Forgejo team membership API → `contributors.json` vault config → names seen in existing frontmatter (derived, zero-config fallback)
*   Allows free-text entry for unlisted names; convenience only, not enforcement
*   Depends on: Phase 4 Forgejo ACL integration

### Related docs UX improvements (any tier — dispatch module needed for quality)

*   Similarity score threshold: only surface matches above 35%; configurable in `profile.json`
*   Explicit `related_to` frontmatter shown at top of collation panel, labeled "Explicitly linked"
*   Acknowledgement state: mark a relationship "reviewed — no action" (stored in `.docwright/collation-ack.json`, gitignored), prevents re-surfacing on next save
*   Collation panel "Why related?" — show top 3 keywords that drove the match
*   Suppress overlap check on frontmatter-only saves (approve, status changes)
*   Depends on: dispatch LLM-based overlap detection for meaningful signal quality

## Relationship to Existing Work

| Proposal / Plan | Relationship |
| --- | --- |
| \[\[plans/completed/phase-2-ui-polish-bundle.md\]\] | This bundle is the natural Phase 4 successor |
| \[\[plans/completed/sidebar-polish.md\]\] | Keyboard shortcuts and resize depend on the stable unified layout delivered here |
| \[\[plans/phase-4-profile-acl-ai.md\]\] | Wikilink backref, contributor autocomplete, and related-docs improvements depend on Phase 4 dispatch |
| \[\[proposals/approved/ui-theming-system.md\]\] | Theme picker is the in-app UI for the theming system already in place |
| \[\[proposals/approved/ui-settings-activity-bar.md\]\] | Theme picker depends on this settings panel |

## Out of Scope

| Idea | Why deferred |
| --- | --- |
| Auto-tagging by AI | Requires AI backend (Phase 4+); manual tagging with autocomplete comes first |
| Tag hierarchy / parent-child relations | Flat tags suffice; hierarchy adds complexity |
| Tag-based access control | Phase 5+ enterprise concern |
| Multi-file drag-and-drop | Single file at a time is sufficient for Phase 4 |
| Keybindings configuration UI | A future keybindings system; shortcuts assigned for now |

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-08 | AI-improved via Improve | NetYeti |
| 2026-06-06 | Created — consolidated from 9 individual deferred proposals | NetYeti |

_(AI improvement timeout — showing original body)_