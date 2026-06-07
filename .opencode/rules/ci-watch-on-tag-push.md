# Rule: Watch CI After Every Tagged Version Push

## The rule

After any `git push` command that pushes a version tag (`v0.x.x`), you MUST
immediately run the CI watch script before continuing:

```bash
bash scripts/claude-tag-push-watch.sh
```

Do not proceed to the next task until the CI run completes. If it fails,
alert the human immediately with the failure output and present clear options
to resolve before doing anything else.

## Why

Tagged releases trigger the CI/CD pipeline and the Docker image push to
ghcr.io. A broken tag release ships a broken image. The human must know
about build failures at the moment they occur — not discovered later.

In Claude Code this is enforced mechanically via a PostToolUse hook in
`.claude/settings.json`. OpenCode does not yet have an equivalent hook
mechanism. Follow this rule as if it were a hook — it is not optional.

## Detection — when does this rule apply?

Run the watch script if your bash command matches any of:
- `git push --tags`
- `git push --follow-tags`
- `git push origin v0.*.*` (any specific version tag)
- `git push ... refs/tags/...`

Branch-only pushes (`git push origin main`) do NOT trigger this rule —
CI only runs on version tags per `.github/workflows/ci.yml`.

## Failure response protocol

If the CI run fails, in this order:

1. **Alert first** — state clearly that the tagged release CI has failed.
   Do not bury the lede in technical detail.
2. **Diagnose** — read the `--log-failed` output from the watch script and
   identify the root cause.
3. **Present options** — give the human concrete choices, e.g.:
   - Fix forward: patch the code and push a new tag (e.g. `v0.2.2`)
   - Roll back: delete the tag locally and remotely if the image push failed
   - Skip if non-critical: document the known failure and defer to a fix plan
4. **Wait for human decision** before taking any action.

## Phase 2

Mechanical enforcement via an OpenCode hooks API will replace this behavioral
rule when OpenCode's hook system stabilises. At that point, this rule file
will be retired and the hook will be the enforcement path — same as Claude Code.

## Related

- `.claude/settings.json` — PostToolUse hook (Claude Code enforcement)
- `scripts/claude-tag-push-watch.sh` — the watch script both tools share
- `.github/workflows/ci.yml` — CI trigger policy (v0.*.* per versioning policy)
- `policies/core/versioning.md` — governs when the v0.*.* tag pattern changes
