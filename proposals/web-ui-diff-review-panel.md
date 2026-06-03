---
complexity: medium
title: "Web UI Diff / Review Panel for AI Sessions"
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - diff
  - ai
  - review
  - improvements
approved: false
deferred: true
deferred_reason: "Phase 3. Requires tight dispatch integration to surface diffs in a governance-aware way. Revisit after dispatch module is stable."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/web-ui-ai-chat-panel.md
  - plans/phase-3-profile-acl-ai.md
---

## Problem

When the AI modifies vault documents during a session, there is no way in the
DocWright Web UI to review what changed before committing. The git panel shows
unstaged changes but is not AI-session-aware — it doesn't know which changes
came from the AI vs the human contributor.

## Proposed Solution

A diff / review panel that surfaces per-session file changes:

- `GET /session/:id/diff` (OpenCode API) returns the diff for a session
- DocWright renders this as a side-by-side diff view in a panel or modal
- Changes are annotated with the governance context: which frontmatter fields
  changed, whether any lifecycle transitions occurred, whether any gate rules
  were triggered
- The contributor can accept all, reject all, or selectively stage changes
  before committing

This panel is the "human in the loop" checkpoint for AI-driven document edits —
consistent with the guided automation mode defined in the plan template.

## Deferred Because

Meaningful AI diff review requires the dispatch module's lifecycle awareness
to annotate changes with governance context. Without that, it is just a git
diff — already available in the git panel.
See [[plans/phase-3-profile-acl-ai.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from web-ui-ai-chat-panel proposal | NetYeti |
