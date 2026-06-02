# Contributing to docwright

Thank you for your interest in contributing. docwright is MIT-licensed and
welcomes contributions from the community.

## Before You Start

Read `CLAUDE.md` for architectural context and `PROPOSAL.md` for the full spec.
For significant changes, open an issue first so we can discuss the direction.

## Development Setup

```bash
git config core.hooksPath .githooks   # activate commit hooks (once, after cloning)
npm install
npm run compile      # TypeScript compile check
npm run lint         # ESLint
npm run test:dispatch  # Run dispatch unit tests (outside extension host)
```

The `.githooks/` directory contains a pre-commit hook (frontmatter validation,
identity/network info) and a commit-msg hook (conventional commit format).
The `core.hooksPath` line above wires git to use them — without it the hooks
are silently skipped.

## The Most Important Rule

**The dispatch module (`src/dispatch/`) must have zero VS Code API dependencies.**

The CI pipeline runs `npm run test:dispatch` outside the extension host.
If you import anything from `vscode` in `src/dispatch/`, the tests will fail.
This is intentional and must never be bypassed.

## Code Style

- TypeScript strict mode throughout
- ESLint + Prettier (run `npm run lint` before committing)
- All public dispatch functions must be unit-testable with a plain filesystem mock

## Templates and Profiles

All profile templates (`src/profiles/*/templates/*.md`) **must** include
the `author-role:` frontmatter field. Default value: `contributor`.
This is a hard requirement — see PROPOSAL.md §6 for rationale.

## Pull Request Process

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `npm run lint && npm run test:dispatch` — both must pass
4. Submit a PR with a clear description of what changed and why
5. PRs require one reviewer approval before merge

## Profile Authoring

To add a new bundled profile, create a directory under `src/profiles/[name]/`
containing: `profile.json`, `schema.json`, `opencode-instructions.md`,
and `templates/` with one `.md` file per document type.
See `src/profiles/doc-lifecycle/` as the reference implementation.

## Attribution

If your contribution incorporates patterns, code, or concepts from other
projects, add them to `NOTICE.md`. See the existing entries for format.

## Governance

docwright uses a BDFL model. NetYeti (growlf) makes final decisions.
All significant decisions are documented in `PROPOSAL.md` and `CHANGELOG.md`.
