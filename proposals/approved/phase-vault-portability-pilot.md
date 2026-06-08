---
title: Phase 3 — Vault Portability, Real-World Pilot & Upstream Contribution Pipeline
author: NetYeti
created: 2026-06-08
tags:
  - phase-3
  - vault-portability
  - dogfooding
  - msp-pilot
  - architecture
  - contribution-pipeline
  - dual-mcp
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
_path: proposals/phase-vault-portability-pilot.md
consumed_by: plans/phase-vault-portability-pilot.md
---

## Problem

DocWright is currently both the tool and its own vault — they live in the same
repository. This works for development, but creates several gaps:

- We cannot confidently say where DocWright ends and "a vault" begins
- The `DOCWRIGHT_ROOT` env var exists but is applied inconsistently — the Web UI
  uses it in 20+ routes, but `scripts/mcp-server.py` still anchors to `__file__`
  and `.claude/settings.json` hooks use hardcoded absolute paths to the DocWright
  tree. The concept is right; the implementation is partial.
- No version pinning model — a vault cannot track which DocWright version it runs
  against or upgrade safely without risking vault content
- No structured contribution channel — when a vault operator discovers a DocWright
  gap, there is no path to get that back into DocWright's development backlog
- We are building a governance tool for other organizations. Until we use it to
  govern something other than itself, we are speculating about whether it works.

## Proposed Solution

Insert as Phase 3, with former Phase 3 (Profile + ACL + AI) renumbered to Phase 4
and former Phase 4 (Cascade STEAM) renumbered to Phase 5. Versioning continues as
`0.3.x` for this phase.

**Prerequisite:** Phase 2 gate review by NetYeti must complete before Phase 3 work
begins.

**Goal:** Deploy DocWright against an external vault (a non-profit MSP management
project), complete the tool/vault separation architecture, and create a structured
feedback pipeline so real-world usage directly drives DocWright's evolution.

### Architecture: Tool / Vault Separation

```
~/Projects/
  DocWright/                  ← the tool (versioned, tagged)
    src/                      ← engine + web UI
    scripts/                  ← mcp-server, hooks, contrib pipeline
    plans/                    ← DocWright's OWN development plans
    proposals/                ← DocWright's OWN proposals
    policies/core/            ← DocWright's OWN core policies
    example-vault/            ← starter template
    MIGRATION.md              ← per-tag breaking change manifest (new)

  nonprofit-msp/              ← a vault (separate git repo)
    .docwright/
      config.json             ← DocWright path, version pin, profile, consent settings
      contributions.log       ← audit record of everything sent upstream
    .mcp.json                 ← two MCP server entries (vault + upstream)
    .claude/
      settings.json           ← PreToolUse hook pointing to DocWright scripts via $DOCWRIGHT_PATH
    .env                      ← DOCWRIGHT_PATH, DOCWRIGHT_VAULT_ROOT, DOCWRIGHT_GITHUB_TOKEN
    plans/                    ← MSP plans
    proposals/                ← MSP proposals
    policies/                 ← MSP policies
    docs/
      friction-log.md         ← staged DocWright gaps (async fallback)
    profile.json              ← optional: vault-level overrides atop bundled profile
```

The vault is a plain git repo. DocWright is installed separately, referenced by
`DOCWRIGHT_PATH`. The vault contains no copy of DocWright's code.

### Path Resolution: No Hardcoded Paths

A key invariant: no DocWright path is ever hardcoded in vault-side files. All
references use `$DOCWRIGHT_PATH` from `.env`:

- `.mcp.json` server `command` entries reference `$DOCWRIGHT_PATH/scripts/...`
- `.claude/settings.json` hooks use `bash $DOCWRIGHT_PATH/scripts/...`
- `docwright init` writes `.env` with `DOCWRIGHT_PATH` as its first step
- A machine change or DocWright move requires updating `.env` only

### Three-Layer Contribution Architecture

**Layer 1 — Live dual-MCP (in-session)**

The vault's `.mcp.json` defines two servers:

```json
{
  "mcpServers": {
    "dw-vault": {
      "command": "node",
      "args": ["$DOCWRIGHT_PATH/scripts/mcp-server.js"],
      "env": { "DOCWRIGHT_VAULT_ROOT": "/path/to/nonprofit-msp" }
    },
    "dw-upstream": {
      "command": "node",
      "args": ["$DOCWRIGHT_PATH/scripts/mcp-server.js", "--mode", "upstream"],
      "env": {
        "DOCWRIGHT_VAULT_ROOT": "$DOCWRIGHT_PATH",
        "DOCWRIGHT_GITHUB_TOKEN": "$DOCWRIGHT_GITHUB_TOKEN"
      }
    }
  }
}
```

`dw-vault` governs vault content (plans, proposals, policies for the MSP project).
`dw-upstream` governs DocWright's development repo and exposes the contribution
pipeline tools. Both are the same TypeScript MCP server binary — the `--mode upstream`
flag switches which vault root and tool set it exposes, avoiding the complexity and
duplication of two separate server codebases.

