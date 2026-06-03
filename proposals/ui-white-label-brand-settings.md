---
complexity: low
title: "UI — White-Label Brand Settings UI"
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - settings
  - white-label
  - improvements
deferred: true
deferred_reason: "brand.json config and logo serving work now. Settings UI to edit them belongs after the activity bar / settings panel is built."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/ui-settings-activity-bar.md
---

## Problem

The white-label brand config (`brand.json` in the vault root) must currently
be edited by hand. Contributors have no in-app way to set the org name or
upload a logo SVG.

## Proposed Solution

A **Brand** section in the DocWright Settings panel (activity bar → ⚙) that
covers every branding touchpoint in one place:

**Identity**
- Text input for org/vault name (writes `brand.json` → `name`)
- SVG file picker — copies the selected file to `brand/logo.svg` and sets
  `logoPath` in `brand.json`
- Live preview of the sidebar brand area as you edit
- "Reset to default" — removes `brand.json`, falls back to vault directory name

**Favicon**
- The browser tab favicon automatically uses `brand/logo.svg` when present
  (served via `/api/brand/logo`). The settings panel shows the current favicon
  and confirms it matches the logo.

**Theme**
- CSS file picker — copies to `brand/theme.css`, reloads the theme immediately
- Link to `docs/customization.md` for the colour reference and example skeletons
- "Clear theme" button — removes `brand/theme.css`, reverts to DocWright defaults

**All changes** write to files in the `brand/` directory and are immediately
reflected in the UI without a server restart.

## Deferred Because

The settings panel (activity bar) does not exist yet. All of the above is
fully functional by hand — edit `brand.json`, drop in `brand/logo.svg`, edit
`brand/theme.css`. See `docs/customization.md` for instructions.
See [[proposals/ui-settings-activity-bar.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from brand/logo implementation | NetYeti |
