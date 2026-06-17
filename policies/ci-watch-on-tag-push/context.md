# ci-watch-on-tag-push

## Rule

After any `git push` command that pushes a version tag matching `v0.*.*`, immediately run:

```bash
bash scripts/claude-tag-push-watch.sh
```

Do not proceed to the next task until the CI run completes. If it fails, alert the human immediately and present clear resolution options before doing anything else.

## Rationale

Tagged releases trigger the CI/CD pipeline and the Docker image push to `ghcr.io`. A broken tag ships a broken image. The human must know about build failures at the moment they occur — not discovered later when someone tries to use the image.

In Claude Code this is enforced mechanically via a PostToolUse hook. In OpenCode and Gemini CLI sessions, follow this rule as if mechanically enforced.

## Examples

Triggers this rule:
- `git push --tags` after committing a version bump
- `git push origin v0.3.1` for a specific release

Does NOT trigger:
- `git push origin main` (branch-only push)
- `git push origin feature-branch`

## Trigger detection

This rule applies when a bash command matches:
- `git push --tags`
- `git push --follow-tags`
- `git push origin v0.*.*`
- Any command pushing a `refs/tags/v0.*.*` reference

Branch-only pushes (`git push origin main`) do NOT trigger this rule.

## Failure response

1. Alert first — state clearly that tagged release CI failed.
2. Diagnose — read the watch script output.
3. Present options: fix forward (new patch tag), roll back the tag, or defer with a documented known failure.
4. Wait for human decision before acting.

## Scope

Applies to any git commit operation that includes a version tag push (`scope: git-commit`). CI only runs on `v0.*.*` tags per `.github/workflows/ci.yml`.
