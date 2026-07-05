---
title: Completion doc generator emits invalid YAML tags line in generated docs frontmatter
status: open
github_issue: 185
created: 2026-07-05
author: NetYeti
author-role: user
category: bug
priority: low
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-05]
milestone: future
channel: dev
related:
  - issues/plan-doc-generator-raw-js-date-in-created-field-an.md
tags:
  - reported-bug
---

# Completion doc generator emits invalid YAML tags line in generated docs frontmatter

## Description

Both completion-doc generators (MCP transitionToCompleted in src/mcp/tools/transitions.ts and the webui transition-completed endpoint) emit `tags: - mcp` on a single line — invalid YAML that strict parsers reject, which made 20+ docs/*.md files unparseable by js-yaml (found 2026-07-05 during the #94 parser consolidation; the canonical parser now has a tolerant fallback so nothing breaks, but the generator should emit valid YAML: tags on its own line with formatYamlList, or tags: []). Same generator family as #136. Verification: regenerate a completion doc and js-yaml-parse its frontmatter strictly; audit script in the #94 PR notes.

## System Info

DocWright main @ a1aa6f8, phoenix
