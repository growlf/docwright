---
title: "DocWright dev-cloud instances — dogfood, csdocs, cs-erp-images, msp-pilot"
author: NetYeti
created: 2026-07-04
tags:
  - deployment
  - docker
  - release-channel
  - dogfooding
  - cascade-steam
  - plugins
  - msp-pilot
  - bms
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
priority: 2
---

## Problem

DocWright development and Cascade STEAM adoption both depend on running DocWright
instances, but the deployment landscape is ad hoc. The csdocs vault (Cascade STEAM)
has no managed instance and is only reachable via a developer-launched dev server.
The cs-erp-images pipeline runs against a dev-server instance with the plugin loaded
via a local symlink (`plugins/erp-images` → a developer home directory), which is not
reproducible on any other machine.

**Current state (2026-07-04).** All four deployments target the BMS dev-cloud host
(`10.10.0.201`, user `gemini`), fronted by NPMPlus (`10.10.0.11`, `*.bms.local`):

- **Instance 1 (dogfood) is live.** The earlier `:5273` Docker dogfood that tracked
  `main` has been **retired** (container, image, and auto-update cron removed). Instance 1
  now runs in **dev-mode from a git clone** (`~/Projects/DocWright-development`,
  `npm run dev` on `:5173`) on the long-lived `dogfood` branch, serving **itself** as its
  vault. Reachable at `http://10.10.0.201:5173`; planned entrypoint `docwright-dev.bms.local`.
- **Instances 2–4 are not yet stood up** — they depend on unresolved decisions
  (git-push auth, service identity, and for instance 3 the tool-vs-customer-data
  separation and backup store).

This scheme was designed across two parallel working sessions and captured twice
(this proposal and a `dogfood`-branch design draft) — itself an instance of the
coordination failure [[policies/core/capture-deferred-ideas]] and the multi-agent
collaboration model warn about. This proposal is the reconciled **single source of
truth**; it supersedes the earlier `dogfood`-branch design draft
(`docs/deployment-bms-devcloud.md`), now retired.

## Proposed Solution

Stand up **four managed DocWright instances**, each with a distinct role, version
policy, and vault:

| # | Instance | Vault | DocWright version | Extras | Purpose |
|---|----------|-------|-------------------|--------|---------|
| 1 | **dogfood-dev** | the DocWright repo itself (serves itself) | dev-mode from clone on the long-lived `dogfood` branch, leap-frogged from `main` | — | DocWright develops DocWright *through* DocWright; surfaces bugs before users hit them |
| 2 | **csdocs** | `csdocs` (Cascade STEAM) | **latest tagged release** | — | Real org use; leadership early access (consumes [[proposals/approved/sub-plan-cascade-steam-early-access]]); stability over freshness |
| 3 | **cs-erp-images** | `cs-erp-images` | **same release as csdocs** | `cs-erp-images` plugin | Frappe/ERPNext image pipeline driven through the DocWright plugin surface |
| 4 | **msp-pilot** | `bms-ai-cluster` (Bellingham Makerspace infra) | **latest tagged release** | profile override (infra/MSP policies) | Real-world MSP pilot — full governance-lifecycle validation (consumes [[proposals/approved/sub-plan-msp-pilot-vault]]) |

Key properties:

- **Version discipline.** Instances 2, 3, and 4 are pinned to a tagged release,
  consistent with the branching policy that `main` HEAD is not guaranteed deployable.
  Instances 2 and 3 share the *same* release (the plugin must match csdocs). The dogfood
  instance is the only one allowed ahead of a release.
- **Plugin delivery.** Instance 3 must load the cs-erp-images plugin through a
  declared, reproducible mechanism (image layer, mounted plugin dir, or manifest) —
  not a developer-machine symlink.
- **One deployment definition per instance**, kept in git (compose file or equivalent),
  so the setup is code, not memory ([[policies/core/code-over-memory]]).
- **Instance 1 runs from source, not a container** (live `npm run dev`), so the code it
  serves is the code under development. Its long-lived `dogfood` branch is periodically
  **leap-frogged** from `main` (pulling merged fixes in) while general improvements proven
  in dogfood are PR'd back upstream. Deployment-specific settings are **gitignored config /
  env vars** (e.g. `DOCWRIGHT_ALLOWED_HOSTS`), never uncommitted edits to tracked code.
