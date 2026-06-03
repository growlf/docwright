---
complexity: medium
title: "Related Documents UX — Beyond Keyword Similarity"
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - collation
  - ux
  - improvements
approved: false
deferred: true
deferred_reason: "Immediate toast-flood bug fixed. Deeper UX improvements (score threshold, explicit related_to, acknowledgement state) belong post-launch."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - plans/completed/collation.md
---

## Problem

The current collation system finds related proposals via Jaccard keyword
similarity. When a proposal shares vocabulary with many others (as AI/governance
proposals inevitably do), the similarity scores fire broadly and the results
feel noisy rather than useful. There is also no distinction between:

- Documents explicitly linked via `related_to:` frontmatter (deliberate,
  high-confidence)
- Documents found by keyword similarity (probabilistic, may be irrelevant)
- Relationships that have been reviewed and acknowledged vs. new ones

The immediate toast-flood bug (one toast per match, permanent duration,
"Review" navigating away with no resolution) was fixed by consolidating to
a single summary toast opening the collation panel. But the underlying UX
still has room for improvement.

## Proposed Improvements

**1. Similarity score threshold** — only surface matches above a meaningful
threshold (e.g. 35%). Low-confidence matches (< 25%) are noise for proposals
with broad vocabulary. Make the threshold configurable in `profile.json`.

**2. Explicit `related_to` shown separately** — documents linked via
`related_to:` frontmatter should appear at the top of the collation panel,
clearly labeled "Explicitly linked," before any similarity-discovered matches.
These are always worth knowing; the similarity matches are optional context.

**3. Acknowledgement state** — a lightweight way to mark a relationship as
"reviewed — no action needed" so it doesn't re-surface on the next save.
Store acknowledged pairs in `.docwright/collation-ack.json` (gitignored).

**4. Collation panel: "Why related?" explanation** — instead of just a score,
show the top 3 keywords that drove the match. Helps the reviewer quickly
judge whether the similarity is meaningful or coincidental.

**5. Suppress overlap check after approve** — the current flow fires
`checkOverlap()` on every save including frontmatter-only saves (like approving).
It should only fire when the document body changes meaningfully, not on
status/frontmatter updates.

## Deferred Because

The immediate UX regression (toast flood) is fixed. These improvements
require the real LLM-based overlap detection (Phase 3 dispatch module) to
be in place — at that point the similarity quality will be high enough that
the UX improvements become the bottleneck, not the signal quality.
See [[plans/completed/collation.md]] and [[plans/phase-3-profile-acl-ai.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from toast-flood bug fix | NetYeti |
