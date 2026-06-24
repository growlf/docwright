---
complexity: low
title: "UI Polish — Document Title Visible in Toolbar"
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - polish
  - phase-1
approved: true
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
consumed_by: plans/completed/web-ui-polish.md
---

## Problem

The document toolbar showed only the raw file path (e.g.
`proposals/approved/web-ui-ai-chat-panel.md`) with no document title. Users had no
clear indication of which document they were viewing without reading the path
or scrolling to find a heading in the body.

## Solution Implemented

The toolbar now shows:
- `frontmatter.title` prominently (15px, light colour) when present
- File path as secondary dim monospace text below the title
- Documents without a title: path shown at 13px (slightly larger, more readable)
- Mobile: path hides as before; title remains visible

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Implemented immediately during Phase 1 UI critique session | NetYeti |
