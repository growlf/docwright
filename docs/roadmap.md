# DocWright Roadmap

Living prioritization of open plans and proposals. Updated as phases close and work
advances. The critical path is: **Phase 3 close → Phase 4 start → Phase 5 start**.

Last reviewed: 2026-06-17

---

## Phase 3 — Vault Portability & Real-World Pilot (In-Progress)

**Plan:** [[plans/phase-vault-portability-pilot.md]] | 6/11 steps done

Phase 3 is the current blocking dependency. Phases 4 and 5 do not start until
Phase 3 closes its gate. The four remaining deliverables are:

| # | Deliverable | Sub-Plan | Status |
|---|-------------|---------|--------|
| 6 | Contribution pipeline & friction log | [[proposals/sub-plan-contribution-pipeline.md]] | 🔄 In-progress |
| 7 | MSP pilot vault (non-profit real-world) | [[proposals/sub-plan-msp-pilot-vault.md]] | ⏳ Proposal unapproved |
| 8 | Cascade STEAM early-access vault | [[proposals/sub-plan-cascade-steam-early-access.md]] | ⏳ Proposal unapproved |
| 11 | Architecture boundary doc | [[proposals/sub-plan-architecture-boundary-doc.md]] | ⬜ Low priority — `docs/vault-portability.md` covers this |

**Gate to close Phase 3:** Deliverables 7 and 8 are the real-world validation milestones. The MSP pilot proves the governance model works on an unfamiliar external vault. Cascade STEAM early-access gives leadership hands-on use before Phase 5 production infrastructure exists.

**Immediate next actions:**
1. Approve `sub-plan-msp-pilot-vault.md` → generate plan → execute
2. Approve `sub-plan-cascade-steam-early-access.md` → generate plan → execute

---

## Structural Work (Phase-Independent)

These improve the system regardless of which phase is active. Do alongside Phase 3
close-out or between phases — not gated on anything.

| Work | State | Effort | What it fixes |
|------|-------|--------|--------------|
| `plan-execution-mode-rename.md` | 🔄 Partial — linter done, migration done | M | Web UI mode badge + write intercept layers + AGENTS.md + profile templates |
| `new-proposals-should-check-before-actual-creation.md` | ⏳ Unapproved | S | Deduplication check before proposal file creation |
| `new-proposal-ux-description-priority-and-immediate-view.md` | ⏳ Unapproved (depends on above) | S | AI-generated title + immediate navigation after creation |
| `formalize-step-counter-sync.md` | 📋 Draft plan | XS | Auto-sync total_steps/completed_steps with table rows |
| `plan-steps-structured-frontmatter.md` | ⏳ Unapproved | M | YAML `steps:` as source of truth; markdown table becomes rendered view |
| `deferred-frontmatter-validate-assigned-to-strictness.md` | 📝 Deferred proposal | XS | Fix false positive: atom rejects `assigned_to: ""` on unapproved proposals |
| `executor-panel-live-feedback.md` | 🔄 Partial — heartbeat done | S | Fixes 2+3 still pending: step name display + token count live update |
| `phases-and-the-master-plan-are-mostly-invisible-to-the-user.md` | ⏳ Unapproved | XS | Surface current phase in status page header |
| `deferred-watcher-presence-indicator.md` | 📝 Deferred proposal | S | Show "👁 Claude Code is watching" badge in execution panel |

---

## Phase 4 — Profile Engine, ACL & AI Integration

**Plan:** [[plans/phase-4-profile-acl-ai.md]] | Draft, no steps started

**Gate:** Phase 3 must close before Phase 4 begins.

| Work | State | What it delivers |
|------|-------|-----------------|
| Phase 4 plan execution | 📋 Draft | Profile engine runtime, Forgejo ACL enforcement, wikilink index, AI research tooling |
| `profile-opencode-system-prompt.md` | ⏳ Unapproved | Per-profile governance system prompt injection into OpenCode sessions |
| `plan-ui-lifecycle-graph-view.md` | 📋 Draft plan | Lifecycle funnel view with swimlanes and D3.js dependency graph |
| `ai-task-category-taxonomy.md` Step 4 | 🔄 In-progress (Steps 1–2 done) | `ai_category` dropdown in plan step editor; creation-time suggestion via classify call |
| `deferred-judgment-atom-mode-interaction.md` | 📝 Deferred proposal | Needs MCP gate call sites (Phase 4 deliverable) before this is buildable |
| Remaining `plan-execution-mode-rename.md` | 🔄 Partial | Web UI mode badge + write intercept layers land here |

