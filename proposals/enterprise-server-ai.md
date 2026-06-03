---
complexity: high
title: "Enterprise — Server-Side AI for Automation and Offline Processing"
author: NetYeti
created: 2026-06-03
tags:
  - enterprise
  - ai
  - automation
  - opencode
  - dispatch
  - improvements
deferred: true
deferred_reason: "Standalone and team server scenarios covered by current architecture. Enterprise server AI requires dispatch module maturity (Phase 3+)."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - docs/deployment.md
  - proposals/web-ui-ai-chat-panel.md
  - plans/phase-3-profile-acl-ai.md
---

## Problem

In enterprise deployments, AI-driven governance work needs to happen without
a developer being actively logged in: nightly compliance scans, CI/CD-triggered
proposal generation, inbox email processing, phase gate reminders, scheduled
reporting. The client-side OpenCode model (each developer runs their own)
cannot handle these workloads.

## Proposed Solution

A server-side OpenCode instance dedicated to automation, managed separately
from any individual developer's personal instance:

**Server OpenCode config:**
- Runs as a system service (not tied to any user session)
- Uses a shared API key or local LLM (Meshy/Ollama) — no personal token
- Scoped to the vault directory via `x-opencode-directory`
- Accessible via the proxy mode in the chat panel for interactive use too

**Automation capabilities (each a sub-deliverable):**

1. **CI/CD webhook integration** — Forgejo webhook fires on push/PR;
   DocWright's dispatch module calls server OpenCode to analyze the diff,
   create or update a plan, and flag lifecycle violations. See
   [[proposals/enterprise-cicd-webhooks.md]].

2. **Inbox email intake** — IMAP/SMTP listener converts incoming emails to
   inbox documents via `src/dispatch/inbox.ts`. Server OpenCode lints and
   categorizes them. See [[proposals/enterprise-email-intake.md]].

3. **Scheduled compliance scans** — cron-triggered scans of all vault
   documents against their profile's schema and lifecycle rules. Results
   surfaced on the status page and optionally emailed to reviewers.
   See [[proposals/enterprise-scheduled-scans.md]].

4. **Phase gate reminders** — when a gate has been `pending` for N days,
   server AI generates a summary and sends a notification to the gate reviewer.
   See [[proposals/enterprise-gate-notifications.md]].

**Chat panel in enterprise mode:**
A mode switch in the panel header: "My OpenCode" (direct, localhost) vs.
"Server OpenCode" (proxy, server's instance). Both are available
simultaneously — interactive work uses personal AI, automation context
uses the server instance.

## Deferred Because

Requires the dispatch module to be mature (Phase 3) and the server to have
a stable OpenCode process management layer. The current architecture correctly
separates client AI from server governance — enterprise builds on that.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — enterprise deployment scenario | NetYeti |
