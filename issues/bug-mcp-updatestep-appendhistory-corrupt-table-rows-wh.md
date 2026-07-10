---
title: MCP update_step / append_history corrupt table rows whose cell content contains pipe characters
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
github_issue: https://github.com/growlf/docwright/issues/272
related:
  - plans/live-ai-visibility-event-relay.md
tags:
  - reported-bug
---

# MCP update_step / append_history corrupt table rows whose cell content contains pipe characters

## Description

The MCP plan-mutation tools update_step and append_history split/reconstruct Markdown table rows by naively delimiting on the pipe character (|), without accounting for pipes that appear INSIDE a cell's content. When a cell contains literal pipes, the status write lands in the wrong column and clobbers cell text.

REPRODUCED 2026-07-09 on plans/live-ai-visibility-event-relay.md step 2.4, whose Details cell contains the grep regex `grep -nE "sk-|ghp_|AKIA|Bearer |password|api[_-]?key|/home/"`. Calling update_step(step_match="Canonical event fixtures", new_status="done") did NOT set the trailing status column (still shows ⏳ Pending); instead it overwrote the `ghp_` token inside the regex with ` ✅ Done `, corrupting the scrub-protocol regex in a governance document. The frontmatter completed_steps counter still incremented (3→4), likely because the counter counts "✅ Done" occurrences — so the count is right by accident while the row is doubly wrong (data lost + status column unchanged).

append_history has the same class of defect: an appended change-text containing pipes (e.g. describing that same regex) produces a Document History row with extra pseudo-columns that renders as a broken table row (data preserved on one physical line, but table structure mangled).

IMPACT: (1) silent corruption of governance-doc content — exactly the failure mode "code over memory" is meant to prevent; (2) any step whose Details cell legitimately contains a pipe (regex, shell alternation, tables-in-cells, `a|b` type notation) can never be marked done correctly via update_step — the row corrupts every time, so there is no MCP-sanctioned way to fix it (the PreToolUse hook blocks direct plan edits), forcing a full write_plan rewrite as the only recovery.

FIX DIRECTION: parse Markdown table rows respecting escaped pipes (\|) and/or split into exactly N cells by column count (cap the split so the final Details/status columns are not over-split), operate on the correct status column by header name rather than positional index, and re-escape pipes in cell content on write. Add a regression test using a plan row whose Details cell contains `a|b|c`. Consider also validating/round-tripping the whole row after mutation and erroring if the column count changes.

Recovery performed this session: step 2.4 row + history entry repaired via write_plan (restored ghp_, set status column to ✅ Done, de-piped the history text).

## System Info

DocWright dogfood; dw-vault MCP server (dist build) on cluster-llm; observed via update_step + append_history against plans/live-ai-visibility-event-relay.md step 2.4
