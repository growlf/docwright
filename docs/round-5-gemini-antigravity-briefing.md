# Round 5 review briefing — Gemini via Antigravity

*(Regenerated 2026-07-10 from the proposal state on
`docs/agent-roles-research-rounds`; original briefing file was in a
cleared Cowork outputs folder. Updated since the original: all eight
B.2 BDFL rulings were recorded 2026-07-10 — see scope item 4.)*

---

## Prompt — paste everything below this line into Antigravity

You are the **Round 5 reviewer** in a multi-AI research process governed
by DocWright's multi-perspective-review policy. Rounds 1–2 were
Claude-family models, Round 3 was OpenCode's configured LLM, Round 4 was
a Claude synthesis. You are the first non-Claude frontier reviewer, and
you bring a third harness perspective (Antigravity's agent/tool model,
alongside Claude Code and OpenCode).

**Document under review:**
`proposals/agent-roles-model-routing.md` on branch
`docs/agent-roles-research-rounds` — read the whole file, including
Annexes A and B and the Research Log, before critiquing.

**Disclosure:** the proposal's routing matrix named Gemini Flash as a
candidate assignee for the Triage role. You are reviewing your own
proposed lane; that assignment has since been **withdrawn by BDFL
ruling** (see item 4). Argue on the merits either way.

### Scope — critique these five things

1. **Role granularity.** Is the taxonomy right-sized? Specifically:
   should Surveyor and Incident Responder merge (same domain, different
   tempo)? Is Triage too thin to be an agent versus a hook-triggered
   skill? Apply the proposal's own role/skill/hook decision criterion
   and say where it gives the wrong answer.

2. **The routing matrix (§B, now a stretch goal).** Attack the premise
   and the rows: is per-role model assignment worth its process weight
   given OpenCode supports per-agent `model:` only in inline config and
   has no fallback chains?

3. **The four still-open questions** (see Open Questions):
   capability floor (which roles are executable on 7–13B local
   models?), constitution portability (is dispatch/MCP-side validation
   complete for clients running no hooks, or are there gaps such as
   direct git access?), role-manifest placement (`src/mcp/roles.json`
   global vs. per-profile with vault override — flagged for you in
   A.2), and the prompts-are-prompts line (what do scoped roles merely
   *reduce* that the constitution layer must still *prevent*?).

4. **Annex B — data classification (Gate 3).** All eight B.2 rulings
   were recorded 2026-07-10 as recommended. Two are explicitly open to
   your rebuttal:
   - **Triage was withdrawn from your lane** to LAN-only, on the
     argument that bug reports and logs leak C3/C4 material (IPs,
     hostnames, secrets) into nominally C2 traffic, and a redaction
     pass is unproven. **Rebut this directly if a defense exists** — a
     successful rebuttal reopens the row.
   - **Incident Responder** got frontier access as a documented
     standing exception to the C3 LAN-only rule (contracted provider
     terms, hosted-small never, local fallback mandatory). Is a
     standing exception the right structure, or should it be
     per-incident?
   Also critique the class definitions themselves (C1–C4) and the
   per-vault classification mechanism.

5. **Annex A — dispatch-layer role identity (Gates 1–2). Attack this
   as security architecture.** Spawn-time env binding
   (`DOCWRIGHT_ROLE`), never model-assertable; two-layer enforcement
   (advertisement filtering + call-time validation against a
   schema-validated role manifest); constitution global and
   narrow-only; generalist-without-mutation-tools as the routing-drift
   countermeasure; `role` + `model` audit stamping as the drift
   baseline; fail-closed. A.5 lists the limits the authors already
   know (config-file trust boundary, direct-write bypass, asserted
   model stamp, deferred SSE identity) — find the ones they don't.

### Ground rules

- Ground findings in the actual repo (`src/mcp`, `opencode.json`,
  `.claude/agents/`), not assumptions about it.
- Number your findings (f.1, f.2, …) with severity and a concrete
  recommendation each — that is the format prior rounds used and how
  findings get folded back into the proposal.
- Do not edit the proposal. Your findings will be appended verbatim to
  its Research Log as Round 5, dated, with your model named.
- AI does not decide governance outcomes: you may recommend, but
  `approved:`, lifecycle state, and data-egress rulings are BDFL-only.
