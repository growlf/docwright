---
title: "Harden capture_bug_report output — emit schema-valid issue frontmatter"
author: NetYeti
author-role: contributor
created: 2026-07-11
tags:
  - mcp
  - governance
  - tooling
  - bug
approved: false
created_by: "NetYeti@cluster-llm"
assigned_to: ""
priority: medium
milestone: backlog
related_to:
  - https://github.com/growlf/docwright/issues/357
  - https://github.com/growlf/docwright/issues/356
---

## Problem

`capture_bug_report` (create) emits frontmatter that the issue schema/pre-commit
hook **rejects**, so every filed bug needs a manual hand-fix before it can be
committed. Two recurring defects, hit ~4× in a single session (2026-07-11):

- **`status: open`** — not a valid issue status. The linter requires one of
  `new, triaged, scope-checked, awaiting-proposal, proposal-linked, resolved,
  deferred, duplicate`. New bugs should default to `status: new`.
- **`milestone: future`** on a `new` issue — the linter only allows `milestone`
  when status is `proposal-linked`, `resolved`, or `deferred`. The tool sets it
  unconditionally.

Because the AI cannot commit a schema-invalid file (and the human then hand-edits
`status`/`milestone` every time), the intended zero-friction capture loop is
broken and violates **code-over-memory** — the tool should emit valid output, not
rely on a human remembering to fix it.

## Proposed Solution

Make `capture_bug_report --action create` emit schema-valid frontmatter:
default `status: new`, omit `milestone` entirely for new issues. Add a unit test
asserting the created file passes the same frontmatter validation the pre-commit
hook runs (parity with the linter), so the two can't drift again.

## Verification

- Unit test: a created bug's frontmatter passes `validateIssueFrontmatter`
  (status ∈ allowed set; no `milestone` on a `new` issue).
- Filing a bug via the MCP tool commits cleanly with no hand-edit.
