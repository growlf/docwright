# DocWright

**Organizational operating system for policy-driven teams.**

DocWright is a governance layer — not just an editor — that connects an organization's values, decisions, and daily work through a policy-grounded document hierarchy. All state lives in plain Markdown files with YAML frontmatter, in a git repository, accessible from multiple client surfaces without vendor lock-in.

**Design philosophy:** Security first. Policy driven. Test verified at every stage.

## What it is

```
Inbox (ideas, issues, observations)
  → Issues → Proposals → Plans → Policies / Decisions
                                       → Work Items → Code (OpenCode)
```

*   **Web UI** — primary interface for all contributors (SvelteKit, rendered Markdown, AI chat panel, ACL-gated actions)
*   **VSCodium extension** — power tool for developers (lifecycle enforcement, git workflow, OpenCode integration)
*   **Logseq** — optional graph explorer (opens the same vault folder, read-only)

## Status

Pre-alpha. Phase 0 (spike) in progress. See [PROPOSAL.md](./PROPOSAL.md) for the full architecture specification.

## Quick start (coming in Phase 1)

```bash
# Install the VSCodium extension (once published)
# Open any folder — org-operations profile activates automatically
# Ctrl+Shift+P → "docwright: New Inbox Item"
```

## For AI agents and Claude Code

See [CLAUDE.md](./CLAUDE.md) — read this first when starting a new session. Full project context and decision log: https://drive.google.com/drive/folders/1XMK0Cxil65xzpXFWdMABp5i-5BHDgaZ-

## License

MIT — see [LICENSE](./LICENSE)
