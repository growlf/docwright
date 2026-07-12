---
title: "Plan: DocWright dev-cloud instances — dogfood, csdocs, cs-erp-images, msp-pilot"
status: draft
author: "NetYeti"
created: "2026-07-11"
created_by: "NetYeti@phoenix"
tags: [planning]
proposal_source: "proposals/approved/three-docwright-instance-deployment.md"
priority: medium
phase: 
automated: guided
waiting_reason:  # Populated when status = waiting-for-user
assigned_to: ["NetYeti"]
# parent_plan: phase-N-overview.md   # filename of parent plan (omit if top-level)
# parent_deliverable: "1"            # row number in parent's Deliverables table
related_to: []
depends_on: []
blocks: []
reviewed_by:
reviewed_date:
canceled_date:  # Populated when plan is canceled
cancellation_reason:  # Populated when plan is canceled
template_version: "1.0"
tests_defined: true
tests_human_reviewed: false  # Set to true after human certifies AI-generated tests
# Gate fields — populated when a lifecycle gate applies to this document
gate_reviewer:  # Who must review (set automatically by gate rules)
gate_status:    # pending | approved | waived
gate_date:      # Stamped when gate_status is set
gate_note:      # Optional reviewer note
gate_reviews: []  # Phase 1a — array of {reviewer, role, status, date, note}
gate_quorum: 1    # Phase 1a — minimum approvals needed
---

# Plan: DocWright dev-cloud instances — dogfood, csdocs, cs-erp-images, msp-pilot

## Mode

Plan modes: `off` (mentorship), `guided` (agent drafts, human approves), `full` (autonomous).

**MENTORSHIP MODE — Human leads, LLM advises**

- Human carries out tasks their own way
- LLM provides SOP compliance checks and safety warnings
- LLM offers suggestions when human asks for help

## Overview

### Problem

DocWright development and Cascade STEAM adoption both depend on running DocWright
instances, but the deployment landscape is ad hoc. The csdocs vault (Cascade STEAM)
has no managed instance and is only reachable via a developer-launched dev server.
The cs-erp-images pipeline runs against a dev-server instance with the plugin loaded
via a local symlink (`plugins/erp-images` → a developer home directory), which is not
reproducible on any other machine.

**Current state (2026-07-05) — all four instances are live and proxied.** Each runs on the
BMS dev-cloud host (`10.10.0.201`, user `gemini`) behind an NPMPlus proxy host (VIP
`10.10.0.11`, `*.bms.local`) → the instance's port, with Technitium A records pointing the
hostnames at the VIP. Wiring is a single idempotent Ansible playbook
(`bms-ai-cluster:ansible/playbooks/configure-docwright-dev-cloud.yml`, ticket **BMS-0091**,
resolved).

| # | Instance | Hostname | Port | Mode / vault |
|---|----------|----------|------|--------------|
| 1 | dogfood-dev | `docwright-dev.bms.local` | 5173 | dev-mode from clone (`~/Projects/DocWright-development`), `dogfood` branch, serves itself |
| 2 | csdocs | `csdocs.bms.local` | 5274 | release v0.4.7 container, vault `csdocs` |
| 3 | erp-images | `erp-images.bms.local` | 5275 | release v0.4.7 container + `erp-images` plugin (loaded from the vault repo), vault `cs-erp-images` |
| 4 | msp-pilot | `msp.bms.local` | 5276 | release v0.4.7 container, vault a dedicated `bms-ai-cluster` clone |

- The earlier `:5273` Docker dogfood (tracked `main`) was **retired** (container, image, and
  auto-update cron removed); instance 1 replaced it in dev-mode.
- Release **v0.4.7** was cut to carry the reverse-proxy `allowedHosts` fix and the
  `/api/watch` crash fix; instances 2–4 are pinned to it. A plugin-loader fix
  (`DOCWRIGHT_ROOT` fallback) has since landed on `main` — until the next release, instance 3
  sets `DOCWRIGHT_VAULT_ROOT` via a compose override so its plugin loads.
- All four verified: `dig → 10.10.0.11`, HTTP via the VIP → 200, websockets on.

**Still open** (see Deferred proposals below): git-push auth (per-repo deploy keys) for
instances 2–4, the instance-3 tool-vs-customer-data guardrail + backup store, and per-user
OAuth attribution. Interim commit identity is a transparently-labeled static service identity.

This scheme was designed across two parallel working sessions and captured twice
(this proposal and a `dogfood`-branch design draft) — itself an instance of the
coordination failure [[policies/core/capture-deferred-ideas]] and the multi-agent
collaboration model warn about. This proposal is the reconciled **single source of
truth**; it supersedes the earlier `dogfood`-branch design draft
(`docs/deployment-bms-devcloud.md`), now retired.

### Security considerations