**Phase 4 also consumes:**
- Policy atom framework (completed Phase 4 prerequisite ✅)
- AI Task Category Taxonomy Steps 1–2 (completed ✅)

---

## Phase 5 — Cascade STEAM Production + Governance Maturity

**Plan:** [[plans/phase-5-cascade-steam.md]] | Draft

**Gate:** Phase 4 must close before Phase 5 begins.

| Work | State | What it delivers |
|------|-------|-----------------|
| Phase 5 plan execution | 📋 Draft | Forgejo server, ACL enforcement, AI stack, Web UI deployment for Cascade STEAM |
| `bundle-lifecycle-gates-phase-2.md` | 📋 Draft plan — **HIGH** | AI-assisted gate prep, multi-reviewer quorum, scheduled triggers, retroactive audit, governance log |
| `bundle-chat-session-panel.md` | 🔄 **In-progress** | OpenCode adapter, session sidebar, @-mention, model picker, diff review, terminal (17 steps) |
| `bundle-enterprise-tier.md` | ⏳ Unapproved | Server-side AI, CI/CD webhooks, email intake, scheduled compliance (foundation for all four) |
| `ai-task-category-taxonomy.md` Step 3 | ⏳ ai-stack workstream | `capability-registry.yaml` + LiteLLM routing wired to `judgment_dispatch_hook` |

**`bundle-lifecycle-gates-phase-2.md` is the highest-priority Phase 5 item.** It is the
governance maturity layer that makes DocWright trustworthy at scale: scheduled gates,
retroactive audit, AI-assisted preparation, multi-reviewer quorum. Without it, Phase 5
governance is manual and fragile.

---

## Post-Alpha (After Web UI Validated by Real Users)

These are well-scoped and genuinely useful but deliberately deferred. Do not start
until the Web UI has been validated by non-developer governance users in production.

| Work | Why deferred |
|------|-------------|
| `phase-vscodium-extension.md` | Explicitly deferred until Web UI alpha is validated — IDE layer follows, not leads |
| `remote-registry-sync.md` | Privacy and trust-anchor design complexity; post-v1 |
| `gantt-view-dependencies.md` | Awaiting wider adoption of `depends_on` + `estimated_effort` fields |
| `offline-pwa-support.md` | Edit conflict resolution with git is non-trivial; deferred |
| `kubernetes-deployment.md` | Docker compose sufficient until scale demands it |
| `mobile-wysiwyg-editing.md` | iOS contenteditable reliability; deferred |
| `ui-white-label-brand-settings.md` | Needs settings panel architecture first |

---

## Dependency Graph (simplified)

```
Phase 1 (complete) ──→ Phase 2 (complete) ──→ Phase 3 (in-progress)
                                                      │
                              ┌───────────────────────┘
                              ▼
                         Phase 4 ──→ Phase 5 ──→ Post-Alpha
                              │
                    (structural work runs throughout)
```

**Structural work** (execution mode rename, proposal UX, step counters, atom calibration)
runs in parallel with any phase. It does not gate phases and phases do not gate it.

---

## What Is Completed

| Plan | Completed |
|------|----------|
| Policy Atom Framework | ✅ 2026-06-17 |
| Plan Completion Gate Enforcement Bug | ✅ 2026-06-17 |
| Adopt-Vault (docwright-adopt) | ✅ 2026-06-17 |
| All Phase 1 plans | ✅ Phase 1 closed |
| Phase 2 plans (TypeScript MCP, init scaffold, vault portability foundation, profile merge, migration system) | ✅ Phase 2 complete |

---

## Related Documents

- [[PROJECT.md]] — full architecture spec and phase definitions
- [[SESSION-LOG.md]] — session index with completed work
- [[docs/policy-atom-scope-routing.md]] — MCP tool → atom scope map
- [[docs/policy-atom-model-routing.md]] — ai_category → model routing reference
- [[docs/vault-portability.md]] — vault portability architecture boundary
