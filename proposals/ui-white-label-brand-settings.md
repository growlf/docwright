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

A **Brand** section in the DocWright Settings panel (activity bar → ⚙):

- Text input for org/vault name
- SVG file picker that copies the selected file to the vault root as
  `brand/logo.svg` and writes the `logoPath` to `brand.json`
- Live preview of how the brand area looks in the sidebar
- A "Reset to default" button that removes `brand.json` and falls back to
  the vault directory name

## Deferred Because

The settings panel (activity bar) does not exist yet. Editing `brand.json`
by hand works fine for the launch phase.
See [[proposals/ui-settings-activity-bar.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from brand/logo implementation | NetYeti |
