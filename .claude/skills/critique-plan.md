# /critique-plan

Adversarially critique a plan file before execution begins. Works with Claude,
OpenCode (BigPickle), and any other AI — the logic is in `$DOCWRIGHT_PATH/scripts/critique-plan.js`.

## Usage

```
/critique-plan plans/phase-2-foundation.md
/critique-plan                              # critiques the currently open plan file
```

## What it does

1. Runs `node "$DOCWRIGHT_PATH/scripts/critique-plan.js" <plan-file>` to gather context:
   - Full plan content
   - All referenced proposals (present or missing)
   - Downstream plans that depend on this one
   - Core policies
   - Embedded adversarial critic questions

2. Passes the output to a critic agent with these instructions:
   - Find failure modes, missing dependencies, underestimated deliverables
   - Check for better existing tools
   - Identify stale deliverables (already done)
   - Be direct — do not soften real problems

3. Presents findings to you for review

4. On your approval: writes `## Critical Review` section to the plan and commits

## Steps

- Identify the target plan file (from args or current context)
- Run: `node "$DOCWRIGHT_PATH/scripts/critique-plan.js" <plan-path>`
- Pass output to Agent with adversarial instructions
- Show findings, ask: "Write these to the plan? Review and edit first if needed."
- If approved: edit the plan to add/replace `## Critical Review` section
- Commit: `HUMAN_APPROVED=1 git commit -m "chore: add critical review to <plan-name>"`

## Using with OpenCode instead

```bash
node "$DOCWRIGHT_PATH/scripts/critique-plan.js" plans/phase-2-foundation.md
# Copy output and paste into any OpenCode session, or:
node "$DOCWRIGHT_PATH/scripts/critique-plan.js" plans/phase-2-foundation.md | opencode chat
```

BigPickle (`docwright-critic` agent) is the ideal reviewer since it provides
genuine model diversity from Claude.
