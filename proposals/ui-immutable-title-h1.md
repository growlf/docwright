---
title: "UI — Immutable Document Title Rendered as H1"
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - ux
  - proposals
  - editing
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
---

## Problem

The document title lives in frontmatter. In read mode, it's only visible in
the toolbar — not as a rendered heading in the document body. Users can
accidentally type a different title into the WYSIWYG editor, creating a
conflict between the frontmatter title and an inline heading.

## Proposed Solution

1. On load, inject the frontmatter `title` as an immutable `<h1>` at the top
   of the rendered document body — but only for proposal, plan, and doc types.
2. In WYSIWYG mode, the H1 is outside the `contenteditable` area — the user
   cannot edit it inline. Title changes go through the properties pane only.
3. In source mode, the frontmatter `title:` line is present and editable as
   normal — the H1 is a render-time concern only, not a separate value.
4. If `title` is empty or missing, no H1 is rendered (existing behavior).

## Out of Scope

- Styling the H1 differently from other headings — theme system handles that
- Making the H1 click-to-edit (properties pane is the correct place)
- Showing breadcrumbs or path in the H1 area

## Future

- Collapsible H1 section for long titles (overflow: ellipsis with expand)
- Configurable per profile whether H1 is rendered