The AI routes content appropriately:
- "Firewall upgrade plan" → `dw-vault` → `nonprofit-msp/plans/`
- "Field validation gives unhelpful error" → `dw-upstream` → DocWright proposal

**Layer 2 — Friction log (async fallback)**

When working outside Claude Code or when dual-MCP is unavailable, friction points
are staged in `docs/friction-log.md`. A `log_friction(description, category)` tool
on `dw-vault` creates well-formed entries — no new CLI infrastructure needed:

```markdown
| Date | Category | Description (sanitized) | DocWright Issue | Sent |
| --- | --- | --- | --- | --- |
| 2026-06-10 | ux-friction | assigned_to validation fails silently on plan creation | — | ⬜ |
```

Categories: `bug`, `feature-request`, `ux-friction`, `docs-gap`, `missing-abstraction`.

**Layer 3 — Contribution pipeline (sanitized, consented)**

`dw-upstream` exposes `contribute_upstream`. The consent model follows the same
pattern as `HUMAN_APPROVED=1` already established in this project — a human-set
environment variable the AI cannot forge:

```
contribute_upstream(
  title: string,
  description: string,
  category: "bug" | "feature-request" | "ux-friction" | "docs-gap",
  docwright_version: string
) → github_issue_url | prefilled_url
```

**Consent enforcement:** The tool reads `DOCWIGHT_CONTRIB_APPROVED=1` from the
environment. The AI proposes the contribution and the command to run; the human
adds `DOCWIGHT_CONTRIB_APPROVED=1` to their shell and executes it. The server
rejects calls where the env var is absent or `0`. This is identical in spirit to
`HUMAN_APPROVED=1` — the human is the one who sets the environment, not the AI.

**Sanitization schema (enforced at the MCP tool layer):**
Allowed fields: `title` (string, max 120 chars, no file paths or wikilinks),
`description` (string, max 2000 chars, no `[[...]]` wikilinks, no internal IDs),
`category` (enum), `docwright_version` (semver string). The server validates this
schema and rejects payloads with disallowed content. The AI fills the fields; the
tool enforces the constraints. The human sees a preview before `DOCWIGHT_CONTRIB_APPROVED=1`.

**GitHub auth:** `DOCWRIGHT_GITHUB_TOKEN` in `.env` (optional). If present, the
tool creates a GitHub issue directly and returns the issue URL. If absent, it
generates a pre-filled `https://github.com/growlf/docwright/issues/new?...` URL
with title, body, and labels encoded — the human opens it and clicks Submit. The
contribution is logged to `.docwright/contributions.log` either way.

**Deduplication:** When a token is present, the tool calls the GitHub search API
before creating an issue (`is:issue repo:growlf/docwright <title words>`) and
surfaces any matches for the human to review. Deduplication is advisory, not
blocking — the human decides whether to link to an existing issue or create a new one.

### Version Pinning and Migration

`.docwright/config.json`:

```json
{
  "docwright_version": "0.2.4",
  "docwright_path": "/home/netyeti/Projects/DocWright",
  "profile": "org-operations",
  "upstream_repo": "https://github.com/growlf/docwright"
}
```

DocWright tags include a `MIGRATION.md` at the repo root. Format:

```markdown
## 0.2.5 → 0.3.0
- BREAKING: `status` field renamed to `lifecycle_status` in plan frontmatter
  - Run: `npm run vault:migrate -- --vault /path --from 0.2.5 --to 0.3.0`
- BREAKING: MCP tool `update_plan_status` replaced by `transition_status`
```

`npm run vault:migrate` reads `MIGRATION.md`, applies only the steps between the
pinned version and the target version, updates `config.json`, and never touches
vault content (plans, proposals, policies). Non-breaking upgrades: update
`config.json` version field only.

### Profile Override Layer

A vault places `profile.json` at its root to extend the bundled profile. Merge
semantics are field-type-aware:

- **Scalar fields** (`name`, `version`, scalar feature flags): vault value replaces bundled value
- **Object fields** (`features`): deep merge, vault keys override matching bundled keys
- **Array fields** (`requiredFrontmatter`, `states`, `documentTypes`):
  - Prefixed with `+` (e.g., `"+requiredFrontmatter"`) → **append** to bundled array
  - Unprefixed → **replace** the bundled array entirely

Example — MSP vault adding one required field without touching the rest:

```json
{
  "+requiredFrontmatter": ["service_tier"]
}
```

## Deliverables

1. **Vault-portable TypeScript MCP server with `--mode` flag** (carried from Phase 2
   Deliverable 7) — `DOCWRIGHT_VAULT_ROOT` and `--mode upstream` as first-class
   config; single binary serves both vault and upstream modes; zero hard-coded paths;
   replaces `scripts/mcp-server.py`

