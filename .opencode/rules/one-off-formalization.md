# Rule: One-Off Scripts Must Trigger Formalization Proposals

## The rule

When you run a one-off bash script, ad-hoc Python snippet, or multi-step
command that operates on multiple files or handles a recurring lifecycle
event, STOP and ask yourself:

> "Have I (or OpenCode) done this before? If yes — create a `priority: 4`
> proposal for the formalized version before moving on."

## Live Methodology Capture

When you perform a multi-step investigative sequence (hardware discovery,
network mapping, cross-reference validation, relationship tracing), you
MUST record the method concurrently with execution — not as a deferred
proposal afterward.

### The requirement

For every investigative sequence you execute:

1. **Record the method as you go** — capture which commands ran against
   which targets, in what order, and why each step was chosen. This is not
   documentation about what happened; it is the method trace that proves
   the result is verifiable.
2. **Preserve the chain of custody** — each fact gathered must carry its
   provenance: who gathered it, from which source, at what time, via what
   tool/command, and validated against which alternative source.
3. **Corroboration is mandatory** — single-source facts are hypotheses.
   A fact is confirmed only when at least two independent sources agree
   (e.g. router ARP MAC + ipmitool BMC MAC, or dmidecode serial + chassis
   tag FRU). Log each corroboration explicitly.
4. **Capture negative evidence** — when something was expected but not
   found (e.g. "no ipmitool on this host", "port 443 unreachable"), record
   it. Absence of evidence is itself evidence.
5. **End with a method trace** — the final output of any investigative
   sequence must include a `_provenance` block or `_method` section that
   lets anyone later reconstruct exactly what was done and why.

### Why this matters

One-offs are memory. Formalized tools are code. But even formalized tools
are only as trustworthy as their last run. Live methodology capture means
every run produces not just data, but a verifiable method for how that
data came to be trusted. This is the operating-system equivalent of an
audit log — without it, you have results but no confidence.

### Relationship to the parent rule

This is not a separate check. It is a refinement of the same question:
"Have I done this before?" Now, even when the answer is "yes, and it is
formalized," you still capture the method trace of this particular run,
because every run is an opportunity to verify that the formalized tool
still produces correct results in the current environment.

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
