---
title: Verified gate criteria — evidence-backed plan completion, not checkbox theater
status: draft
author: NetYeti
created: 2026-07-13
tags:
  - governance
  - gates
  - verification
  - completion
  - lifecycle
  - ui
  - bug
proposal_source: proposals/approved/verified-gate-criteria-evidence-backed-completion.md
priority: high
automated: guided
assigned_to: NetYeti
tests_defined: false
tests_human_reviewed: false
_path: plans/verified-gate-criteria-evidence-backed-completion.md
---

# Verified gate criteria — evidence-backed plan completion, not checkbox theater

## Overview

Delivers the approved proposal [[proposals/approved/verified-gate-criteria-evidence-backed-completion.md]] — see it for the full *what & why*.
Held at `status: draft`; fill in the implementation steps below before moving to `in-progress`.



## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Define criteria schema | Create TypeScript types for three tiers of acceptance criteria with discriminated union | ⏳ Pending |
| 2 | Build evidence collector | Implement adapters that gather test results, CI status, and file existence from GitHub/GitLab | ⏳ Pending |
| 3 | Create auto-check engine | Build evaluation engine that maps machine-verifiable criteria to evidence adapters and returns pass/fail | ⏳ Pending |
| 4 | Implement webhook listener | Set up webhooks to trigger re-evaluation when CI completes or files change | ⏳ Pending |
| 5 | Add attestation model | Design schema for human attestations with timestamp, reviewer ID, and linked criteria | ⏳ Pending |
| 6 | Build cross-check validator | Create system that compares human attestations against available evidence to detect contradictions | ⏳ Pending |
| 7 | Implement contradiction alerts | Generate warnings when machine evidence contradicts human attestations with severity levels | ⏳ Pending |
| 8 | Create ACL gate system | Build role-based access control determining who can approve each criteria type | ⏳ Pending |
| 9 | Design audit trail logger | Implement immutable log recording all criterion state changes with actor and timestamp | ⏳ Pending |
| 10 | Add second reviewer flow | Create optional escalation path requiring second reviewer for high-stakes judgment decisions | ⏳ Pending |
| 11 | Build status dashboard | Create real-time view showing all criteria states across documents with evidence links | ⏳ Pending |
| 12 | Implement notification system | Send alerts when criteria are checked, unchecked, or require human attention | ⏳ Pending |
| 13 | Add conflict resolution UI | Build interface for resolving contradictions between human attestations and machine evidence | ⏳ Pending |
| 14 | Create reporting endpoints | Expose API for querying acceptance history, audit trails, and reviewer activity | ⏳ Pending |
| 15 | Write integration tests | Test full workflow from evidence collection through approval with mock scenarios | ⏳ Pending |
| 16 | Deploy monitoring hooks | Add metrics collection for evaluation latency, contradiction rates, and approval throughput | ⏳ Pending |

## Testing Plan

### Step Verification

- [ ] Machine-verifiable gate criteria auto-check when CI status, test results, or file existence evidence matches the claimed condition, and auto-uncheck when evidence contradicts the claim
- [ ] Human-attested criteria accept attestation submissions and trigger cross-validation, flagging contradictions between attestation and observable evidence without blocking on unverifiable claims
- [ ] ACL-gated judgment criteria enforce role-based access control, append immutable audit trail entries for each judgment action, and require second reviewer approval when the configured stakes threshold is met

### Integration & Regression

- [ ] `npm test` passes with zero failures across the existing test suite and new verification tests
- [ ] `npm run typecheck` completes without errors
- [ ] Existing checkbox-based gate behavior remains functional for plans that have not opted into the three-tier system
- [ ] Audit trail entries are append-only and tamper-evident, with no path to mutation or deletion through the API
- [ ] Gate state transitions (auto-check, attestation, judgment) emit events that downstream subscribers receive in correct order

### Gate Criteria

