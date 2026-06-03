---
title: "How DocWright Is Built"
status: active
author: NetYeti
created: 2026-06-03
tags:
  - documentation
  - collaboration
  - ai
  - contributors
---

# How DocWright Is Built

DocWright is a collaboration. Not just between developers, but between humans
and AI tools working in tandem — each bringing different strengths, each
catching what the others miss. This document describes how the project works,
who is involved, and how that practice is baked into the tool itself.

---

## The Core Team

**NetYeti** (growlf on GitHub) — BDFL. Product vision, architecture decisions,
governance design, final judgment on all things. Cascade STEAM deployment
lead. The human who keeps it honest.

**Claude** (Anthropic) — Primary AI collaborator. Long-context synthesis,
architecture proposals, implementation, documentation, critique. You are
reading text Claude helped write.

**BigPickle** — The configured OpenCode LLM for this vault. Independent
reviewer, devil's advocate, second opinion. When Claude proposes something,
BigPickle is asked to find the problems with it. When BigPickle proposes
something, Claude critiques it. Neither is treated as the final word.

This three-way collaboration — human judgment + two independent AI
perspectives — is the practice that produced DocWright. It is also the
practice DocWright is designed to make easy for every organization that
adopts it. See `policies/core/multi-perspective-review.md`.

---

## How Work Happens

Every significant decision in DocWright starts as a **proposal** and goes
through the vault's own governance workflow before becoming a plan and then
code. The tool dogfoods itself from day one — every feature was proposed,
reviewed, and planned using the system it is building.

Typical session flow:
1. NetYeti opens a session in Claude Code (Claude) or OpenCode (BigPickle)
2. A critique, idea, or problem is raised
3. A proposal is drafted — usually by Claude, reviewed by NetYeti, often
   sent to BigPickle for an independent read
4. The proposal is approved by NetYeti (the human — never by an AI)
5. A plan is created and implementation begins
6. Code is committed and the plan is marked complete

The AI tools contribute drafts, code, and critique. Humans make decisions.
The vault enforces this: `approved: true` on any proposal requires a human
commit with `HUMAN_APPROVED=1`.

---

## Human Contributors Are the Heart of This Project

AI tools accelerate work. They do not replace the judgment, lived experience,
and domain knowledge that human contributors bring. DocWright is MIT-licensed
and actively welcomes human contributions at every level:

- **Governance design** — if you have opinions about how teams should work,
  how decisions should be documented, how policy should be enforced, those
  opinions belong here
- **Code** — SvelteKit, TypeScript, dispatch module, profile engine
- **Profiles** — new bundled profiles for domains we haven't thought of yet
- **Documentation** — the most undervalued contribution in any project
- **Testing** — using DocWright in your own org and reporting what breaks

Human contributors are not competing with AI tools. The AI tools write first
drafts; humans decide what matters. That is the right division of labour and
it scales well.

See `CONTRIBUTING.md` for the practical how-to.

---

## On AI Attribution

AI tools are credited here, in `NOTICE.md` (for specific components), and in
the architecture of the tool itself — not in individual commit messages. Commit
history is the record of human decisions and human authorship. The collaboration
is acknowledged at the project level, where it belongs.

---

## The Philosophy This Practice Transmits

DocWright is designed to transmit its own values into the organizations that
adopt it. The multi-perspective review practice — getting independent views
before finalizing decisions — is one of those values. The `docwright-critic`
agent persona, the "Second Opinion" quick action, the phase gate prompt that
asks "did you get another perspective?" — all of these exist because the
people who built DocWright found them genuinely useful, not because they seemed
like good ideas in the abstract.

Build with the tools. Trust but verify. Keep the human in the loop.

---

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created | NetYeti |
