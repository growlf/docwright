---
title: "Enterprise Tier Bundle — Server-Side AI, CI/CD Webhooks, Email Intake, and Scheduled Compliance"
author: NetYeti
created: 2026-06-06
tags:
  - enterprise
  - ai
  - automation
  - webhooks
  - email
  - compliance
  - scheduling
  - phase-3
complexity: high
estimated_effort: XXL
approved: false
priority: low
created_by: NetYeti@phoenix
assigned_to: ""
absorbs:
  - proposals/enterprise-server-ai.md
  - proposals/enterprise-cicd-webhooks.md
  - proposals/enterprise-email-intake.md
  - proposals/enterprise-scheduled-scans.md
depends_on:
  - plans/phase-3-profile-acl-ai.md
milestone: backlog
---

## Problem

Four enterprise proposals all require the same foundational prerequisite:
a server-side OpenCode instance running as a managed service, separate from
any individual developer's personal AI session. None of them can ship without
that foundation. Tracking them as four separate proposals misrepresents the
dependency and implies they could ship independently.

## Proposed Solution

Ship as a single enterprise-tier deliverable, phased by dependency.

### Foundation — Server-Side AI

A server-side OpenCode instance dedicated to automation:

- Runs as a system service (not tied to any user session)
- Uses a shared API key or local LLM (Meshy/Ollama via growlf/meshy) — no personal token
- Scoped to the vault directory via `x-opencode-directory`
- Accessible via proxy mode in the chat panel for interactive use too (see
  [[proposals/bundle-chat-session-panel.md]] dual-mode chat)
- Process management: systemd unit or Docker service (composable with the
  existing containerized Web UI)

### Capability 1 — CI/CD Webhook Integration

Forgejo webhook receiver that triggers dispatch actions on push/PR events:

- **On push to `proposals/`**: server AI reviews the new proposal for completeness,
  flags missing frontmatter or lifecycle violations
- **On PR open against `plans/`**: auto-generate a plan readiness summary
  (dependencies resolved? blocking proposals open?)
- **On push to `policies/`**: notify the gate reviewer that a policy has changed
- **On merge**: auto-advance plan status fields where appropriate
  (e.g. `approved` → `in-progress` when a branch is opened)

Webhook endpoint: `POST /api/webhook/forgejo`

### Capability 2 — Email Intake to Inbox

IMAP/SMTP listener that converts incoming emails to inbox documents:

- Monitored address (e.g. `governance@cascade.steam`)
- Incoming email → `inbox/email-[date]-[slug].md` with frontmatter:
  `title`, `author` (from email From), `created`, `source: email`,
  `original_subject`, `original_sender`
- Server AI (via `src/dispatch/llmwiki.ts` Ingest pattern) lints and categorizes:
  is it a proposal, an issue, a question?
- Auto-assigns tags and suggested `category`
- Human reviewer promotes or discards from the vault inbox

Connects to `src/dispatch/inbox.ts` — the interface is already defined.

### Capability 3 — Scheduled Compliance Scans and Gate Notifications

A server-side job scheduler running on configured cadences:

**Compliance scan (daily or weekly):**
- Scan all active documents against their profile schema
- Flag frontmatter violations, missing required fields, broken wikilinks
- Produce a compliance report committed to `docs/compliance/[date].md`
- Surface violations on the status page Audit tab

**Gate reminder (configurable threshold, e.g. 3 days):**
- Find all gates with `gate_status: pending` older than the threshold
- Generate an AI summary: what is pending, why it matters, what action is needed
- Notify `gate_reviewer` via: email (SMTP), or committed `inbox/` reminder document

**Stale plan detection:**
- Plans with `status: in-progress` and no commits for N days
- Reminder sent to `assigned_to`

Connects to the scheduled trigger gate mechanism in
[[proposals/approved/bundle-lifecycle-gates-phase-2.md]].

## Deployment Context

This bundle is the primary deliverable for the Cascade STEAM reference deployment.
The reference vault seed (in Drive folder) has `vision.md` and `governance.md`
requiring leadership completion before going active. The enterprise tier
activates the full governance loop: human contributors + server AI + Forgejo
enforcement + scheduled compliance.

## Relationship to Existing Work

| Proposal / Plan | Relationship |
|-----------------|-------------|
| [[plans/phase-3-profile-acl-ai.md]] | Enterprise tier depends on dispatch module maturity |
| [[proposals/approved/bundle-lifecycle-gates-phase-2.md]] | Scheduled compliance scans connect to time-based gate triggers |
| [[proposals/bundle-chat-session-panel.md]] | Chat dual-mode enterprise depends on server-side AI from this bundle |
| [[plans/completed/phase-1-containerization.md]] | Server AI runs as a service alongside the existing containerized Web UI |

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Kubernetes / Helm deployment | A separate proposal; container orchestration is independent of this feature set |
| Remote registry sync | A separate proposal; enterprise multi-vault coordination is Phase 4+ |
| Multi-tenant SaaS deployment | Not a FOSS self-hosting concern; out of scope for DocWright core |
| SSO / SAML integration | Forgejo OAuth covers Phase 3; enterprise SSO is Phase 4+ |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-06 | Created — consolidated from 4 individual deferred proposals | NetYeti |
