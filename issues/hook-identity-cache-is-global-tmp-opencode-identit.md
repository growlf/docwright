---
title: Hook identity cache is global (/tmp/opencode-identity-cache) — test runs poison real commits for an hour
status: resolved
closed_by_pr: "#243"
resolved: 2026-07-06
created: 2026-07-05
category: bug
priority: high
tags: []
reported_dates: [2026-07-05]
demand_count: 2
triage_date: 2026-07-05
triage_by: NetYeti
triage_notes: Triaged as bug / high.
scope_check_date: 2026-07-05
scope_check_by: NetYeti
scope_assessment: Issue is in active backlog.
scope_decision: in-scope
github_issue: 160
milestone: backlog
assigned_to: []
created_by: NetYeti@host
---

Observed live 2026-07-05: after `npm test` (which runs `test/hooks/test-human-approved-hook.sh` in a throwaway repo with `git config user.name "Hook Test"`), the very next real commit's pre-commit banner asserted `Human: Hook Test (hooktest@example.com)` — the throwaway repo's hook wrote the shared cache at `/tmp/opencode-identity-cache`, and `resolve_identity()` trusts it for 3600s regardless of which repo it came from.

The commit author itself was correct (git config); what's poisoned is the hook's identity assertion — the thing the HUMAN-APPROVED flow and audit trail lean on. Any vault sharing the machine cross-contaminates the same way; /tmp is also world-writable, so the cache is spoofable by any local user.

## Proposed fix
- Key the cache by repo: `$REPO_ROOT/.git/opencode-identity-cache` (private to the repo, dies with the checkout), or hash the repo path into the /tmp filename at minimum.
- Hook test scripts should `rm -f` the cache in their trap cleanup regardless.

Both hook copies (`scripts/pre-commit.sh` + `.githooks/pre-commit`) need the fix — see #144 for the drift problem making that a two-place change.

**Verification:** run the hooks test suite, then make a real commit — banner must show the real identity, not Hook Test.

## Additional reports

### Additional report — 2026-07-05 (NetYeti)

Reproduced again 2026-07-05 during webui-write-integrity Step 1: full npm test run re-poisoned the cache; the very next real commit's pre-commit banner asserted Human: Hook Test (hooktest@example.com). Second occurrence in one day — every full-suite run poisons the next hour of commit banners.