- **Hostnames, not bare ports.** Each instance gets a purpose-obvious NPMPlus entrypoint
  (`docwright-dev.bms.local`, `csdocs.bms.local`, `erp-images.bms.local`, `msp.bms.local`)
  → `10.10.0.201:{5173,5274,5275,5276}`.

### Instances 2 & 4 — consumed Phase-3 sub-plans

Two already-approved Phase-3 sub-plans describe deployments this proposal now realizes, so
their substance is **merged here**. The UI has no way yet to consume/supersede or process
one governance doc into another (tracked by
[[issues/feature-ui-consume-and-process-governance-docs]]), so this merge is manual and the
sub-plans' **formal supersession is deferred** until that functionality exists — the docs
are `approved: true` and are deliberately **not transitioned here**.

- **Instance 2 (csdocs)** realizes [[proposals/approved/sub-plan-cascade-steam-early-access]]
  (Phase 3, deliverable #8): an early-access CS vault (no Forgejo/AI stack yet), seeded from
  the Drive vault content, so leadership can open the Web UI, read the seed, and submit their
  first proposal — de-risking Phase 5 before production infrastructure exists.
  *Acceptance bar:* leadership navigates the vault seed and submits a proposal with no
  manual file editing.
- **Instance 4 (msp-pilot)** realizes [[proposals/approved/sub-plan-msp-pilot-vault]]
  (Phase 3, deliverable #7): a real-world MSP pilot running a **complete** governance
  lifecycle (proposal → approve → plan → execute → complete → archive) entirely through the
  Web UI + MCP tools, with `bms-ai-cluster` as the vault. Exercises vault portability,
  `docwright init` scaffolding, profile override (MSP policies: service-catalog,
  change-management, incident-response, security-baseline, onboarding), and the contribution
  pipeline — the primary validation gate for the vault-portability architecture.
  *Acceptance bar:* full lifecycle with zero manual file edits; friction logged via
  `log_friction`.

Both migrate to their production homes when Phase 5 opens.

### Instance 3 — tool vs. customer-data separation (three tiers)

Instance 3 manages the **cs-erp-images tool repo** while the same plugin also drives
**real Cascade STEAM ERPNext deployments**. These must never mix:

- **Tier A — tool repo (`cs-erp-images`).** Image definitions named by **generic use-case
  intent** (`erp-msp-project_community`, never `cascadesteam`), `apps.json` → GHCR.
  Public/shareable, git-versioned. **This is the only tier instance 3 commits.** The
  generic-naming rule is what keeps customer identity out of the public repo.
- **Tier B — deployment mapping/config.** Which real customer runs which generic image,
  per-site settings. CS-specific; never in Tier A; lives on CS infra.
- **Tier C — customer backups / private data.** Real ERPNext data — **private customer
  data, not merely "sensitive."** Never in git, never casually on the dev host. A dedicated
  **access-limited store (NAS/Ceph)** with best-practice handling (encryption at rest,
  restricted access, retention).

**Trust boundary.** Instance 3 sits on the BMS dev-cloud **only while the tool foundation
is carved out.** The real deployment + customer data end up on the **CS environment**,
backing up to **BMS**.

## Security Considerations

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

## Verification

- Each instance boots from its committed deployment definition on a clean host.
- `csdocs` and `cs-erp-images` report the same DocWright release version; `msp-pilot`
  reports a tagged release; dogfood reports its tracked ref.
- cs-erp-images plugin loads and registers its views on instance 3 without any
  symlink into a developer checkout.
- Instance 4 completes a full governance lifecycle (proposal → … → archive) against the
  `bms-ai-cluster` vault entirely through the Web UI + MCP tools, with zero manual edits.
- Auth verified on instances 2–4; UI-driven commits attribute the real actor.

## Alternatives Considered

- **Single shared instance with vault switching** — rejected: version policy differs
  per audience (dev-fresh vs release-stable), and a plugin needed by one vault would
  load for all.
- **Keep dev-server launches per vault** — rejected: not reproducible, no auth story,
  developer-machine dependency.

## Deferred proposals (to capture)

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

## Future

- Reconsider instance 1's tracking (long-lived `dogfood` branch vs a `beta` release
  channel) once a release cadence is established (noted in the 2026-07-02 session).
- Fold instance definitions into the Phase 5 Cascade STEAM production infrastructure
  plan (Forgejo, ACL, AI stack) when that phase opens; the MSP-pilot vault (instance 4)
  becomes a reference deployment for new adopters (per the MSP sub-plan's Future).
