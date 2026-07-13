---
title: /status has no 'needs your attention' action queue — human can't tell what's gated on their decision
status: new
created: 2026-07-13
author: NetYeti
author-role: user
category: bug
priority: high
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-13]
channel: dev
github_issue: https://github.com/growlf/docwright/issues/345
related:
  - proposals/phases-and-the-master-plan-are-mostly-invisible-to-the-user.md
  - plans/completed/phase-close-web-ui.md
tags:
  - reported-bug
---

# /status has no 'needs your attention' action queue — human can't tell what's gated on their decision

## Description

OBSERVED 2026-07-13 by the BDFL dogfooding: the /status page surfaces all lifecycle STATE (plans, proposals, issues, across List/Funnel/Graph/Roadplan views) but never distills the human's ACTION QUEUE — the few items gated on the BDFL's decision RIGHT NOW. Concretely invisible/unfindable: (1) plans staged for completion (all steps ✅ Done, tests recorded, awaiting the human's Certify → Complete gate); (2) proposals awaiting approval; (3) phases ready to close (Mark reviewed → Complete); (4) overdue scheduled gate reviews. The BDFL reported: "I go to /status and it is absolutely NOT clear what needs to be done — just a spew of plans/proposals/issues; even Roadplan doesn't surface 'what's next that I need to pay attention to.'" This defeats DocWright's core promise (a governance layer should tell the human what needs them, not make them hunt).

IMPACT: a Web-UI-only BDFL cannot reliably find the items awaiting their gate. This session left 5 plans staged for completion + a Phase 4 close, and the human could not locate any of them from /status.

PROPOSED FIX: a 'Needs your attention' panel pinned at the top of /status (all views) listing pending HUMAN-GATED actions, each with a direct action button + a one-line why: plans ready to complete (steps done + tests green → Certify/Complete), proposals awaiting approval (→ Approve), phases ready to close (→ Mark reviewed/Close — the phase-close-web-ui banner is one piece of this), overdue reviews. Derive it from the data /status already loads (completion-gate readiness predicate + approval state + phaseReadiness). Empty state: 'Nothing needs you right now.' This is the single highest-leverage UX fix for BDFL operability.

RELATED: proposals/phases-and-the-master-plan-are-mostly-invisible-to-the-user.md (narrower — phase/roadmap visibility); plans/completed/phase-close-web-ui.md (the phase-ready banner is one element of this queue).

## System Info

None provided
