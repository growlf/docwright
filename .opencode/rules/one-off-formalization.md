# Rule: One-Off Scripts Must Trigger Formalization Proposals

## The rule

When you run a one-off bash script, ad-hoc Python snippet, or multi-step
command that operates on multiple files or handles a recurring lifecycle
event, STOP and ask yourself:

> "Have I (or OpenCode) done this before? If yes — create a `priority: 4`
> proposal for the formalized version before moving on."

## What counts as a formalization candidate

An operation needs a proposal if it matches any of:
- Multi-file loop (`for f in ...; do git mv/grep/sed ...`)
- Repeated grep across lifecycle directories to find anomalies
- A "fix" applied after a hook rejection that will recur
- A script called more than once in a session with similar args
- Any command derived from memory or prior session notes

## Proposed form — pick the right one

| Type | When to use |
|------|-------------|
| **Skill** (`.opencode/skills/`) | Interactive workflow a human triggers |
| **MCP tool** | Mutation that must be validated and audited |
| **npm script** | Utility that runs in CI or as a dev convenience |
| **Dispatch endpoint** | Operation that belongs in the surface-agnostic engine |
| **CI check** | State invariant that must be verified on every commit |

## Proposal contents (minimum)

- What the one-off did (pseudocode is fine)
- What lifecycle event triggers it
- Which formalized form is appropriate and why
- Set `priority: 4` — recurring gaps are high priority

## Why this matters

One-offs are memory. Formalized tools are code. The "code over memory" policy
([[policies/core/code-over-memory.md]]) applies directly: if you caught yourself
writing a loop to fix something, that loop belongs in a tool — not in your
next session's improvised recall.
