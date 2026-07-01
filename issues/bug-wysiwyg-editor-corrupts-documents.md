---
title: "WYSIWYG editor corrupts documents and clobbers frontmatter on save"
status: open
author: NetYeti
author-role: contributor
created: 2026-06-30
category: bug
priority: high
complexity: medium
estimated_effort: M
tags:
  - webui
  - editor
  - wysiwyg
  - governance
  - data-integrity
created_by: "NetYeti@cluster-llm"
assigned_to: ""
---

> Found by dogfooding the Web UI on 2026-06-30 while trying to Complete the
> `governance-engine-view-container` plan through the real lifecycle.

## Problem

Saving a document from the WYSIWYG editor round-trips the **whole file** through
a markdown render → re-serialize step, which is not round-trip-stable. For
governance docs this is serious: it silently mangles the lifecycle-critical
structure (the Testing Plan / Gate Criteria checkboxes the Complete gate reads),
and it clobbers frontmatter changes made by other controls. Two symptoms, one root:

**Symptom A — body corruption.** Editing/saving in WYSIWYG reflowed wrapped
paragraphs onto single lines, converted `-` bullets to `*` bullets, turned GFM
task-list checkboxes (`- [x]` / `- [ ]`) into plain bullets (losing checkbox
syntax entirely), and **injected a duplicate "Step Verification" checklist**.
The plan's Complete gate parses those checkboxes, so the corruption broke the
gate logic.

**Symptom B — frontmatter clobber.** Clicking "certify tests" set
`tests_human_reviewed: true`, but a subsequent WYSIWYG body-save wrote back a
**stale frontmatter snapshot** (`tests_human_reviewed: false`), silently
reverting the human attestation. Result: Complete stayed "blocked by 1" with no
indication why — the field the user had just set had been undone.

## Steps to Reproduce

1. Open a plan with a Testing Plan section (GFM task-list checkboxes) in the Web UI.
2. Switch to WYSIWYG mode; toggle a checkbox or edit any text; let it save.
3. View the raw markdown → paragraphs rewrapped, `-`→`*`, `- [x]`/`- [ ]`
   checkboxes now plain bullets, a duplicate checklist section added.
4. Separately: click "certify tests" (sets `tests_human_reviewed: true`), then
   make a WYSIWYG body edit and save → `tests_human_reviewed` reverts to `false`.

## Expected vs Actual

**Expected:** Saving a body edit preserves the rest of the document byte-for-byte
— frontmatter untouched, bullet style and task-list checkboxes intact, no
duplicated sections. Frontmatter set by other controls is never clobbered.

**Actual:** The whole file is re-serialized from a stale editor model. Markdown
structure is rewritten and frontmatter changes made elsewhere are overwritten.

## Environment

DocWright Web UI (SvelteKit dev, :5173), 2026-06-30 dogfooding session. Observed
on `plans/governance-engine-view-container.md`. Editor: WYSIWYG mode (markdown-it
render + turndown serialize round-trip).

## Proposed Fix

Suspected root cause: WYSIWYG save serializes the entire document (including a
re-rendered body and a stale frontmatter copy) and writes it back wholesale.

- **Never re-serialize frontmatter on a body save** — preserve the existing
  frontmatter block verbatim; only the body may change.
- **Make the body serializer round-trip-safe** — preserve `-` bullet style and
  GFM task lists (`- [ ]` / `- [x]`); don't rewrap paragraphs; don't duplicate
  sections. (turndown needs GFM task-list config, or patch only the edited range.)
- **Guard governance docs** — until the editor is round-trip-safe, disable
  WYSIWYG for `plans/`, `proposals/`, `policies/` (or warn), since corrupting
  their checkbox/frontmatter structure breaks the lifecycle gates.

This is a **data-integrity** bug (silently corrupts governed documents) →
bugs-before-features priority.

## Related

- [[plans/governance-engine-view-container]] — the doc that got corrupted (the triggering case)
- [[policies/core/bugs-before-features]]
