# one-off-formalization

## Rule

When you run a one-off bash script, ad-hoc snippet, or multi-step command that operates on multiple files or handles a recurring lifecycle event, stop and ask: "Have I done this before?" If yes — create a `priority: 4` proposal for the formalized version before moving on.

One-offs are memory. Formalized tools are code.

## Rationale

Every time a recurring operation runs as a one-off, it depends on the AI correctly remembering the steps from a prior session. This is a known failure mode. Formalizing the operation as a Skill, MCP tool, npm script, or CI check makes it reproducible without memory. See `policies/core/code-over-memory.md`.

## Examples

Triggers this rule:
- `for f in proposals/*.md; do grep -l "approved: true" $f; done` — if this runs more than once, it needs an npm script
- A multi-step `git mv` sequence to reorganize plans — if done in a session before, formalize as a skill
- A sed pass to normalize frontmatter values — if recurring, formalize in `adopt-vault.ts` or as an MCP tool

Does NOT trigger:
- A one-time exploratory grep to understand the codebase
- A one-time file rename for a specific plan

## Scope

Applies during plan execution (`scope: plan`) and session wrap-up (`scope: session`). The proposal is `priority: 4` and tagged with the relevant formalization type (skill, mcp-tool, npm-script, dispatch-endpoint, ci-check).
