---
title: "Separate DocWright self-development from vault governance: code-issues, milestones, and a beta channel"
author: "NetYeti"
created: "2026-06-30"
tags:
  - governance
  - process
  - lifecycle
  - milestones
  - dogfooding
  - deployment
  - roadmap
category:
  - governance
complexity: high
approved: false
priority: high
created_by: "NetYeti@cluster-llm"
assigned_to: []
related_to:
  - docs/roadmap.md
  - proposals/phases-and-the-master-plan-are-mostly-invisible-to-the-user.md
  - proposals/formalize-roadmap-sequencing-enforcement.md
  - proposals/external-proposal-store.md
  - policies/core/bugs-before-features.md
  - policies/core/code-over-memory.md
  - policies/core/versioning.md
  - policies/core/capture-deferred-ideas.md
  - policies/core/workflow-layer-governance.md
depends_on: []
blocks: []
author-role: contributor
---

# Separate DocWright self-development from vault governance: code-issues, milestones, and a beta channel

> **Discussion:** [GitHub issue #68](https://github.com/growlf/docwright/issues/68) (urgent).
>
> **Status note:** This is an *urgent* umbrella proposal capturing a base plan for
> overall improved process flow. It is the governance decision; the implementation
> work it authorizes will be filed as separate code-issues and sub-plans — which is
> itself the first exercise of the split this proposal defines. Marked urgent: it is
> to be fully detailed, discussed, and planned before further feature work resumes.

## Summary

DocWright currently tracks four structurally different kinds of work — code bugs,
product features, project-governance policy, and architecture decisions — in a single
`proposals/` lifecycle, per branch. Because DocWright dogfoods itself, "the DocWright
product" and "the DocWright project's self-governance" share one repo and one bucket,
so the two constantly blur. The result is tail-chasing: a branch carries both a code
fix and a policy question, and neither resolves cleanly.

This proposal establishes:

1. A clear **code-issue vs. governance** split (the "is the deliverable a diff?" test).
2. DocWright **self-development as a separable concern**, expressed as three *distinct*
   levers — a profile (grammar), an in-vault store (location), and an access layer
   (contributor federation + an end-user bridge) — that we deliberately do **not**
   collapse into one "profile."
3. A user-facing **bug-reporting bridge** with suggest-style duplicate detection that
   increments a **demand signal** (without becoming telemetry).
4. **Milestones** as a planning unit *below* phases, surfaced through a **derived**
   roadplan view with a `future` bucket — so we can always see where we *are* and where
   we are *going*.
5. **Beta as a release channel** (`dev → beta → stable`), orthogonal to the version
   number, promoted by explicit BDFL declaration, gated on a demand-weighted open-bug
   count.
6. A **deployment model**: the Docker image ships empty of all DocWright-project content
   and mounts the user's folder as the vault.

## Problem Statement

**The conflation is real and visible on disk.** As of this writing there are **zero**
GitHub Issues; everything flows through `proposals/`. In that one folder, `bug-*.md`
files (pure code defects — deliverable is a diff) sit beside product strategy
(`bundle-enterprise-tier.md`), process/governance (`formalize-roadmap-sequencing-enforcement.md`),
and architecture (`external-proposal-store.md`). Four kinds of work, one lifecycle, one
per-branch treatment.

Three consequences:

1. **Tail-chasing.** A single branch tries to be both a code fix and a policy decision.
   Closing one leaves the other half-done or silently dropped.
2. **The DocWright product and the DocWright project blur.** Because we dogfood, "fix the
   WYSIWYG editor" (product code) and "bugs-before-features" (project self-governance)
   live in the same place with the same ceremony, even though they have different
   audiences, cadences, and homes.
3. **No measurable release signal.** "Stable enough to share" is unquantifiable when bugs
   are not tracked as a distinct, countable class.

Notably, the model we need **already half-exists**: the bundled `org-operations` profile
defines `inbox → issue → proposal → plan → policy/decision/work`. There is a first-class
`issue` state *before* `proposal`. Dogfooding simply collapsed `issue` and `proposal`
into one folder. This proposal is largely a decision to **honor the taxonomy DocWright
already ships**, plus the one question that profile does not answer (where issues live).

## Proposed Solution

### 1. The sorting test: code-issue vs. governance

- **Is the deliverable a diff?** → **code-issue**, closed by a PR.
- **Is the deliverable a durable rule/decision/spec that outlives any single diff?** →
  **governance** (proposal → plan → policy/decision).
- **Both?** → split into one of each, **cross-linked**: the governance doc owns *what &
  why*; the code-issue owns *make it so*.

Worked examples: `policies/core/code-over-memory.md` is a policy (durable rule); the hook
that enforces it is a code-issue. `bug-human-approved-precommit-check-broken.md` is a pure
code-issue. `bugs-before-features.md` is a pure policy.

### 2. DocWright self-development as a separable concern — three levers, not one

The instinct to "make DocWright governance a profile so its data is always available in
any vault" bundles three different needs. A profile is **stateless grammar applied to the
active vault**; it carries no data and has no opinion about location. Naming all three
"profile" rebuilds the same confusion one layer up. So we keep them separate:

- **Grammar — a `docwright-dev` profile.** Document types `code-issue`, `bug`, `proposal`,
  `plan`, `policy`, `decision` become first-class instead of everything being a "proposal."
  Additive, low-risk, and dogfoods the Phase-2 profile engine.
- **Store — in-vault `issues/` markdown.** Code-issues live as markdown in *this* repo.
  This keeps the invariants intact (*git is canonical; no auxiliary database; no
  telemetry*). Because the repo is public, these files remain network-readable for the
  bridge (below) without any external store.
- **Access — federation + bridge.**
  - **Contributors** get the dev vault by *having the repo* (federation = local,
    git-native, offline-fine). Extend the existing Phase-1 *project registry + vault
    switching* from "switch between vaults" to "mount a secondary always-on source."
  - **End users** (Docker, no repo) get a **bridge** that reports upstream. Because their
    container ships empty (§6), the bridge talks to the dev tracker **over the network** —
    the one unavoidable external call, and an acceptable one: it touches the *product's*
    tracker, not the *user's* vault governance.

GitHub Issues becomes the **public intake channel** that feeds the inbox; triaged,
accepted issues live in `issues/`. This maps exactly onto `org-operations`' `inbox → issue`.

### 3. The bridge: suggest-style dedup + demand signal

When a report arrives, run duplicate detection (reuse the Phase-1 *collation / overlap
detection stub*, not a new subsystem):

- **Suggest, never auto-reject.** "These look similar — is one of them yours?" Auto-
  rejecting a real-but-similar report is worse than a duplicate.
- **Exact dupe → `+1`** on the canonical issue's demand count. **Related → record the
  association** (lighter weight), do not fully increment, or loosely-similar reports
  inflate the count into a lie.
- **Harvest context, not just the tally.** Each report carries a distinct
  environment/repro/"what I was trying to do." Attach those to the canonical issue; the
  goldmine is the *spread of contexts*, not the number.
- **Count recency, and be honest about units.** On an anonymous bridge the count is
  *report events*, not *distinct users*. Name it that way.
- **The telemetry line — must not be crossed.** An *explicit* user report is a support
  ticket we may count. *Passive* or automatic detection of "N installs hit this error" is
  telemetry and is forbidden (invariant: "No telemetry. Ever."). The demand count is built
  **only** from explicit reports.

Payoff: the user gets instant status ("already tracked, targeted for an upcoming patch"),
and the project gets a real, user-grounded prioritization signal that feeds the beta gate
(§5) and reinforces `bugs-before-features`.

### 4. Milestones (below phases) + derived roadplan

- **Granularity:** a milestone sits **below a phase**. A phase contains several milestones;
  a milestone ≈ a patch/beta checkpoint. Phases stay BDFL/`phase-close`-owned and drive
  `0.MINOR`; milestones are the finer planning + release-channel unit inside a phase.
- **Source of truth:** each issue/plan carries `milestone:` in frontmatter. Every open
  item has one — a real milestone, or the literal `future`. No orphans (lintable;
  *code-over-memory*).
- **The roadplan is a *derived view*, not hand-maintained prose.** Per invariant #2
  (frontmatter is truth; the cache is derived), the "where we are / where we're going"
  view is *generated* from `milestone:` fields — current milestone, next milestone, and
  the `future` pool. It cannot drift, because it is computed. This directly resolves
  `phases-and-the-master-plan-are-mostly-invisible-to-the-user.md` and feeds
  `formalize-roadmap-sequencing-enforcement.md`.
- **The `future` bucket is the anti-paralysis valve.** Only the current + next milestone
  are planned in detail; everything else is swept into `future` coarsely. "Determine
  milestones before enacting" never becomes "plan everything before doing anything."
- **Timeframes converge; they are not accurate on day one.** Estimates derive from
  *velocity × remaining issues*. DocWright has no velocity history yet (pre-alpha, zero
  closed issues in the new tracker), so early estimates are rough and sharpen as
  closed-issue history accrues — a byproduct of simply using the system.

### 5. Beta as a release channel — the dogfood lifecycle and gate

Beta is a **channel**, not a version state. `dev → beta → stable` is orthogonal to the
version number: the number keeps counting per [[policies/core/versioning.md]]; the channel
gates *who gets the build*. Each release cycle runs a four-stage lifecycle:

1. **Scope** — at cycle start, the milestone-determination cycle (§4) defines what's in
   this release: the milestone's issue set.
2. **Build → code-complete + feature-complete** — the scope is built. This is the
   **ENTER-beta trigger**: scope-completeness (off the milestone/roadmap) *auto-proposes*
   the transition; the BDFL confirms. Bugs may still be open — that is the point of beta.
3. **Dogfood (beta)** — drive to **bug-complete *within scope***. The bridge + demand
   count (§§2–3) run hottest here.
   - **In-scope bug** → must be resolved before stable.
   - **Out-of-scope bug** surfaced during dogfood → a logged `decision`: defer to the next
     cycle or to the `future` catch-all. Default to automatic-with-override (low
     severity/demand → `future`; high → flagged for next-cycle scoping).
   - **Fast-track intake** → scope is mostly frozen but admits genuinely urgent items
     mid-cycle (see below).
4. **bug-complete + BDFL sign-off → stable** — channel flips to stable, **PATCH version
   bump** (the "release bump"), milestone closes, next determination cycle begins.

**What counts as "within scope":** (a) bugs in code this milestone changed, **plus** (b)
any regression this milestone caused, regardless of where it surfaces. Pre-existing,
unrelated bugs merely *discovered* during dogfood are out-of-scope and defer — otherwise a
milestone is held hostage to the entire pre-existing backlog and never ships.

**Fast-track intake (not a scope-creep loophole):** security issues **auto-qualify**;
client-reported bugs qualify only above a severity/demand bar; each admission is a logged
`decision`, and admitting one **flexes the release date, not the quality bar** (consistent
with releases being a BDFL call and no hard ETAs).

**The gate is severity-primary, demand-weighted, and human-sealed:**
- **Computed readiness (necessary):** `0 open in-scope blockers` + `0 open in-scope majors
  above demand-threshold N` + a **minimum dogfood window** (must span a real dogfood
  session, not a fixed clock, while the project is small) + non-negative bug burn-down.
  Only blockers and high-demand majors gate — everything else ships and rolls into the next
  milestone (this is the anti-paralysis valve, §4).
- **BDFL sign-off (sufficient):** flipping `beta → stable` is an explicit human call,
  **never** AI-automated. The code *surfaces* the readiness dashboard; the human flips the
  switch. This is the honest reconciliation of "I feel it's stable" with code-over-memory —
  the feeling must be backed by the dashboard, but the dashboard never ships on its own.

**Severity is mutable, and kept honest:** a bug's severity is re-evaluated as the codebase
changes (an adjacent fix can mitigate it). A **downgrade must cite the specific change that
mitigates it**, and we distinguish **"mitigated"** (bug still open, severity lowered because
a workaround/adjacent fix landed) from **"fixed"** (closed). Severity changes are
history-stamped. This prevents "severity can change" from becoming a way to wish a blocker
past the gate.

This lifecycle *embodies* two existing policies: the bug-complete-before-release gate **is**
`bugs-before-features` at the release level, and the defer/fast-track calls are `decision`
documents.

### 6. Deployment: empty image, mounted vault

- The **repo** holds DocWright's own dev governance (`proposals/`, `plans/`, `policies/`,
  `issues/`), governed by `docwright-dev`.
