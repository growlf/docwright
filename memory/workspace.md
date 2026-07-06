# Working Memory — DocWright / Cowork Session

## Me
NetYeti (Garth Johnson, garth.johnson@cascadesteam.org)  
BDFL of DocWright. GitHub: growlf / growlfd@gmail.com

## Project

**DocWright** — FOSS organizational operating system for policy-driven teams.  
Version: 0.4.5 (phase-driven: 0.MINOR = phase number)  
Status: Pre-alpha. Phases 0–3 complete. Phase 4 in progress.  
License: MIT

## The Two Folders

| Folder | Purpose | Writable? |
|--------|---------|-----------|
| `~/Projects/DocWright` | Main branch — active CLI dev (another Claude instance) | **Read-only** in Cowork |
| `~/Projects/DocWright-cowork` | Cowork working copy — agent-roles parallel work | Yes |

Cherry-pick review runs every morning at 8am and at the start of each session.  
Say "session start" or "sync check" to trigger a live comparison.

## Active Plans

| Plan | Status | Priority |
|------|--------|----------|
| `webui-write-integrity` | in-progress | high — Steps 2–6 remain |
| `lifecycle-gates` | draft | high |
| `collaboration-issue-model-and-roadmap-sync` | draft | high |
| `phase-4-profile-acl-ai` | draft | medium |
| `phase-5-cascade-steam` | draft | medium |

## Key Proposal — Agent Roles (this branch's focus)

File: `proposals/agent-roles-model-routing.md`  
Branch: `agent-roles` (parallel to main — proposal lives in main, impl in branch)  
Core idea: Replace flat generalist-per-session with **capability-scoped agent roles**, each with a bounded tool allowlist and a model assignment.

### The role taxonomy
| Role | Domain | Notes |
|------|--------|-------|
| **Registrar** | Document state machine | exists: `docwright-lifecycle` |
| **Release Warden** | Git, PRs, CI, versioning | |
| **Security Auditor** | Audit, hardening | read-mostly |
| **Surveyor** | Infra discovery, device YAMLs | |
| **Incident Responder** | P1–P4 response | exists: `docwright-incident`, Bash denied |
| **Triage** | Bug/gap/idea capture | `capture_bug_report` workflow |
| **Session** | Session bookends | stays a skill, not a subagent |
| **Critic** | Adversarial review of plans/proposals | multi-perspective-review enforcer |

**The constitution** (never delegated to any role): ai-governance-boundaries, workflow-layer-governance, no-telemetry, dispatch invariants.

### Model routing intent
Route narrow/mechanical tasks to smaller/cheaper models (Haiku, Gemini Flash).  
Route privacy-sensitive/high-volume work to local models via growlf/ai-stack + growlf/meshy.

## Terms & Acronyms

| Term | Meaning |
|------|---------|
| BDFL | Benevolent Dictator For Life — NetYeti's project role |
| BMS | (Build/Meshy/Stack) — dev-cloud infrastructure |
| MCP | Model Context Protocol — tool server standard |
| ADR | Architecture Decision Record |
| PR | Pull Request |
| OCC | Optimistic Concurrency Control |
| ACL | Access Control List |
| SSE | Server-Sent Events (live reload) |
| WYSIWYG | Web UI editor mode |
| Forgejo | Self-hosted git server (recommended for DocWright) |
| ai-stack | growlf/ai-stack — i9 Ultra + Xe iGPU local AI inference |
| meshy | growlf/meshy — inference proxy for ai-stack |
| Cascade STEAM | Reference implementation / real-world pilot org |
| phoenix | Appears in agent creation context (created_by: NetYeti@phoenix) |
| capture_bug_report | MCP tool — always use before hand-filing bugs |
| agent-roles | The parallel branch / Cowork focus area |
| leap-frog | Cherry-picking fixes from main into a parallel branch |

## Key Policies (core/)

- `ai-governance-boundaries` — AI never sets approved/completed/gate_status
- `bugs-before-features` — known bugs resolved before new features
- `code-over-memory` — automate enforcement; don't rely on AI memory or discipline
- `multi-perspective-review` — triangulate between Claude, BigPickle, BDFL
- `workflow-layer-governance` — plan mutations go through MCP tools, never direct writes
- `capture-deferred-ideas` — every plan/proposal that sets something aside must capture it

## Open Issues Summary

36 open issues total, 26 are bugs.  
Key clusters: endsession/git workflow, lifecycle gate parity, WYSIWYG corruption, hook/identity, report-intake UX.

## Architecture Invariants (never break)

1. Dispatch module has ZERO VS Code API deps
2. Frontmatter is source of truth; index.json is derived cache only
3. Git is canonical store — no auxiliary database
4. No telemetry. Ever.
5. `author-role:` is audit record, not enforcement mechanism

## Cowork Setup State

- Engineering plugin: installed
- Connectors: none connected yet (Slack, Linear, Atlassian, PagerDuty, Datadog available)
- Folders: both mounted (DocWright read-only, DocWright-cowork read-write)
- Cherry-pick briefing: scheduled daily 8am
