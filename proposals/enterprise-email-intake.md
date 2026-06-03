---
complexity: high
title: "Enterprise — Email Intake to Inbox"
author: NetYeti
created: 2026-06-03
tags:
  - enterprise
  - email
  - inbox
  - automation
  - improvements
deferred: true
deferred_reason: "Requires dispatch inbox.ts module and server-side AI. Phase 3+."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/enterprise-server-ai.md
  - docs/deployment.md
---

## Problem

External stakeholders (leadership, partners, community members) may need to
submit proposals, issues, or requests without direct vault access. Currently
there is no way to receive input from outside the vault.

## Proposed Solution

An IMAP/SMTP listener that converts incoming emails to inbox documents:

- Monitored email address (e.g. `governance@cascade.steam`)
- Incoming email → `inbox/email-[date]-[slug].md` with frontmatter:
  `title`, `author` (from email), `created`, `source: email`,
  `original_subject`, `original_sender`
- Server AI (via `src/dispatch/llmwiki.ts` Ingest pattern) lints and
  categorizes the intake: is it a proposal, an issue, a question?
- Auto-assigns tags and suggested `category` based on content analysis
- Human reviewer sees it in the vault inbox, promotes or discards

Connects to `src/dispatch/inbox.ts` — the interface is already defined.

## Deferred Because

Requires dispatch inbox module and server-side AI. Phase 3+.
See [[proposals/enterprise-server-ai.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — enterprise deployment scenario | NetYeti |
