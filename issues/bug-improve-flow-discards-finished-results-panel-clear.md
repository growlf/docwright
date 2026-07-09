---
title: Improve flow discards finished results — panel clears with no Apply/dismiss decision, user cannot tell what happened
status: new
created: 2026-07-09
author: NetYeti
author-role: user
category: bug
priority: high
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-09]
channel: dev
tags:
  - reported-bug
---

# Improve flow discards finished results — panel clears with no Apply/dismiss decision, user cannot tell what happened

## Description

**Observed 2026-07-09 (BDFL, dogfood, during live-ai 1.2 smoke test)** on proposals/executor-panel-live-feedback: clicked Improve → improvement generated quickly → switched to critique phase as expected → finished → then the panel content disappeared. No Apply/Approve/Dismiss decision was ever presented, and the user could not tell whether the proposal file had been modified ("I am not really sure what just landed").

**Verified:** the proposal file was NOT touched (mtime unchanged, git clean, no commits). The generated improvement + critique were lost entirely — minutes of generation discarded with no trace.

**Impact:** worst-possible AI UX pattern for a governance tool — output vanishes AND the user is left unsure whether their document changed. Directly violates the explicit-apply expectation (improve should always end in a human Apply/Discard decision with a visible diff).

**Possible factors (unconfirmed):** improve panel state reset on completion or on SSE-watch reload (this class regressed before — see 2026-06-28 session note: 'silent edit-mode reload suppression', 'AI notes written permanently'); today's main→dogfood merge (8035488) touched +layout improve stores near the conflict area.

**Relation to live-ai-visibility plan:** step 3.4 migrates Improve onto the AgentActivityView relay; the fix for THIS bug should land as part of (or be verified by) that step's e2e — 'final apply/save behavior unchanged' must include 'results never vanish without a decision'. If 3.4 is far off, a targeted fix may be needed sooner since Improve is currently lossy in dogfood.

## System Info

dogfood c613b5f-era container, BigPickle backend, authenticated opencode (post live-ai 1.2)
