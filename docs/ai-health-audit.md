# AI Health Audit Cycle

**Purpose:** Systematically identify patterns in AI failures, improve system instructions and tooling, prevent recurrence.

**Cycle:** **Weekly** (every Monday, or whenever 2+ failures in the same category are noticed). Quarterly meta-review of all weekly audits for larger patterns.

**Owned by:** User (NetYeti) + Claude Code AI (joint stewardship).

---

## Phase 1: Collect (Incident Report)

When a failure occurs (e.g., "Claude tried Skill() on endsession despite CLAUDE.md saying not to"), record:

### Template

```
---
date: YYYY-MM-DD
description: <one-line what went wrong>
context: <what was I doing>
rule_violated: <the documented rule I should have followed>
root_cause_hypothesis: <my best guess why>
category: <see categories below>
---

# [Incident Title]

## What Happened

[Clear description of the failure]

## The Rule

[What CLAUDE.md or docs said I should do]

## Why I Failed

[Honest analysis: Did I forget? Did I misread? Was the rule ambiguous? Was there a competing rule?]

## Impact

[Did this waste time? Break something? Confuse the workflow?]
```

### Categories

- **Memory/Attention:** I knew the rule but forgot it or didn't check
- **Ambiguous Rule:** The rule was unclear or had conflicting interpretations
- **Buried Instruction:** The rule exists but is hidden in prose, hard to find when needed
- **Tooling Gap:** The rule should be enforced by a tool, not documentation
- **Pattern:** This is the 2nd+ time I've done this specific thing

---

## Phase 2: Analyze (Monthly Review)

At the start of each month (or when 3+ incidents accumulate), review:

### Questions

1. **Is this a pattern?**
   - Same rule violated 2+ times → Pattern
   - Same category 3+ times → Systemic issue

2. **What's the real cause?**
   - Memory: I know the rule but don't retrieve it under load
   - Tooling: No mechanism enforces it, so I can make the mistake
   - Documentation: Rule exists but is hard to find/parse/remember
   - Conflict: Two rules point different directions; I picked wrong

3. **Is this MY problem or a SYSTEM problem?**
   - My problem = I need better memory/attention strategies
   - System problem = CLAUDE.md, tools, or processes need fixing

---

## Phase 3: Categorize & Prioritize

### Root Cause Map

| Root Cause | Signal | Fix Belongs To |
|----------|--------|----------------|
| Memory deficit | Same rule violated 2+ times | Me: improve retrieval, better mnemonics |
| Buried instruction | Rule exists but I missed it | System: reorganize CLAUDE.md, make rule local to decision |
| Ambiguous rule | I interpreted differently than intended | System: clarify rule, add examples, resolve conflicts |
| Tooling gap | Rule should be enforced by software | System: create/modify tool to prevent mistake |
| Pattern (3+ in category) | Multiple incidents in same area | System: refactor that area entirely |

### Priority Levels

- **🔴 High:** Safety risk, governance violation, or 3+ repeats
- **🟡 Medium:** Efficiency loss, repeated confusion (2 repeats)
- **🟢 Low:** One-off, no real impact

---

## Phase 4: Implement Fix

For each categorized incident:

### If Memory/Attention (My Issue)

**Action:** Improve my own retrieval
- Add a personal checklist for high-stakes decisions (e.g., before invoking Skill(), check CLAUDE.md §Skill Invocation)
- Use more explicit self-talk ("Wait, is this a docwright skill? Check the exception list.")
- Ask for external confirmation on edge cases

**Documentation:** Add to CLAUDE.md a "Recent Health Audits" section noting what we learned

---

### If Buried Instruction (System Issue)

