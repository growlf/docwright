---
title: "Web UI: left panel lags behind lifecycle/state changes (stale until manual refresh)"
author: NetYeti
author-role: contributor
created: 2026-07-11
tags:
  - webui
  - ux
  - reactivity
approved: false
created_by: "NetYeti@cluster-llm"
assigned_to: ""
priority: low
milestone: backlog
related_to:
  - https://github.com/growlf/docwright/issues/364
---

## Problem

The Web UI left panel does not update promptly after state changes (e.g. a
lifecycle transition, approve, or file move), showing stale content until a manual
refresh/navigation. This undermines confidence that an action took effect
(closely related to the "Complete button — nothing happened" class of confusion).

## Proposed Solution

Make the left panel reactive to the same signals that mutate vault state:
invalidate/refresh its data on lifecycle actions and SSE file-change events
(reuse the existing watch/SSE layer) rather than requiring a manual reload.

## Verification

- After an approve/complete/rename in the UI, the left panel reflects the change
  without a manual refresh (observed in the running dogfood UI).
