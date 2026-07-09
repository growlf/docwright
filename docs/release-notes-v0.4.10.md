---
title: "Release Notes v0.4.10"
created: 2026-07-08
tags: [release]
---

# Release v0.4.10

Tagged 2026-07-08. 49 commits since v0.4.9.

## Features

- Collaboration issue model — 7-step workflow: propose → plan → track → implement → verify → complete → close, with phase tracking, parent-child deliverables, and cross-referencing (#251)

## Fixes

- **Hook unification:** Single hook source — `.githooks` become exec-shims, vaults get `commit-msg` (#240). Claude hooks resolve via `CLAUDE_PROJECT_DIR` fallback and fail LOUD when unresolvable (#245). Identity cache scoped per-repo under `.git/` — tests no longer poison real commits (#243).
- **Approve idempotency:** Self-heals stale `consumed_by` pointers instead of silently no-opping (#216, #222). Test isolates `OPENCODE_URL` to prevent hung in-UI Run Tests (#223).
- **Session auto-landing:** Protected-main commits auto-branch+PR with auto-merge (#253). Split GH failure modes for clearer diagnostics (#257).
- **Plan state machine:** Test/certify state machine legible — visible checklist, honest Uncertify, confirm (#236). Certify Tests affordance for out-of-band test verification (#230). Track confirmed body to prevent false-positive `tests_defined` demote (#227).
- **WYSIWYG round-trip:** Body-only saves, tight GFM rules, governance-doc guard (#213).
- **SyncTestCriteria:** Only on step-table change; sweep phantom Testing Plan duplicates (#209).
- **Phase-complete gate:** Fires only on phase-level plans, not all phase-tagged docs (#215).
- **Approve-by-move:** Requires the `HUMAN-APPROVED` seal; born-approved proposals too (#247).
- Version-drift investigation issue filed (#258).

## Chores

- Version-based milestone taxonomy; drop Phase from roadmap; tag proposals (#211)
- Issue captures and BDFL certifications (#219, #221, #225)
- Sync dogfood to main (#264)

## Docs

- 27 session notes, wave progress markers, bug reports, design documents, plan scaffolding
- AI health audit cycle and skill invocation clarity (#235)
- Agent-roles research rounds 2-6 (#204)