2. **Contribution pipeline tools** — `dw-upstream` mode exposes: `contribute_upstream`
   (with consent enforcement, sanitization schema, GitHub auth/fallback),
   `log_friction` (also available on `dw-vault`), `list_docwright_issues`,
   `create_docwright_proposal`; `MIGRATION.md` format defined and first entry written

3. **Hook install and path resolution** — `npm run hook:install -- --vault /path`
   installs pre-commit hook; `npm run init` writes `.env` with `DOCWRIGHT_PATH`;
   `.claude/settings.json` template uses `$DOCWRIGHT_PATH` throughout — no hardcoded
   absolute paths anywhere in vault-side files

4. **`.mcp.json` template** — vault-side config wiring `dw-vault` and `dw-upstream`
   using `$DOCWRIGHT_PATH`; generated by `docwright init`

5. **`docwright init` scaffold** — `npm run init -- --dest /path --profile org-operations`
   creates vault directory structure, writes `.env` (with `DOCWRIGHT_PATH`),
   `.docwright/config.json`, `.mcp.json`, `.claude/settings.json`, installs hooks,
   writes `profile.json` stub and `docs/friction-log.md`

6. **`vault:migrate` script** — reads `MIGRATION.md`, applies versioned steps between
   pinned and target versions, updates `config.json`; never touches vault content

7. **Profile override merge** — profile engine implements field-type-aware merge
   (scalar replace, object deep-merge, `+array` append vs array replace)

8. **MSP pilot vault** — a real git repository for managing a local non-profit's
   managed services; initialized via `docwright init`; org-operations profile;
   policies covering: service catalog, change management, incident response,
   security baseline, onboarding; minimum viable bar: at least one complete
   proposal→plan→completed cycle managed entirely through DocWright, with the
   Web UI, MCP governance, and lifecycle gate all functioning correctly against
   the external vault

9. **Friction log tooling** — `log_friction(description, category)` on `dw-vault`
   MCP; structured entry format defined; review cadence documented in
   `docs/friction-log.md` header

10. **Architecture boundary document** — `docs/vault-portability.md` in the DocWright
    repo: what the tool provides, what the vault provides, what the interface is
    (env vars, config.json schema, `.mcp.json` template, hook install, MIGRATION.md
    format); becomes the canonical reference for new vault deployments

## Dependency on Phase 2

Phase 2 must be formally gate-reviewed and closed before Phase 2.5 begins.

Deliverable 1 here (vault-portable TypeScript MCP server) carries over from Phase 2
Deliverable 7. Building it here, with vault portability and `--mode upstream` as
design constraints from day one, produces a better result than retrofitting.

The profile engine runtime (Phase 2 Deliverable 1) defers to Phase 4, where full
profile engine work is already planned. The vault profile override (Deliverable 7
here) is the interim solution that unblocks the pilot without waiting for Phase 4.

## What This Phase Produces Beyond Code

The MSP pilot is a continuous feedback source. Every friction point is either:
- Routed live to DocWright's backlog (`dw-upstream` MCP, when in-session)
- Staged in the friction log (async, always available)
- Promoted to a GitHub issue (contribution pipeline, with consent)

The GitHub issues accumulated from real-world usage become the primary input for
Phase 4+ prioritization. This phase also establishes the contribution culture:
any organization running DocWright can participate in its improvement, safely and
deliberately.

## Alternatives Considered

**Git submodule:** DocWright as a submodule in each vault. Rejected — submodules
are painful for non-developers and blur the tool/vault boundary in the git graph.

**npm package:** DocWright installed as a CLI. Not yet feasible — the AI governance
layer (hooks, MCP, Claude skills) cannot be `npm install`ed. Worth revisiting Phase 4+.

**Two separate MCP server binaries (vault vs upstream):** Rejected in favor of a
single binary with `--mode` flag — avoids duplicate codebases and simplifies
distribution.

**Automatic sanitization without schema enforcement:** Rejected — "code over memory"
principle requires machine-enforceable constraints on what can be sent, not AI judgment alone.

**Fold into Phase 2:** Phase 2 is already scoped to CI, FOSS hygiene, TypeScript
MCP server, and profile engine. Adding vault portability and a contribution pipeline
would diffuse focus and delay the pilot.

**Wait for Phase 4:** The pilot should inform Phase 4 priorities, not follow them.

## Future

- Remote `dw-upstream` endpoint hosted by DocWright — vault operators without a
  local DocWright clone point at a hosted API instead of a local path; enables
  contribution pipeline for organizations that don't run DocWright in dev mode
- Additional pilot vaults (Cascade STEAM is the next natural candidate)
- Aggregated, anonymized contribution dashboard: common friction categories across
  all consenting vault operators
- Phase renumbering (2.5 → 3, current 3 → 4, current 4 → 5) as a housekeeping
  proposal once Phase 2.5 is complete and versioning implications are clear
- `docwright init` evolves into a container image or web installer (Phase 4+)
- Profile marketplace: organizations share vault-level `profile.json` extensions