**Action:** Reorganize docs to make rule more visible
- Move from buried prose to a checklist or decision tree
- Create a separate reference file if it's a complex matrix
- Link from the decision point (e.g., when I'm about to invoke Skill(), link to the exception rules)

**Example:** 
- Old: Rule scattered in CLAUDE.md under "Skills" section, 3 paragraphs down
- New: Create `.claude/SKILL-INVOCATION-RULES.md` with a decision tree, link from CLAUDE.md §Key Tasks

---

### If Ambiguous Rule (System Issue)

**Action:** Clarify and document the decision
- Rewrite the rule to be unambiguous
- Add an example of the right and wrong way
- If there's a conflict with another rule, establish priority
- Document the decision in a comment or footnote

**Example:**
- Old: "Do NOT use Skill() for docwright-* or endsession"
- New: "Skill() works only for harness-registered skills. DocWright skills (in `.claude/skills/`) must be read directly and executed manually. Exception: if a `.claude/skills/*.md` file says 'use Skill()', follow that instead."

---

### If Tooling Gap (System Issue)

**Action:** Move enforcement to a tool
- Create a new tool or modify an existing one to prevent the mistake
- OR create a pre-flight check that catches the mistake and suggests the right path

**Example:**
- Current: I can call Skill("endsession") and it fails with "Unknown skill"
- Better: Skill tool checks against a whitelist at invocation time and returns helpful error: "endsession is a DocWright local skill. Read .claude/skills/endsession.md and run: npm run session:end -- ..."
- Even better: Create a ReadSkill() tool that only works on .claude/skills/ files

---

### If Pattern (3+ Same Issue)

**Action:** Refactor that entire area
- Don't just fix one rule; look at the whole section
- Simplify, consolidate, rewrite for clarity
- Consider whether the area should move from documentation to tooling

**Example:**
- If I violate 3+ skill-related rules in a month, we don't just fix each one — we redesign the entire Skill invocation system (maybe a new tool, maybe a single decision tree in CLAUDE.md)

---

## Phase 5: Verify & Document

### Immediately After Fix

Document what we changed:

```markdown
## Health Audit: [Date]

### Issue
[The failure(s)]

### Root Cause
[Analysis]

### Fix Applied
[What we changed and where]

### Prevention
[How the fix prevents recurrence]

### Verify Date
[When we'll check if it worked: 2-4 weeks from now]
```

Add this to `docs/ai-health-audits/AUDIT-YYYY-MM-DD.md` (one file per audit cycle).

### At Verify Date

- Check: Did I make this mistake again?
- If yes: Fix didn't work; debug why and iterate
- If no: Fix is good; close the issue

---

## Routine Cycle

### Weekly (Every Monday, or when 2+ incidents accumulate)

1. **Collect:** Review incidents from the past week
2. **Analyze:** Quick root-cause on each
3. **Categorize:** Is this memory, tooling, or documentation?
4. **Implement:** Make fixes if quick; defer if complex to quarterly
5. **Document:** Brief summary in the weekly audit report
6. **Verify:** Check at next week's audit if fix worked

### Quarterly (Every 3 months)

- Full review of all weekly audits
- Look for meta-patterns (e.g., "we've reorganized CLAUDE.md 4 times — need a fundamental redesign")
- Decide on larger structural changes (new tools, major doc refactors, tooling enforcement)
- Plan next quarter's priorities based on patterns

### Early Canary Check

NetYeti (user) watches for signs of AI fatigue/slowing:
- Multiple failures in same session (sign of cognitive overload)
- Repeating same mistake (sign of memory issue)
- Verbose/circular responses (sign of context confusion)
- Slower response times (sign of token budget strain)

When canary signals: trigger immediate health audit instead of waiting for weekly cycle. This early warning system catches systemic issues before they compound.

---

## When to Fast-Track

If an incident:
- Causes real harm (breaks workflow, violates governance)
- Is a safety/security issue
- Is a 2nd repeat in the same area (don't wait for 3rd)

→ Fix immediately, document, then add to next monthly audit for pattern analysis.

---

## Ownership & Accountability

| Role | Responsibility |
|------|-----------------|
| **NetYeti (User)** | Decide on root cause, approve fixes, run the cycle |
| **Claude Code (AI)** | Report incidents honestly, provide root-cause hypothesis, implement agreed fixes, check the fixes worked |
| **Both** | Joint stewardship — this is collaborative debugging of the system |

---

## Success Metrics

- **Reduction in repeated failures:** Same rule violated 2+ times = system needs fixing
- **Faster incident resolution:** Takes less time to triage and fix as cycle improves
- **Clearer documentation:** CLAUDE.md becomes more navigable and less error-prone
- **Better tool coverage:** More rules enforced by tools, fewer by documentation
- **Fewer high-priority incidents:** Most incidents trend toward low-priority (one-offs)

---

## Current Health Status

**Last Audit:** [None yet — establishing this process now]

**Known Issues:**
- Skill invocation rules scattered in CLAUDE.md; need consolidation (discovered 2026-07-06)
- CLAUDE.md is ~400 lines with conditionals embedded; getting hard to track

**Next Actions:**
1. Use this cycle to audit and fix skill invocation rules
2. Consider moving CLAUDE.md reference material to separate files
3. Establish monthly check-in on 1st of month

