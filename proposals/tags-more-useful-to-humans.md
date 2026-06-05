---
title: "Tags More Useful to Humans"
author: NetYeti
created: 2026-06-05
tags:
  - ux
  - ui
  - tags
  - discovery
  - navigation
complexity: medium
estimated_effort: M
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
---

## Problem

Tags are currently applied to proposals but serve no visible discovery purpose. They are not consistently applied across all document types (plans, docs, policies, SOPs), there is no way to browse or filter by tag, and the tags field is a free-text input with no autocomplete or validation. This means tags accumulate inconsistently (typos, singular vs plural, different casing) and become noise rather than signal. A contributor cannot answer "what documents are tagged `governance`?" from the UI.

A graph view showing tag-document relationships could make the vault browsable by topic, but there is no foundation for that today.

## Proposed Solution

### 1. Tags on all document types

Extend the tags frontmatter field to all templates: proposals, plans, docs, policies, SOPs. Every profile template includes a `tags:` field with a suggestion prompt or default list drawn from `profile.json`.

### 2. Tag management in the properties pane

The `tags` field in the properties pane becomes a tag-picker component:
- Autocomplete from the vault's existing tag set (aggregated across all documents)
- Type to filter or create a new tag
- Visual chips for each tag (as currently, but with remove-button)
- Normalise casing on save (lowercase, trimmed)

### 3. Tag index and navigation

A vault-wide tag index (`_tags.json`) is rebuilt on document changes, aggregating all tags and their document counts. This powers:
- A **tag browser** in the activity bar or sidebar — alphabetical list of tags with document counts, clickable to filter the file tree
- **Tag chips on document headers** — visible in the document toolbar or status bar, showing the document's tags as clickable links that navigate to the filtered view
- **Filter-by-tag** in the status page and file tree

### 4. Graph view integration

The lifecycle graph view ([[proposals/ui-lifecycle-graph-view.md]]) gains a tag-filter mode: colour or cluster nodes by tag, making it possible to see "all governance work" or "all AI-related work" at a glance.

## Relationship to Existing Work

| Feature | Relationship |
|---------|-------------|
| [[proposals/ui-lifecycle-graph-view.md]] | Graph view gains tag-based filtering and colouring |
| [[proposals/ui-vault-search.md]] | Tag search complements full-text search |
| [[proposals/related-docs-ux-improvements.md]] | Tags can feed into collation similarity scoring |
| Properties pane | Tag-picker replaces free-text `tags` input |

## Alternatives Considered

- **Rely on full-text search only** — search is more flexible but requires the user to know what to search for. Tags provide curated, browsable categories.
- **Auto-tagging by AI** — potential future improvement but requires AI backend; manual tagging with autocomplete is the right starting point.

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Auto-tagging by AI | Requires AI backend (Phase 3); manual tagging comes first |
| Tag hierarchy / parent-child relations | Adds complexity; flat tags suffice for Phase 2 |
| Tag-based access control | Phase 4+ enterprise concern |
