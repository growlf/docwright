---
title: Plan test/certify button state machine is opaque — session-local state, ambiguous labels, silent flips
status: resolved
closed_by_pr: "#236"
resolved: 2026-07-06
github_issue: 224
created: 2026-07-06
author: NetYeti
author-role: user
category: bug
priority: high
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-06]
milestone: future
channel: dev
tags:
  - reported-bug
---

# Plan test/certify button state machine is opaque — session-local state, ambiguous labels, silent flips

## Description

Live UX repro 2026-07-06 (BDFL completing webui-write-integrity): after Run Tests finished green, the pane silently flipped to the Complete + '✓ Tests' state; '✓ Tests' reads as a status indicator but is actually a destructive uncertify action, so the user clicked it expecting Run Tests and got demoted; Certify Tests then appeared, but navigating away destroyed the session-local testPassed state, resetting the whole flow. Three compounding problems: (1) button labels are ambiguous — '✓ Tests' should read like the action it performs ('Re-run tests' / 'Uncertify'); (2) the state machine's inputs are invisible — the user cannot see which of tests_defined / tests_human_reviewed / testPassed is driving the current button set, so every transition feels random; (3) testPassed is browser-session state while the other inputs are frontmatter, so a page navigation mid-flow strands the user in a state the buttons cannot express (Certify unreachable, see companion issue #220). Fix direction: derive the whole button set from persisted plan state only (tests_last_result: pass replaces session testPassed), render the certification checklist visibly (tests defined ✓ / last run pass ✓ / human certified ✗) with one explicit action per missing item, and make destructive transitions (uncertify) confirm. Related: issues/bug-certify-tests-button-unreachable-when-tests-were-v.md (#220), issues/bug-properties-pane-save-demotes-testsdefined-on-an-un.md (#218), proposals/executor-panel-live-feedback.md (no progress feedback during the run itself).

## System Info

DocWright main @ 9e1a43c (local dev instance), phoenix — observed across UI-save commits 808c330/3f3fd8f/5a5cdbc
