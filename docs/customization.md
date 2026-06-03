---
title: "DocWright Customization Guide"
status: active
author: NetYeti
created: 2026-06-03
tags:
  - documentation
  - customization
  - white-label
  - configuration
---

# DocWright Customization Guide

DocWright is designed to be adopted by any organization without forking.
Most customization is done through files in the vault root — no code changes
required.

---

## Brand / White-Label

### Vault name and text logo

Create `brand.json` in the vault root:

```json
{
  "name": "Cascade STEAM"
}
```

The sidebar header and status page title will show **Cascade STEAM** instead
of the vault directory name.

### SVG logo

To replace the text name with an SVG logo, add a `logoPath` pointing to an
SVG file inside the vault:

```json
{
  "name": "Cascade STEAM",
  "logoPath": "brand/logo.svg"
}
```

Place your SVG at `brand/logo.svg` (or any path within the vault). The logo
is displayed at max height 24px in the sidebar header and mobile title bar.
The `name` field is used as the `alt` attribute.

**Requirements:**
- The file must be inside the vault root (no `../` escapes)
- SVG format recommended; PNG/JPEG also work but may not scale as cleanly
- Keep the file under ~20KB for fast inline loading

### What is always shown

The sidebar brand area is fully replaceable. The DocWright attribution
(name, MIT license, GitHub link) always appears in the **footer bar** at
the bottom of the UI — small and unobtrusive, but always present.
This is intentional: white-labeling the brand does not remove attribution.

---

## Vault Profile

The active profile controls document types, lifecycle states, frontmatter
schema, and AI instructions. Set it in `opencode.json` at the vault root:

```json
{
  "profile": "org-operations"
}
```

Available bundled profiles:
| Profile | Use case |
|---------|----------|
| `org-operations` | Inbox → issue → proposal → plan → policy/decision *(default)* |
| `doc-lifecycle` | Proposal → plan → completed/canceled |
| `infra-topology` | Planned → active → decommissioned |
| `knowledge-base` | LLM Wiki pattern (Karpathy) — Ingest/Lint/Save-to-Wiki |

Custom profiles: place a `profile.json` in `src/profiles/[name]/` following
the profile schema. See `src/profiles/org-operations/profile.json` for the
reference implementation.

---

## AI Instructions

DocWright uses OpenCode (`opencode serve`) as its AI backend. To configure
the AI's behaviour for your vault, edit (or create) `opencode.json`:

```json
{
  "mcp": {
    "docwright": {
      "type": "local",
      "command": ["node", "dist/mcp-server.js"],
      "args": ["--vault", "."]
    }
  },
  "agents": {
    "docwright-assist": {
      "model": "anthropic/claude-sonnet-4-5",
      "instructions": "You are helping manage a DocWright vault for Cascade STEAM..."
    },
    "docwright-critic": {
      "model": "anthropic/claude-sonnet-4-5",
      "instructions": "You are a critical reviewer. Find problems. Be direct."
    }
  }
}
```

The `docwright-assist` agent is the default AI helper. The `docwright-critic`
agent is used by the "Second Opinion" feature (multi-perspective review).
You can point these at any OpenCode-supported provider — local Ollama models,
OpenAI, Gemini, etc.

---

## File Tree Filtering

Files hidden from the sidebar "Docs" view (shown in "All Files" mode only)
are controlled by `EXCLUDE_ROOT` in `FileTree.svelte`. This list is
intentionally hardcoded for now; it will move to `profile.json` in Phase 3.

Current hidden root files: `AGENTS.md`, `CHANGELOG.md`, `CLAUDE.md`,
`CONTRIBUTING.md`, `LICENSE`, `NOTICE.md`, `PROPOSAL.md`, `SESSION-LOG.md`,
`SECURITY.md`.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCWRIGHT_ROOT` | `../..` from `cwd` | Absolute path to the vault root |
| `PORT` | `5173` | SvelteKit dev server port |

Set `DOCWRIGHT_ROOT` when running the web UI from a different working
directory than the vault:

```bash
DOCWRIGHT_ROOT=/path/to/my-vault npm run dev
```

---

## Planned (not yet available)

- **Settings UI** — in-app editor for `brand.json` (see
  `proposals/ui-white-label-brand-settings.md`)
- **Profile picker** — switch profiles without editing `opencode.json` (Phase 3)
- **Custom CSS theming** — vault-level colour overrides (post-launch)

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created | NetYeti |