- The **Docker image** is built with those directories **excluded** (a `.dockerignore`
  line). It boots with no DocWright-project content and mounts the **user's folder** as
  the vault.
- "Empty" means *empty of DocWright-project content* — **not** empty of the engine or
  bundled profiles. `org-operations`, templates, and dispatch all bake into the image.
  Standard "config baked in, data mounted" practice; this is what makes the model simple.

## The bootstrap sequence

These pieces must be stood up in order, and the new machinery's *first use* is organizing
the existing backlog:

1. **Design** the base process-flow plan — *this proposal*.
2. **Document + set up** the machinery: `docwright-dev` profile, `issues/` store, the
   `milestone:` field + lint, the derived roadplan view, the bridge scaffold, the empty-
   image build.
3. **Milestone-determination cycle** — the first real use: sort the existing backlog into
   current / next / `future`, and generate the roadplan.
4. **Enact**, immediately after.

Milestone determination is a **recurring cadence**, not one-time: re-run it at each
milestone close, analogous to `phase-close`. A `milestone-close` helper is a natural
formalization target *later* — only after the manual cycle has run once (see
[[.opencode/rules/one-off-formalization.md]]).

## Pitfalls and how we address them

| Pitfall | Mitigation |
|---|---|
| External store for "always available" breaks invariants / air-gap | Contributor *federation* (local repo) + in-vault `issues/`; only the end-user bridge reaches the network, and it degrades gracefully (queue + dedup server-side) when offline |
| Private client context leaking into a public tracker via the bridge | Bridge never auto-sends; redaction + explicit confirm step |
| Demand count drifting into telemetry | Count **explicit reports only**; passive detection forbidden |
| Dedup mislabeling a distinct bug as a dupe | Suggest, never auto-reject; user confirms |
| Roadplan rotting (today's "invisible master plan") | Roadplan is *derived* from `milestone:` frontmatter, not hand-maintained |
| Over-planning / analysis paralysis | `future` bucket; only current + next milestone planned in detail |
| Overstating timeframe accuracy | State explicitly that estimates converge with velocity history; no day-one promises |
| Dogfooding tension (tracking our own code outside the vault) | Code-issues stay *in-vault* (`issues/`); GitHub Issues is intake only |

## Alternatives Considered

- **All dev → GitHub Issues / external DB accessible by all clients.** Rejected as the
  primary store: reintroduces a network/auth dependency and hard-blocks air-gapped Forgejo
  orgs, and undercuts dogfooding. Retained only as the *public intake channel*.
- **Split DocWright-dev into its own repo.** Rejected (for now): non-developers deploy via
  Docker and never clone, so a second repo adds sync burden with no benefit. Revisit only
  if a real contributor pain emerges. One repo.
- **Keep merging `issue` and `proposal`.** This is the status quo that causes the
  tail-chasing. Rejected.

## Implementation (filed as code-issues / sub-plans — dogfoods this split)

This governance decision authorizes, but does not itself perform, the following — each to
be tracked as a code-issue or sub-plan once the `issues/` store exists:

- `docwright-dev` profile (manifest, schema, templates with `author-role:`).
- `issues/` store + `code-issue`/`bug` templates; migrate existing `bug-*.md`.
- `milestone:` frontmatter field + "every open item has a milestone" lint.
- Derived roadplan view (generated, replaces hand-maintained sections of `docs/roadmap.md`).
- Bridge: capture surface, suggest-style dedup (reuse collation stub), demand count,
  redaction/confirm, offline queue.
- Release-channel field + UI; BDFL-only `beta → stable` promotion.
- `.dockerignore` exclusion of DocWright-project content from the image.

## Future

- `milestone-close` formalization (after the manual cycle runs once).
- Velocity-based timeframe estimation once closed-issue history exists.
- Forgejo-issues intake parity for self-hosters (mirror of the GitHub intake channel).
