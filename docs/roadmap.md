# DocWright Roadmap

Authoritative sequencing of all open work. For project goals and architecture,
see [[PROJECT.md]]. This document owns the *when* and *why now*.

Last reviewed: 2026-07-06

---

## How to read this document

Two orthogonal axes order the work — don't conflate them:

- **Milestone** (`v0.5.0` / `v0.6.0` / `backlog`) is the *release bucket* for
  triage. Every issue, plan, and proposal carries a `milestone:` frontmatter
  field; the tables below are auto-generated from it by
  `npm run generate-roadplan`. The two lowest version milestones render as
  **Current** and **Next**; everything else (later versions, `backlog`) falls
  into the Backlog pool. **This is the field you set to say "when."**
- **Phase** (0–7) is the *versioning backbone*, not a per-item label. It drives
  the version number (`0.MINOR` = phase; `npm run phase:close` bumps at phase
  close) and the structural dependency graph below. Phases are **not** shown in
  the milestone tables and issues are **not** tagged with a phase.

The dependency graph is ordered by **structural dependency** — earlier items
unlock later ones. Items marked ⚡ are blockers: downstream work cannot start
without them. Items marked 🔀 run as **parallel tracks** independent of the
current phase gate.

---

<!-- START_ROADPLAN -->

### 🎯 Current Milestone — v0.5.0

| Type | Title | Priority | Status | Assigned |
| :--- | :--- | :--- | :--- | :--- |
| ✨ Plan | [[plans/webui-write-integrity.md\|Web UI write integrity: shared parser, shared gate, committed transitions, safe saves]] | high | in-progress | NetYeti |
| 💡 Proposal | [[proposals/three-docwright-instance-deployment.md\|DocWright dev-cloud instances — dogfood, csdocs, cs-erp-images, msp-pilot]] | 2 | proposal | — |
| 💡 Proposal | [[proposals/git-panel-branch-switcher.md\|Git panel branch switcher]] | 3 | proposal | — |
| 🐛 Issue | [[issues/bug-session-end-push-rejected-on-protected-main.md\|scripts/end-session.ts pushes directly to main and fails on branch protection — needs to branch+PR instead]] | low | open | — |

### 🚀 Next Milestone — v0.6.0

| Type | Title | Priority | Status | Assigned |
| :--- | :--- | :--- | :--- | :--- |
| 🐛 Issue | [[issues/bug-approve-by-move-bypasses-self-approval-gate.md\|Approving by moving a proposal to proposals/approved/ bypasses the HUMAN-APPROVED gate]] | high | open | — |
| 💡 Proposal | [[proposals/executor-panel-live-feedback.md\|Bug/UX: Plan Executor Panel Has No Feedback During BigPickle Session — Humans Panic and Interrupt]] | high | proposal | — |
| 💡 Proposal | [[proposals/enforce-release-tag-script.md\|Enforce npm run release:tag as the Only Path to Version Tags]] | high | proposal | — |
| 🐛 Issue | [[issues/bug-governance-hooks-silently-disabled-docwright-path.md\|Governance hooks silently disabled when DOCWRIGHT_PATH is unset (non-interactive shells)]] | high | open | — |
| 💡 Proposal | [[proposals/sub-plan-docwright-init-scaffold.md\|Sub-Plan: docwright init Scaffold]] | high | proposal | — |
| 💡 Proposal | [[proposals/sub-plan-vault-portability-foundation.md\|Sub-Plan: Vault Portability Foundation]] | high | proposal | — |
| 🐛 Issue | [[issues/feature-ui-consume-and-process-governance-docs.md\|Web UI cannot consume/supersede or process one proposal or plan into another]] | medium | open | — |

### 🗺 Backlog