- [ ] A plan reaches completion status only when all required gate criteria are satisfied through one of the three verification tiers, with the verification method recorded per criterion
- [ ] Auto-unchecked criteria correctly revert plan completion status when supporting evidence is withdrawn or contradicted
- [ ] ACL violations during judgment submission return a 403 with a structured error body and do not modify gate state or audit records
- [ ] Second-reviewer flow blocks plan completion until the designated reviewer submits a signed approval that is persisted in the audit trail

## Rollback Procedures

| Scenario | Rollback |
|----------|----------|
| **Machine-verifiable (auto-checked)** | |
| Ansible playbook fails mid-execution | Run `ansible-playbook main.yml --check` to diff, then `--tags` with `state: absent` on failed role; verify rollback with `changed=0` in output |
| Package installation fails or conflicts | `pacman -Rns <package>` + `pacman -Scc` to clean cache; verify with `pacman -Qi <package>` returning exit 1 |
| Service fails to start after enablement | `systemctl disable --now <service>` + restore original unit file from `/etc/systemd/system/<service>.service.d/` backup; verify with `systemctl is-enabled <service>` returning "disabled" |
| Git submodule or repo clone fails | `git submodule deinit --all -f` + `rm -rf .git/modules/*` + retry; verify with `git submodule status` showing clean state |
| CI pipeline red on PR | Auto-merge blocked; run `git revert HEAD` locally, verify tests pass, force-push to PR branch; CI must turn green |
| Missing required file (e.g., `vars/vault.yml`) | `git checkout HEAD~1 -- <file>` to restore previous version; verify file exists and contains expected keys |
| **Human-attested + machine cross-check** | |
| "Hyprland config is stable" attestation | Attester signs off; validator runs `hyprctl monitors` to confirm display output, `journalctl -u hyprland --since "10 min ago"` for crash loops; reject if evidence contradicts |
| "System upgrade is safe" attestation | Attester confirms; validator checks `pacman -Qu` shows no pending updates, `systemctl --failed` is empty, `dmesg | grep -i error` returns nothing |
| "Dotfiles are production-ready" attestation | Attester approves; validator runs `stow --no -V -d ~/.dotfiles -t ~ <pkg>` dry-run, verifies no file conflicts in output |
| **Pure judgment (ACL-gated + audit)** | |
| Emergency rollback of all changes | Requires 2 reviewers; run `git log --oneline -20` to identify rollback point, `git revert --no-commit <commit-range>`, document in `ROLLBACK_AUDIT.md` with timestamp, operator, and reason |
| Rollback decision for breaking config | ACL: only `wheel` group members; create Jira ticket (auto-linked), run rollback, second reviewer signs in ticket; audit trail in `/var/log/rollback/` |
| Full system restore from backup | ACL: root only; restore from `/backup/<date>/`, verify with `diff -r /etc /backup/<date>/etc`, document in audit log with both reviewer signatures |

## Risk Assessment


| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| False positive from automated evidence check (e.g. stale CI status) | Medium | Medium | Cache-busting TTLs on evidence sources; require re-fetch within a configurable window before gate closure |
| Human attester colludes to bypass machine cross-check | Low | High | Audit-trail logging of every attestation + validator decision; periodic random-sample forensic review by separate team |
| ACL gate becomes single-person bottleneck | Medium | Medium | Escalation timeout that re-routes to secondary reviewer after N hours; break-glass override logged with justification |
| Second reviewer for high-stakes decisions causes scheduling deadlock | Medium | High | Configurable quorum rules (allow self-approval after escalation window); dashboard visibility into pending reviews |
| Evidence source unavailable (test runner down, CI API outage) | Low | Low | Graceful degradation: fall back to human attestation tier for the affected criteria, recording the outage reason in the audit trail |
| Misconfigured ACL grants wider access than intended | Low | High | Immutable audit trail on ACL changes; pre-deployment diff review against baseline; automated drift detection alerting |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-13 | Created from approved proposal | NetYeti |
