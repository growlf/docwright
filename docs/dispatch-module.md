---
title: Dispatch module — engine foundation
status: completed
completed_date: 2026-06-03
author: NetYeti
created: 2026-06-03
tags:
  - engine
  - dispatch
  - ai
  - phase-2
---

## Summary

Built the surface-agnostic TypeScript engine at `src/dispatch/` with zero VS
Code API dependencies. All 34 unit tests pass with 24ms runtime.

## What was built

- **Profile engine** — loads `profile.json` with org-operations fallback
- **Index manager** — scans lifecycle dirs, builds `index.json`, stale detection
- **Frontmatter linter** — required fields, enum validation, location invariant
- **AI integration** — `KeywordEngine` (Jaccard) and `OpenCodeEngine` interface
  — `/api/overlap` swap-ready when the real LLM backend is wired
- **Wikilink resolver** — `[[path]]`, `[[path#section]]`, `[[path|alias]]`,
  backlink discovery for rename
- **ACL stub** — tier resolution from `contributors.json`, action permission check

## Source proposal

- `proposals/approved/dispatch-module.md`
