---
title: "Fix completion-doc generator's invalid YAML output (unquoted colon titles, tags formatting)"
author: Claude (on behalf of user)
created: 2026-07-10
tags:
  - lifecycle
  - docs
  - yaml
approved: false
created_by: "claude@claude-code"
assigned_to: ""
sources:
  - issues/bug-completion-doc-generator-emits-invalid-yaml-tags-l.md
  - issues/plan-doc-generator-raw-js-date-in-created-field-an.md
github_issues:
  - 185
  - 136
---

# Fix completion-doc generator's invalid YAML output

## Problem

`generateCompletionDoc()` (`src/dispatch/completion-doc.ts`), the function shared by both the MCP `transition_to_completed` tool and the Web UI's `/api/lifecycle/transition-completed` endpoint to write `docs/<plan>.md` when a plan is archived, emits frontmatter fields via raw string interpolation with no YAML-safe quoting:

```ts
return `---
title: ${title}
status: completed
completed_date: ${completedDate}
author: ${author}
created: ${created}
${tagsBlock}
---
```

**Confirmed still broken, live, this session:** completing `plans/improve-bug-feature-reporting-tool.md` via `transition_to_completed` produced `docs/improve-bug-feature-reporting-tool.md` with:

```
title: Wave C — Report/Intake UX: modal form, feature requests, GitHub linkage, governance panel drill-in, issue promotion
```

— unquoted, and the title contains a colon (`UX:`). Feeding this frontmatter block to `js-yaml` fails outright:

```
YAMLException: bad indentation of a mapping entry (1:33)
```

This is the exact same defect class as `bug-plan-doc-generator-raw-js-date-in-created-field-an` (#136) reported for this same generator, and matches a bug found and hand-fixed earlier this same session on the plan file itself (a different generator, same missing-quote pattern) — this is evidently a recurring gap across more than one place in the codebase that builds frontmatter via string interpolation instead of a YAML-safe serializer.

**The `created:` field bug from #136 (raw JS `Date` object instead of an ISO string) appears to already be fixed** — `generateCompletionDoc` pulls `created` from the source plan's own frontmatter field (line 17) rather than computing a fresh `Date`, and our live repro's `created:` line was a clean ISO date. Verify and close that half of #136 rather than re-fixing it.

**The tags-formatting bug from #185** (`tags: - mcp` on one line) appears structurally guarded against in the current code (`formatYamlList` is used when tags is an array, falling back to `tags: []` when absent) — but should still be verified against a real multi-tag plan, since the string-tag branch (`tags:\n  - ${tagsStr}`) is itself unescaped and could break on a tag containing YAML-special characters.

## Proposed Solution

1. Replace the raw string interpolation for every frontmatter value in `generateCompletionDoc` with a proper YAML-safe emission — either:
   - Build a plain object (`{ title, status: 'completed', completed_date, author, created, tags }`) and serialize it with `js-yaml`'s `dump()`, or
   - Reuse this repo's existing `setFrontmatterField`/`formatYamlList` helpers (`src/dispatch/frontmatter.ts`) consistently, since they already handle list formatting — extend them (or add a sibling helper) to handle scalar quoting for values containing `:`, `#`, leading/trailing whitespace, or other YAML-significant characters.
2. Add a regression test: generate a completion doc for a plan whose title contains a colon, and assert the output frontmatter block parses successfully with `js-yaml` in strict mode (no tolerant-fallback needed).
3. Regenerate (or hand-fix) any already-produced `docs/*.md` files affected by this bug — `docs/improve-bug-feature-reporting-tool.md` (this session) is a known instance; a repo-wide sweep (`js-yaml`-parse every `docs/*.md` frontmatter block in strict mode) would find any others, similar to the audit mentioned in the original #185 report.
4. Verify the `created:` and `tags:` fixes referenced above are genuinely resolved (not just apparently, from one sample) and close out the corresponding halves of #136/#185 explicitly rather than leaving them ambiguous.

## Alternatives Considered

**Rely on the tolerant fallback parser instead of fixing the generator.** The canonical frontmatter parser (`parseFrontmatter`) already degrades gracefully to a line-oriented tolerant parse when strict `js-yaml` rejects a block, which is why this bug hasn't broken anything visibly. Rejected as the actual fix — masking invalid output at every read site is strictly worse than emitting valid output once at the single write site, and any future tool (or a human opening the file in a strict YAML-aware editor) will still choke on it.

**Hand-fix each affected `docs/*.md` file as found, without fixing the generator.** Rejected — the generator will keep producing new broken files on every future `transition_to_completed` call until it's fixed at the source; this is exactly a `code-over-memory` case.

## Future

- Consider whether `completion-doc.ts` should be the template for a small shared "frontmatter builder" utility used everywhere a doc's frontmatter block is constructed from scratch (as opposed to editing an existing block, which `setFrontmatterField` already handles safely) — the Implementation Steps table corruption bug and this one are both instances of "hand-built serialization instead of a real serializer."

## Success Criteria

- [ ] `docs/improve-bug-feature-reporting-tool.md` (and any other affected existing docs found by a repo sweep) parse successfully under strict `js-yaml`
- [ ] A completion doc generated for a plan with a colon in its title parses successfully under strict `js-yaml`, verified by a regression test
- [ ] #136 and #185 each have their remaining open half (if any) explicitly verified and closed, not left ambiguous
