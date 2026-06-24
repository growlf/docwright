---
title: "External proposal store — move proposals out of git"
author: NetYeti
created: 2026-06-24
tags:
  - architecture
  - proposals
  - governance
  - database
  - mcp
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
status: deferred
deferred_reason: "Requires Phase 3 vault write API and knowledge graph foundations before the MCP adapter layer can be cleanly abstracted."
---

## Problem

Proposals live in `proposals/*.md` inside the git repository. This is the wrong
tool for discussion artifacts:

- Every edit to a proposal creates a commit, polluting the graph with noise that
  has no relationship to shipping code
- Diffs are meaningless — "clarified wording in paragraph 2" is not a meaningful
  change worth versioning
- Proposal history (who said what, what was debated) is lost in git commit messages
  rather than preserved as threaded discussion
- PRs that touch proposal files are indistinguishable from PRs that ship features
- Git branch protection rules make editing proposals bureaucratic for what is
  inherently an informal, iterative, discussion process

The correct split: **plans belong in git** (they are execution artifacts tied to
branches, issues, and auditable code changes); **proposals belong outside git**
(they are discovery artifacts — high churn, pre-decision, no code coupling).

## Proposed Solution

Replace `proposals/*.md` with an external backing store. The store could be:

- A simple PostgreSQL or SQLite table (self-hosted, aligns with DocWright's
  no-telemetry, self-sovereign philosophy)
- A Forgejo/GitHub issue tracker (proposals as issues, approved = specific label)
- Linear, Notion, or similar (for orgs that already use these)
- A DocWright-managed flat JSON/YAML store outside the git working tree

The key abstraction: a **proposal store adapter** in the MCP layer. The existing
`transition_to_approved` tool reads a proposal file and generates a plan. With
the adapter, it would instead query the external store by ID, and the rest of the
lifecycle machinery stays unchanged.

### Adapter interface

```typescript
interface ProposalStore {
  get(id: string): Promise<Proposal>;
  list(filter?: ProposalFilter): Promise<Proposal[]>;
  create(proposal: Proposal): Promise<string>;       // returns id
  update(id: string, fields: Partial<Proposal>): Promise<void>;
  transition(id: string, newStatus: ProposalStatus): Promise<void>;
}
```

Built-in implementations:
- `GitFileProposalStore` — current behavior, reads/writes `proposals/*.md`
  (default until the external store is configured; allows zero-migration rollout)
- `ForgejoPRStore` — uses Forgejo/GitHub issues API
- `SqliteProposalStore` — local SQLite file outside the git tree

The active store is selected by `opencode.json` → `proposal_store.type`.

### Migration path

1. Ship `GitFileProposalStore` (wraps current behavior, zero change for existing
   vaults)
2. Ship `SqliteProposalStore` (opt-in; run `npx docwright migrate:proposals` to
   export existing `.md` files into the DB and remove them from git)
3. Ship `ForgejoPRStore` for orgs that want proposals as trackable issues

The `proposals/` directory becomes a staging area during transition and is
eventually removed from `.gitignore`-tracked paths.

## Alternatives Considered

**Keep proposals in git but in a separate orphan branch** — still pollutes the
repo, adds complexity, and solves none of the discussion-threading problem.

**Use a submodule for proposals** — solves the commit graph problem but adds
submodule complexity and still has no threading support.

**Move proposals to a wiki (GitHub/Forgejo wiki)** — wikis have their own git
repo, same problem. No structured frontmatter support.

## Dependencies

- Phase 3 vault write API (`plans/completed/sub-plan-vault-write-api.md`) —
  the move/rename/field-set abstraction this builds on
- MCP TypeScript server (already complete) — the adapter hooks in here
- Profile engine override merging (already complete) — `proposal_store.type`
  reads from `opencode.json` vault override

## Future

- Proposal comment threads stored alongside the proposal record
- Proposal search and filtering in the Web UI (replaces the current
  `proposals/*.md` file tree sidebar)
- Cross-vault proposal federation — surfacing relevant proposals from
  other vaults in the collation panel

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-24 | Created — captured from session discussion | NetYeti |
