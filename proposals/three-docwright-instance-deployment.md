---
title: "Three DocWright instance deployment — dogfood, csdocs, cs-erp-images"
author: NetYeti
created: 2026-07-04
tags:
  - deployment
  - docker
  - release-channel
  - dogfooding
  - cascade-steam
  - plugins
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
priority: 2
---

## Problem

DocWright development and Cascade STEAM adoption both depend on running DocWright
instances, but the deployment landscape is ad hoc. Only one instance exists today —
the Docker dogfood deployment on :5273 stood up 2026-07-02 — and it tracks `main`
rather than releases. The csdocs vault (Cascade STEAM) has no deployed instance and
is only reachable via a developer-launched dev server. The cs-erp-images pipeline
runs against a dev-server instance with the plugin loaded via a local symlink
(`plugins/erp-images`), which is not reproducible on any other machine.

This scheme was designed in an earlier working session but was never captured as a
proposal — a direct instance of the failure mode [[policies/core/capture-deferred-ideas]]
exists to prevent. This proposal writes it down and puts it through governance.

## Proposed Solution

Stand up **three managed DocWright instances**, each with a distinct role, version
policy, and vault:

| # | Instance | Vault | DocWright version | Extras | Purpose |
|---|----------|-------|-------------------|--------|---------|
| 1 | **dogfood** | the DocWright repo itself | tracks development (`main` for now; release channel once the release cadence exists) | — | DocWright develops DocWright; surfaces bugs before users hit them |
| 2 | **csdocs** | `csdocs` (Cascade STEAM) | **latest tagged release** | — | Real organizational use; leadership access; stability over freshness |
| 3 | **cs-erp-images** | `cs-erp-images` | **same release as csdocs** | `cs-erp-images` plugin | Frappe/ERPNext image pipeline driven through the DocWright plugin surface |

Key properties:

- **Version discipline.** Instances 2 and 3 are pinned to the same tagged release,
  consistent with the branching policy that `main` HEAD is not guaranteed deployable —
  consume tagged releases. The dogfood instance is the only one allowed ahead of a release.
- **Plugin delivery.** Instance 3 must load the cs-erp-images plugin through a
  declared, reproducible mechanism (image layer, mounted plugin dir, or manifest) —
  not a developer-machine symlink.
- **One deployment definition per instance**, kept in git (compose file or equivalent),
  so the setup is code, not memory ([[policies/core/code-over-memory]]).

## Security Considerations

- Instances 2 and 3 face non-developer users: auth must be enabled (no `AUTH_MODE=none`),
  and governance write paths (approve, complete, channel promotion) must carry the
  authenticated actor — the dev-server "Dev User" attribution bug must not ship here.
- The plugin in instance 3 executes in DocWright's DOM and server; the release pinning
  plus plugin-spec enforcement is the containment boundary. Plugin version must be
  pinned alongside the DocWright release.
- Empty-image deployment (§Step 8 of the process-flow plan) already excludes
  DocWright-project content from the image; verify the same guarantee for both
  release-pinned instances so vault content never bakes into an image.

## Verification

- Each instance boots from its committed deployment definition on a clean host.
- `csdocs` and `cs-erp-images` report the same DocWright release version; dogfood
  reports its tracked ref.
- cs-erp-images plugin loads and registers its views on instance 3 without any
  symlink into a developer checkout.
- Auth verified on instances 2 and 3; UI-driven commits attribute the real actor.

## Alternatives Considered

- **Single shared instance with vault switching** — rejected: version policy differs
  per audience (dev-fresh vs release-stable), and a plugin needed by one vault would
  load for all.
- **Keep dev-server launches per vault** — rejected: not reproducible, no auth story,
  developer-machine dependency.

## Future

- Move dogfood from tracking `main` to tracking the `beta` channel once the release
  cadence is established (noted in the 2026-07-02 session).
- Fold instance definitions into the Phase 5 Cascade STEAM production infrastructure
  plan (Forgejo, ACL, AI stack) when that phase opens.