| Type | Title | Priority | Status | Assigned |
| :--- | :--- | :--- | :--- | :--- |
| 🐛 Issue | [[issues/complete-issue-branch-merge-always-fails-tries-to-.md\|complete_issue_branch --merge always fails: tries to merge before required checks finish]] | high | open | — |
| 🐛 Issue | [[issues/governance-panel-pending-approval-stat-is-mislabel.md\|Governance panel: 'Pending Approval' stat is mislabeled (it's approved-awaiting-plan, not awaiting approval)]] | high | open | — |
| 🐛 Issue | [[issues/governance-panel-status-stat-tiles-aren-t-clickabl.md\|Governance panel: Status stat tiles aren't clickable — no drill-in to proposals]] | high | open | — |
| 🐛 Issue | [[issues/hook-identity-cache-is-global-tmp-opencode-identit.md\|Hook identity cache is global (/tmp/opencode-identity-cache) — test runs poison real commits for an hour]] | high | open | — |
| 🐛 Issue | [[issues/bug-hook-source-divergence-and-commit-msg-not-installed.md\|Hook source drift — .githooks diverged from scripts/pre-commit.sh, and commit-msg is never installed for vaults]] | high | open | — |
| 🐛 Issue | [[issues/release-dogfood-window-uses-a-fixed-7-day-clock-co.md\|Release dogfood-window uses a fixed 7-day clock (contradicts plan §5)]] | high | open | — |
| 🐛 Issue | [[issues/roadplan-cli-add-check-drift-guard-fail-ci-if-docs.md\|roadplan CLI: add --check drift guard (fail CI if docs/roadplan.md is stale)]] | high | open | — |
| 🐛 Issue | [[issues/bug-wysiwyg-editor-corrupts-documents.md\|WYSIWYG editor corrupts documents and clobbers frontmatter on save]] | high | open | — |
| 💡 Proposal | [[proposals/ai-model-indicator-ui.md\|AI Model Indicator — Show Which Model Powers Each Feature]] | medium | proposal | — |
| 🐛 Issue | [[issues/bug-approve-not-idempotent-stale-consumed-by.md\|Approve button silently no-ops when a stale consumed_by points at a missing plan]] | medium | open | — |
| 🐛 Issue | [[issues/bug-end-session-script-commits-to-protected-main-then-.md\|end-session script commits to protected main then push is rejected, stranding commits]] | medium | open | — |
| 💡 Proposal | [[proposals/enforce-branch-per-plan.md\|Enforce Branch-Per-Plan Workflow at Session Start]] | medium | proposal | — |
| 💡 Proposal | [[proposals/issue-cluster-remediation-waves.md\|Issue-cluster remediation waves B–D — hooks/identity, report-intake UX, workflow tooling QoL]] | medium | proposal | — |
| 🐛 Issue | [[issues/bug-issues-created-from-report-bug-dont-create-the-gh-.md\|Issues created from Report Bug dont create the GH link]] | medium | open | — |
| 🐛 Issue | [[issues/bug-issues-have-no-forward-path.md\|Issues have no forward path]] | medium | open | — |
| 🐛 Issue | [[issues/plan-doc-generator-raw-js-date-in-created-field-an.md\|Plan doc generator: raw JS date in created: field and unquoted colon-containing title:]] | medium | open | — |
| 🐛 Issue | [[issues/bug-release-process-leaves-version-and-packagejson-on-.md\|Release process leaves VERSION and package.json on main stale — bump only lands on release branch]] | medium | open | — |
| 🐛 Issue | [[issues/bug-report-bug-button-should-pop-up-a-form.md\|Report Bug" button should pop-up a form]] | medium | open | — |
| 🐛 Issue | [[issues/bug-report-button-should-offer-feature-as-well.md\|Report button should offer "feature" as well]] | medium | open | — |
| 🐛 Issue | [[issues/bug-completion-doc-generator-emits-invalid-yaml-tags-l.md\|Completion doc generator emits invalid YAML tags line in generated docs frontmatter]] | low | open | — |
| 💡 Proposal | [[proposals/formalize-roadmap-sequencing-enforcement.md\|Formalize mechanical enforcement of roadmap sequencing]] | 3 | proposal | — |
| 💡 Proposal | [[proposals/guard-committed-machine-paths.md\|Guard against committing machine-specific absolute paths]] | 3 | proposal | — |
| 💡 Proposal | [[proposals/agent-roles-model-routing.md\|Scoped agent roles — capability-scoped subagents with per-role model routing (ai-stack bridge)]] | 3 | proposal | — |
| 💡 Proposal | [[proposals/sub-plan-architecture-boundary-doc.md\|Sub-Plan: Architecture Boundary Document]] | low | proposal | — |
| 💡 Proposal | [[proposals/deferred-sync-agents-cross-tool.md\|Deferred: Cross-tool agent definition sync (.opencode/agents ↔ .claude/agents)]] | 4 | proposal | — |
| 💡 Proposal | [[proposals/skill-plan-critique-ci.md\|CI-Triggered Plan Critique (Headless)]] | — | proposal | NetYeti |
| 💡 Proposal | [[proposals/deferred-chat-enterprise-dual-mode.md\|Deferred: Chat Panel Enterprise Dual-Mode (Named Connections, Mixed Content)]] | — | proposal | — |
| 💡 Proposal | [[proposals/deferred-chat-terminal-pty-panel.md\|Deferred: Chat Panel Terminal/PTY (xterm.js + WebSocket)]] | — | proposal | — |
| 💡 Proposal | [[proposals/deferred-watcher-presence-indicator.md\|Deferred: External AI Watcher Presence Indicator in Web UI]] | — | proposal | — |
| 💡 Proposal | [[proposals/deferred-frontmatter-validate-assigned-to-strictness.md\|Deferred: frontmatter-validate atom too strict on assigned_to for unapproved proposals]] | — | proposal | — |
| 💡 Proposal | [[proposals/deferred-judgment-atom-mode-interaction.md\|Deferred: Judgment Atom Mode Interaction — advisory/staged/blocking per plan execution mode]] | — | proposal | — |
| 💡 Proposal | [[proposals/deferred-lifecycle-graph-dependency-graph.md\|Deferred: Lifecycle Graph — Dependency Graph View (D3.js)]] | — | proposal | — |
| 💡 Proposal | [[proposals/deferred-lifecycle-graph-phase-view.md\|Deferred: Lifecycle Graph — Phase View Mode]] | — | proposal | — |
| 💡 Proposal | [[proposals/deferred-rlm-python-microservice.md\|Deferred: RLM Python Microservice — Multi-Document AI via Recursive Language Models]] | — | proposal | — |
| 💡 Proposal | [[proposals/bundle-enterprise-tier.md\|Enterprise Tier Bundle — Server-Side AI, CI/CD Webhooks, Email Intake, and Scheduled Compliance]] | — | proposal | — |
| 💡 Proposal | [[proposals/external-proposal-store.md\|External proposal store — move proposals out of git]] | — | proposal | — |
| 💡 Proposal | [[proposals/gantt-view-dependencies.md\|Gantt View for Plan Dependencies and Effort]] | — | proposal | NetYeti |
| 💡 Proposal | [[proposals/kubernetes-deployment.md\|Kubernetes / Helm Deployment]] | — | proposal | NetYeti |
| 💡 Proposal | [[proposals/mcp-server-stale-dist-detection.md\|MCP Server Stale dist/ Detection — Rebuild or Warn on Start]] | — | proposal | — |
| 💡 Proposal | [[proposals/misc.md\|Misc / Catch-all Inbox]] | — | proposal | — |
| 💡 Proposal | [[proposals/mobile-wysiwyg-editing.md\|Mobile WYSIWYG Editing]] | — | proposal | NetYeti |
| 💡 Proposal | [[proposals/offline-pwa-support.md\|Offline and PWA Support]] | — | proposal | NetYeti |
| 💡 Proposal | [[proposals/profile-opencode-system-prompt.md\|Per-Profile Governance System Prompt for OpenCode Sessions]] | — | proposal | NetYeti |
| 💡 Proposal | [[proposals/phase-close-web-ui.md\|Phase Close-Out from Web UI]] | — | proposal | — |
| 💡 Proposal | [[proposals/phases-and-the-master-plan-are-mostly-invisible-to-the-user.md\|Phases and the Master Plan Are Mostly Invisible to the User]] | — | proposal | — |
| 💡 Proposal | [[proposals/profile-aware-project-templates.md\|Profile-Aware Project Templates for vault init]] | — | proposal | NetYeti |
| 💡 Proposal | [[proposals/remote-registry-sync.md\|Remote Registry Sync]] | — | proposal | NetYeti |
| 💡 Proposal | [[proposals/plan-execution-mode-rename.md\|Rename plan execution mode: automated → mode, off/guided/full → mentor/guided/autonomous]] | — | proposal | — |
| 💡 Proposal | [[proposals/plan-steps-structured-frontmatter.md\|Structured Step Frontmatter — YAML Steps as Source of Truth]] | — | proposal | — |
| 💡 Proposal | [[proposals/ui-white-label-brand-settings.md\|UI — White-Label Brand Settings UI]] | — | proposal | NetYeti |
| 💡 Proposal | [[proposals/upgrade-dev-toolchain-eslint9-tseslint8.md\|Upgrade dev toolchain: ESLint 10 + @typescript-eslint v8 + TypeScript 6]] | — | proposal | — |

<!-- END_ROADPLAN -->

---

## Dependency Graph

```
Phase 3 (foundation + perception + pilots)
  3a (vault write API)
    ──→ 3b (vault document index — frontmatter + wikilink edges, unified)
          ──→ 3c (knowledge graph — accurate from day one)
  3a, 3b, 3c ──→ 3d (MSP pilot) ──→ 3e (STEAM pilot) ──→ 3f (dogfooding)
  │
  ├──→ 🔀 Cascade STEAM production [waits for Phase 5 step 5b ACL]

Phase 4 (governance enforcement — serial)
  4a (mode enforcement) ──→ 4b (profile engine) ──→ 4c (lifecycle gates)

Phase 5 (profile-aware features — largely parallel after Phase 4)
  ├── 5a (judgment atom mode)    [needs 4c]
  ├── 5b (Forgejo ACL)           [needs 4b] ──→ closes STEAM production track
  ├── 5c (research AI + RLM*)    [needs 4b + ai-stack GPU fix]
  ├── 5d (proposal UX + dedup)   [needs 3b ✓, 4b for full features]
  ├── 5e (contribution pipeline) [independent]
  └── 5f (graph polish)          [driven by real usage of 3c]
  │
  🔀 Chat & Session Panel Ph2    [no phase dependency — closes here]

Phase 6 (feature bundles — real user feedback required)
Phase 7 (public release)

* RLM: [[proposals/deferred-rlm-python-microservice.md]]
  Pending ai-stack GPU fix. Policy atom pre-condition met (v0.3.x).
```

Small fixes and 5e (contribution pipeline) have no phase dependencies.
