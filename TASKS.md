# Tasks

## Active

### webui-write-integrity (in-progress, high)
- [ ] Step 2: parity test — gate-failing fixture refused by both MCP `transition_to_completed` and webui endpoint with equivalent errors
- [ ] Step 3: each UI lifecycle action leaves `git status` clean in temp-vault test; completion doc no longer re-serializes frontmatter
- [ ] Step 4: plain document save leaves Testing Plan byte-identical; step-table edit syncs; archived plans untouched
- [ ] Step 5: WYSIWYG round-trip test — checkboxes, `-` bullets, underscores survive save byte-identically; governance docs refuse WYSIWYG until stable
- [ ] Step 6: stale `consumed_by` fixture self-heals and approve proceeds

### agent-roles (proposals/agent-roles-model-routing.md, branch: agent-roles)
- [ ] Multi-AI review of role taxonomy (Critic pass)
- [ ] Define per-role model routing table
- [ ] Scaffold role configs: tool allowlists + system prompts
- [ ] Wire ai-stack/meshy bridge for local model routing
- [ ] Implement constitution layer enforcement

### Phase 4 active
- [ ] lifecycle-gates — Phase 2 (AI assistance, quorum, scheduled triggers, retroactive audit)
- [ ] collaboration-issue-model-and-roadmap-sync (high)
- [ ] profile engine runtime
- [ ] ACL controller
- [ ] inbox capture

## In Progress
<!-- Tasks actively being worked in this session -->

## Completed
- [x] webui-write-integrity Step 1 — centralize frontmatter parser, delete 6 parseFm copies (#94, PR #187)
- [x] contribution-pipeline — completed and archived
- [x] git-panel branch switcher (#184)
- [x] plan completion gate on green test run (#159)
- [x] research-smoke opt-in per profile fix (#145)
