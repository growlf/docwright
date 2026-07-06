---
complexity: low
title: "Mobile WYSIWYG Editing"
author: NetYeti
created: 2026-06-03
tags:
  - mobile
  - wysiwyg
  - editor
  - improvements
approved: false
deferred: true
deferred_reason: "contenteditable is unreliable on iOS. Requires research into a mobile-safe rich-text approach. Revisit after launch."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/approved/mobile-friendly.md
milestone: backlog
---

## Problem

The WYSIWYG editor mode relies on `contenteditable`, which has well-documented
unreliable behaviour on iOS — cursor positioning, selection, and IME input all
have platform-specific bugs that vary across iOS versions and browsers. The
mobile-friendly plan deliberately excluded WYSIWYG editing from its scope for
this reason.

Mobile users currently fall back to source mode for editing, which is not
appropriate for non-developer contributors.

## Proposed Solution

Research and implement a mobile-safe WYSIWYG editing approach. Options to
evaluate:

- A lightweight mobile-aware rich-text library that wraps contenteditable
  with iOS-specific workarounds (e.g. tiptap, prosemirror with mobile shims)
- A structured form-based editing mode for mobile (field-by-field rather than
  inline document editing) — lower fidelity but reliable
- A native-feeling mobile editor that maps to the same markdown output

The solution must produce the same Markdown+frontmatter output as the desktop
WYSIWYG mode so no document format divergence occurs.

## Deferred Because

Requires dedicated iOS testing and a mobile-specific editor strategy.
Out of scope for the initial mobile-friendly breakpoint work.
See [[proposals/approved/mobile-friendly.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from mobile-friendly proposal | NetYeti |
