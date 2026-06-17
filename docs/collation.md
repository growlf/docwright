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
consumed_by: plans/plan-sub-plan-vault-write-api-movedocument-renamedocument-canonical-setfield.md
---

## Summary

Built the collation system: dependency frontmatter fields, keyword-based overlap detection, and a related-proposals panel. All features implemented as UI stubs — the keyword similarity endpoint has the exact interface the future AI engine will use.

## What was built

- **Dependency fields** — `depends_on`, `estimated_effort`, `due_date` rendered via the properties pane (chip editor / select / date picker)
- **Inline dependency links** — clickable wikilinks in read view when `depends_on` is set
- **`/api/overlap` endpoint** — Jaccard similarity with stop-word filtering, section extraction, and configurable threshold. Scans proposals + active plans, skips subsumed/completed documents. Response shape: `{ matches: [{ path, title, score, sections }] }`.
- **Overlap toast on save** — non-blocking background call to `/api/overlap` after proposal save; persistent toast with "Review" link
- **CollationPanel.svelte** — slide-over panel with expandable matches, per-section Insert (quotes into document body), and Mark as Subsumed checkbox (writes `subsumed_by` frontmatter)
- **Find Related button** — in PropertiesPane action row, visible only for proposals

## Gantt (deferred)

The Gantt view (`/_status/gantt`) is tracked but not built — it depends on real field population and the status page plan.

## Source proposals

- `proposals/approved/ux-collating-proposals-into-apropriate-plans.md`