- Instances 2, 3, and 4 face non-developer users: auth must be enabled (no `AUTH_MODE=none`),
  and governance write paths (approve, complete, channel promotion) must carry the
  authenticated actor — the dev-server "Dev User" attribution bug must not ship here.
- The plugin in instance 3 executes in DocWright's DOM and server; the release pinning
  plus plugin-spec enforcement is the containment boundary. Plugin version must be
  pinned alongside the DocWright release.
- Empty-image deployment (§Step 8 of the process-flow plan) already excludes
  DocWright-project content from the image; verify the same guarantee for both
  release-pinned instances so vault content never bakes into an image.
- **Git push auth** for instances 2–4 uses **per-repo deploy keys** (SSH, scoped,
  revocable) stored in VaultWarden (`bitwarden.bellinghammakerspace.org`), mounted into
  the containers — not a broad PAT.
- **Actor attribution is phased.** Real per-user attribution needs OAuth login (deferred
  proposal below). Until then, the sequencing is open: keep instances 2–4 gated to trusted
  users, and/or commit under a **transparently-labeled static service identity** (never
  misrepresenting per-user authorship). The `AUTH_MODE=none` "Dev User" attribution bug
  must not ship to instances 2–4 regardless.
- **Instance 4 note:** `bms-ai-cluster` carries its own governance hooks (helpdesk-ticket
  enforcement on infra commits). DocWright governs the vault's documents; the repo's
  existing hooks continue to govern its infra/Ansible commits — the two layers coexist.

### Verification

- Each instance boots from its committed deployment definition on a clean host.
- `csdocs` and `cs-erp-images` report the same DocWright release version; `msp-pilot`
  reports a tagged release; dogfood reports its tracked ref.
- cs-erp-images plugin loads and registers its views on instance 3 without any
  symlink into a developer checkout.
- Instance 4 completes a full governance lifecycle (proposal → … → archive) against the
  `bms-ai-cluster` vault entirely through the Web UI + MCP tools, with zero manual edits.
- Auth verified on instances 2–4; UI-driven commits attribute the real actor.

### Alternatives considered

- **Single shared instance with vault switching** — rejected: version policy differs
  per audience (dev-fresh vs release-stable), and a plugin needed by one vault would
  load for all.
- **Keep dev-server launches per vault** — rejected: not reproducible, no auth story,
  developer-machine dependency.

### Deferred proposals (to capture)

Per [[policies/core/capture-deferred-ideas]], these are set aside from this proposal and
must each be captured as their own proposal:

1. **Multi-user OAuth identity → per-user git attribution** — the real auth solution
   (Web UI OAuth + GitHub/Forgejo identity + ACL) that lets instances 2/3 attribute
   UI-driven commits to the actual actor.
2. **Customer-data backup store** — NAS/Ceph, access-limited, encryption, retention; Tier C
   handling and the eventual CS → BMS backup flow.
3. **Tool-repo customer-data guardrail** — commit-time enforcement + naming lint that keep
   CS-specific data/names out of `cs-erp-images` ([[policies/core/code-over-memory]]).
4. **Multi-instance deployment tooling** — generalize the retired dogfood `update.sh` +
   compose into a parameterized, repeatable per-instance deploy mechanism.

### Future

- Reconsider instance 1's tracking (long-lived `dogfood` branch vs a `beta` release
  channel) once a release cadence is established (noted in the 2026-07-02 session).
- Fold instance definitions into the Phase 5 Cascade STEAM production infrastructure
  plan (Forgejo, ACL, AI stack) when that phase opens; the MSP-pilot vault (instance 4)
  becomes a reference deployment for new adopters (per the MSP sub-plan's Future).


## Implementation Steps

> When marking a task ✅ Complete, update every step row in this table
> to reflect what was actually built. Stale ⏳ rows mislead reviewers.

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | | | ⏳ Pending |

## Testing Plan



## Rollback Procedures



## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| | | | |

## Phase Gate

- [ ] All implementation steps resolved (delivered or formally deferred with captured proposals)
- [ ] Test coverage defined and human-reviewed (`tests_human_reviewed: true`)
- [ ] Deferred ideas captured as proposals before closing (see [[policies/core/capture-deferred-ideas.md]])
- [ ] Rollback procedures documented
- [ ] Risk assessment completed

## Testing Plan

### Step Verification

- [ ] All implementation steps complete and outcomes verified

### Integration & Regression

- [ ] Existing tests pass without modification (`npm test`)
- [ ] TypeScript compiles cleanly (`npm run typecheck`)
- [ ] Plan: DocWright dev-cloud instances — dogfood, csdocs, cs-erp-images, msp-pilot functionality works end-to-end

### Gate Criteria

- [ ] `tests_defined` set to `true` in frontmatter
- [ ] Human reviewer has verified step outcomes above
- [ ] No regressions introduced to adjacent workflows

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-11 | Created | NetYeti |
