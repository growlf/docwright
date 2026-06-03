---
title: "Contributor Name Autocomplete in Properties Pane"
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - properties-pane
  - contributors
  - improvements
deferred: true
deferred_reason: "Requires a contributor list source (Forgejo team membership or vault config). Revisit when ACL/Forgejo integration lands in Phase 3."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - plans/completed/properties-pane.md
  - plans/phase-3-profile-acl-ai.md
---

## Problem

The `author` and `assigned_to` fields in the document properties pane are
plain text inputs. Contributors must type names manually and consistently —
there is no validation, no autocomplete, and no way to know who the valid
assignees are. Inconsistent values (typos, name variations) break filtering
and assignment queries across the vault.

## Proposed Solution

Autocomplete on the `author` and `assigned_to` inputs in the properties pane,
drawing from a contributor list:

- **Phase 3 source (preferred):** Forgejo team membership API — always
  current, matches ACL enforcement source of truth
- **Fallback source:** a `contributors.json` in the vault root (manually
  maintained, useful for vaults not connected to Forgejo)
- **Derived source:** names seen in existing `author` and `assigned_to`
  frontmatter across the vault (zero-config, lower quality)

The autocomplete suggests on keypress, allows free-text entry for unlisted
names, and does not block saving — it is a convenience, not enforcement.

## Deferred Because

The most useful source (Forgejo team membership) is not available until
Phase 3 ACL integration. The fallback sources are implementable sooner but
the main value comes with Forgejo.
See [[plans/phase-3-profile-acl-ai.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from properties-pane plan | NetYeti |
