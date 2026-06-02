---
title: Project Registry
status: completed
completed_date: 2026-06-02
author: NetYeti
created: 2026-06-02
tags:
  - core
  - workflow
  - registry
  - multi-repo
---

# Project Registry

The project registry enables DocWright to discover and resume work across
multiple external vaults without the docwright repo ever tracking references
to them.

## Location

`.docwright/registry.json` (gitignored) at the docwright repo root.

## Structure

```json
{
  "projects": [
    {
      "name": "Example Project",
      "path": "../example-infra",
      "profile": "infra-topology",
      "last_session": "docs/session-notes/session_note_yyyymmdd.md"
    }
  ]
}
```

## Components

| Component | Path | Purpose |
|-----------|------|---------|
| Example file | `.docwright/registry.example.json` | Tracked template for new checkouts |
| Dispatch module | `src/dispatch/registry.ts` | `loadRegistry`, `listProjects`, `updateLastSession`, `addProject`, `removeProject` |
| API endpoint | `src/webui/src/routes/api/registry/+server.ts` | Serves registry to the Web UI |
| Layout | `src/webui/src/routes/+layout.svelte` | Renders project list in sidebar |
| Skill | `.opencode/skills/docwright-project/SKILL.md` | AI agent instructions for switching vaults |

## Usage

- **Agent:** "switch to Project X" → `docwright-project` skill provides procedure
- **Web UI:** Project list shown below file tree in sidebar
- **Programmatic:** `import { loadRegistry } from 'src/dispatch/registry'`

## Invariants

- Registry is **never committed** — `.docwright/.gitignore` has `*`
- DocWright repo remains "virgin" — no tracked references to external projects
- Each project vault is standalone; no shared state between registries
