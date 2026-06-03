---
complexity: low
title: "Model Voting and Confidence Scoring Across Perspectives"
author: NetYeti
created: 2026-06-03
tags:
  - ai
  - review
  - research
  - improvements
deferred: true
deferred_reason: "Interesting for research contexts but out of scope for governance tooling. May never be relevant."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/multi-perspective-review-feature.md
---

## Problem

When multiple models review the same question, their responses are qualitative.
There is no structured way to aggregate "how many models flagged this as a
problem" or "how confident are the reviewers collectively."

## Proposed Solution

Structured review output using a schema that allows models to rate their
confidence and flag items categorically. A summary shows agreement rates
across models: "3/3 models flagged the ACL section as incomplete" vs.
"1/3 models flagged the timeline as aggressive."

## Deferred Because

Governance decisions are not well-served by voting mechanics — a 2/3 majority
of AI models does not make a policy correct. This approach risks introducing
false quantitative confidence into what are fundamentally qualitative
judgments. It is interesting for AI research contexts but potentially
counter-productive for governance tooling.
See [[proposals/multi-perspective-review-feature.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from multi-perspective-review-feature proposal | NetYeti |
