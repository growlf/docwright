# Policy Atom Framework — Concept Note v0.1

## Origin
Spun out of a Docwright retrospective: rather than treating AI-governance rules as
one monolithic document enforced wholesale by an MCP layer, decompose policies into
small, standalone, individually-enforceable "atoms" — each with three synchronized
representations sized for different consumers (AI triage, AI enforcement, human review).

## Purpose of policies (general)
Policies exist to convert "unknowns" into "knowns" ahead of time — pre-deciding common
cases so agents (human or AI) don't reason from scratch or escalate every decision.
Best practice (per PaC research) emphasizes: decoupling policy evaluation from
application logic, atomicity/single-responsibility per rule, versioning, and
normalizing overlapping rules into a non-redundant set.

## The Policy Atom
Each atom = one folder/unit containing:

- **meta.yaml** — id, title, version/hash, scope/trigger conditions, enforcement
  type (blocking / warning / advisory / informational), one-line synopsis (<25 tokens)
- **ai-context.md** — structured deeper tier: rule as condition → action/prohibition,
  1-2 compliant/violating examples, rationale (what failure this prevents)
- **human.md** — canonical full-prose tier, source of truth for people

## Two-pass consumption model
- **Pass 1 (always loaded):** synopsis index (all atoms' meta) — cheap, lets any
  agent at any context size see what categories of rules might apply
- **Pass 2 (on demand):** ai-context.md for atoms flagged in-scope by Pass 1
- **Pass 3 (rare):** human.md, pulled only for ambiguity resolution or human review

## Sync mechanism
ai-context.md and meta.yaml are derived artifacts carrying a content hash of
human.md. A lightweight checker flags "stale derivation" when human.md changes
without regenerating the derived tiers.

## Generic build process
1. Inventory failure modes / "unknowns" for the domain
2. Draft human.md first (domain experts edit this)
3. AI-assisted generation of ai-context.md + synopsis, human-reviewed
4. Tag scope/trigger metadata carefully (this drives routing)
5. One folder per atom, not one big file
6. Build sync-checker + index-builder as a generic, project-agnostic tool

## "Instincts" insight (added during follow-up)
If atoms are truly atomic, most are checkable as pure deterministic code (field
presence, status-transition legality, naming/structure rules) — zero AI tokens,
millisecond cost. Only a minority of atoms have conditions that genuinely require
judgment (e.g. "is this description specific enough"). The schema must distinguish
these from the start via a `check_kind: deterministic | judgment` field, so the
router never invokes an AI for atoms that don't need it. This is what keeps the
guardrail layer cheap and lets human+AI attention concentrate on actual goals
rather than process overhead — atomic policies become "instincts," not deliberation.

## Resolved: library, not service, not embedded-per-project
Build `policy-atoms-core` as an importable library (index-builder, router,
sync-checker). Docwright imports it and points it at its own `policies/` for
manager-level rules, and at `<project>/policies/` for each managed project's own
rules — same engine, two independent atom sets per managed project, never merged.
Promote to a standalone MCP service only if/when multiple projects need shared
*runtime* access to one identical atom set.

## Layout
```
docwright/
  policies/              <- Docwright's own manager-of-projects policies
    plan-lifecycle/<NNN-slug>/{meta.yaml, ai-context.md, human.md}
  projects/<project>/
    policies/            <- that project's own domain policies, same format
```

## Enforcement: three-tier resolution
Each atom's `enforcement` field is a DEFAULT (general best-practice baseline), not
final. Two optional override layers, resolved at runtime:

- **Instance config** (`<host>/instance-config.yaml`, user-editable) — per-installation
  overrides, keyed by atom id.
- **Org policy bundle** (optional; doesn't exist in all environments) — signed/
  hashed bundle, FETCHED FRESH at resolution time (not trusted from local cache),
  keyed by atom id, can mark entries `floor: true` meaning instance config cannot
  weaken below it.

Resolution order: atom default -> instance override -> org override (org `floor: true`
always wins regardless of instance setting). Resolver output per atom: resolved
`enforcement` value + `resolution_source` (default/instance/org) for audit trail.

### Non-bypass mechanism (for when org policy exists)
Local resolver signature-check stops casual tampering but not deletion of the org
bundle entirely. Real guarantee has to live at a point the individual doesn't
control: a remote gate (git pre-receive hook / shared CI / a network-fetched bundle
an MCP tool re-fetches each time rather than caching). Local resolver = catches
honest mistakes; remote gate = catches deliberate bypass attempts.

### Status
Org-bundle transport is UNDEFINED — nothing in the homelab is a natural trust
anchor yet, and no org context currently exists to need one. Design the resolver's
org-bundle input as a pluggable "source" (interface only: fetch + verify + parse),
implement transport later once a real org-governance need exists. This was the
core motivation for this whole deep-dive: get the framework/interfaces right now,
before any specific org need forces a rushed implementation.

## Atom schema (meta.yaml) — settled shape
```yaml
id: plan-lifecycle-001
title: ...
synopsis: "..."                  # Pass 1 index entry
check_kind: deterministic | judgment
scope:
  event_types: ["plan.status_transition"]   # host-defined vocabulary, lib just matches
  conditions: { target_status: "active" }   # always cheap/deterministic to evaluate
check:                            # deterministic: type+params from a small built-in
  type: field_required            # library of check types (field_required,
  field: "owner"                  # status_transition_allowed, regex_match,
                                   # linked_artifact_exists, etc.)
                                   # judgment: type: llm_eval -> router loads
                                   # ai-context.md, hands off to host's AI mechanism
enforcement:
  default: blocking
version: 1
source_hash: <sha256 of human.md>
```

## Deferred: semantic prefilter (Olla-backed)
At small-to-moderate atom counts (dozens to low-hundreds, even across DocWright's
own `policies/` + several managed projects' `policies/`), Pass 1's flat synopsis
index + deterministic scope/condition match is already cheap — no RAG needed.

SCALE TRIGGER: if the combined synopsis index across DocWright + all managed
projects grows large enough that Pass-1 token cost or match time becomes
measurable, add an optional "tier 0.5" semantic prefilter ahead of the existing
deterministic match: embed all synopses at atom-registration time, embed the
current task description at routing time, vector-search to narrow to top-N
candidates before deterministic scope/condition matching runs on that subset.

Olla (existing routing/proxy layer) is the natural host for the embedding model
(e.g. quantized BGE/nomic-embed on Frank) — local, cheap, off the main agent's
context entirely. Router interface gains one optional step:
`semantic_prefilter(query) -> [atom_ids]`, ahead of the current deterministic
match. Define this seam only when the scale trigger is actually hit, not now.

## Status / next steps
- [ ] Define small built-in deterministic check-type library
- [ ] Define resolver interface (atom default + instance config + pluggable org source)
- [ ] Decompose first 2-3 real plan-lifecycle rules from Docwright's existing
      ai-governance-enforcement.md into this format (real content, not illustrative)
- [ ] Sketch policy-atoms-core public API (index-builder, router, resolver, sync-checker)

## Open design question (next discussion)
Should the Pass 1→Pass 2 routing live in:
- (A) A standalone "policy atom server" (MCP service) any project points at with
  its own atom directory — reusable core, bigger initial build, or
- (B) Each project's own MCP embedding its own copy of the routing/sync logic —
  faster to ship, duplicated logic across projects

Leaning toward (A) given Docwright already has MCP infra — Docwright becomes first
consumer of a generic policy-atom server, atoms for plan-lifecycle rules become the
first decomposed set, reusable later for Meshy/helpdesk/Cascade STEAM docs.
