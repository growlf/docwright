---
type: issue
status: resolved
resolved: 2026-07-10
created: 2026-07-07
author: NetYeti
author-role: contributor
ai-last-action: file bug 2026-07-07
github_issue: 349
---

# Bug: False write conflict dialog triggered during hot-reload (single-user)

## Summary

Conflict resolver dialog appears when viewing a plan in the Web UI during dev server hot-reload, even though:
- User is the only one in the system (single-user scenario)
- No changes were made to the document
- Three versions shown are identical with no differences
- No visual highlighting of differences provided

## Reproduction

1. View a plan in Web UI (e.g., `/plans/collaboration-issue-model-and-roadmap-sync`)
2. Dev server hot-reloads (component update, etc.)
3. Write conflict dialog appears with three columns: YOUR VERSION | SERVER VERSION | CHANGES
4. All three columns show identical content
5. No way to identify what's actually conflicting

## Expected Behavior

- No conflict dialog in single-user scenario
- If dialog appears, clearly highlight actual differences
- Handle hot-reload gracefully without triggering false conflicts

## Actual Behavior

- Dialog appears with three identical versions
- User must manually close/resolve non-existent conflict
- Confusing UX (user thinks they did something wrong)

## Impact

- Blocks workflow (user stuck at conflict resolution)
- Erodes trust in collaborative editing system
- False positives reduce confidence in real conflict detection

## Technical Notes

Likely causes:
- In-memory state diverged from saved file during hot-reload
- Whitespace, field ordering, or timestamp differences
- Conflict detection too aggressive (should check for actual content differences)
- Missing user identity checks (single-user should never conflict)

## Severity

Medium — annoying but can be worked around by selecting any version

## Resolution (2026-07-10)

Fixed by commit cf86169 ("fix: smart conflict detection — auto-resolve false conflicts") — tracks confirmed frontmatter/body state, and on a 409 silently reloads the server version when the user made no actual edits instead of showing a conflict dialog. Bookkeeping on this issue was never updated to reflect that fix; found while auditing outstanding issues.
