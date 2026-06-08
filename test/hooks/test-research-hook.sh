#!/usr/bin/env bash
# test/hooks/test-research-hook.sh — tests for validate_research_document()
# Run: bash test/hooks/test-research-hook.sh

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$REPO/scripts/pre-commit.sh"

passed=0; failed=0

# ── Source just the helpers and the research validator ────────────────────────
# We extract the two functions we need so we can call them directly without
# triggering the full hook (which requires a git staged-files context).

get_frontmatter() { awk 'BEGIN{c=0} /^---$/{c++; next} c==1{print} c==2{exit}' "$1"; }

print_error()   { echo -e "\033[0;31m[✗]\033[0m $1"; }
print_warning() { echo -e "\033[1;33m[!]\033[0m $1"; }

# Inline the validate_research_document function (must match pre-commit.sh exactly)
validate_research_document() {
    local FILE=$1
    [[ ! "$FILE" =~ ^research/.+\.md$ ]] && return 0
    local FM CONTENT STATUS CONCLUSION E=0
    FM=$(get_frontmatter "$FILE" 2>/dev/null)
    CONTENT=$(cat "$FILE" 2>/dev/null)
    [ -z "$FM" ] && print_error "$FILE: research document missing frontmatter" && return 1

    for FIELD in title status question author created author-role; do
        echo "$FM" | grep -qE "^${FIELD}:[[:space:]]*.+" || {
            print_error "$FILE: research document missing required field '${FIELD}'"
            ((E++))
        }
    done

    STATUS=$(echo "$FM" | grep "^status:" | sed 's/^status:[[:space:]]*//' | tr -d '"' | xargs)
    CONCLUSION=$(echo "$FM" | grep "^conclusion:" | sed 's/^conclusion:[[:space:]]*//' | tr -d '"' | xargs)

    if [ -n "$STATUS" ] && ! echo "$STATUS" | grep -qE '^(active|concluded|archived)$'; then
        print_error "$FILE: research status must be active|concluded|archived (got: '$STATUS')"
        ((E++))
    fi

    if [ "$STATUS" = "concluded" ]; then
        if [ -z "$CONCLUSION" ] || [ "$CONCLUSION" = "open" ]; then
            print_error "$FILE: status:concluded requires conclusion of recommends|inconclusive|superseded (not empty or 'open')"
            ((E++))
        fi
        echo "$CONTENT" | grep -q "^## Conclusion" || {
            print_error "$FILE: status:concluded requires a '## Conclusion' section in the document body"
            ((E++))
        }
    fi

    if [ "$STATUS" = "archived" ] && [ -z "$CONCLUSION" ]; then
        print_error "$FILE: status:archived requires a conclusion field — use conclusion:inconclusive if no finding was reached"
        ((E++))
    fi

    if [ -n "$CONCLUSION" ] && ! echo "$CONCLUSION" | grep -qE '^(open|recommends|inconclusive|superseded)$'; then
        print_error "$FILE: conclusion must be open|recommends|inconclusive|superseded (got: '$CONCLUSION')"
        ((E++))
    fi

    [ $E -gt 0 ] && return 1
    return 0
}

# ── Helpers ───────────────────────────────────────────────────────────────────

TMPDIR_BASE=$(mktemp -d)
trap 'rm -rf "$TMPDIR_BASE"' EXIT
mkdir -p "$TMPDIR_BASE/research"
cd "$TMPDIR_BASE"   # hook uses relative paths matching ^research/

_idx=0
make_research() {
    # make_research <content> → writes research/rN.md, prints relative path
    _idx=$((_idx + 1))
    local rel="research/r${_idx}.md"
    printf '%s\n' "$1" > "$rel"
    echo "$rel"
}

assert_passes() {
    local label="$1" file="$2"
    if validate_research_document "$file" 2>/dev/null; then
        echo "  ✅ $label"
        ((passed++))
    else
        echo "  ❌ $label  (expected PASS)"
        ((failed++))
    fi
}

assert_fails() {
    local label="$1" file="$2"
    if ! validate_research_document "$file" 2>/dev/null; then
        echo "  ✅ $label"
        ((passed++))
    else
        echo "  ❌ $label  (expected FAIL)"
        ((failed++))
    fi
}

# ── Tests ─────────────────────────────────────────────────────────────────────

echo ""
echo "validate_research_document:"

assert_passes "valid active research doc" "$(make_research '---
title: SSE vs WebSocket
status: active
question: Which protocol suits DocWright live-reload?
conclusion: open
author: NetYeti
created: 2026-06-07
author-role: contributor
---
## Findings
SSE is simpler for one-directional updates.')"

assert_passes "valid concluded doc (recommends + ## Conclusion)" "$(make_research '---
title: SSE vs WebSocket
status: concluded
question: Which protocol suits DocWright live-reload?
conclusion: recommends
author: NetYeti
created: 2026-06-07
author-role: contributor
---
## Findings
SSE is simpler.
## Conclusion
Recommends SSE.')"

assert_passes "archived doc with conclusion:inconclusive" "$(make_research '---
title: Old research
status: archived
question: Should we use qmd?
conclusion: inconclusive
author: NetYeti
created: 2026-06-01
author-role: contributor
---
Body.')"

assert_fails "missing required field question" "$(make_research '---
title: Missing question
status: active
author: NetYeti
created: 2026-06-07
author-role: contributor
---
Body.')"

assert_fails "missing required field author-role" "$(make_research '---
title: Missing author-role
status: active
question: Test?
author: NetYeti
created: 2026-06-07
---
Body.')"

assert_fails "invalid status enum (in-progress)" "$(make_research '---
title: Bad status
status: in-progress
question: Test?
author: NetYeti
created: 2026-06-07
author-role: contributor
---
Body.')"

assert_fails "status:concluded without conclusion field" "$(make_research '---
title: Concluded no field
status: concluded
question: Test?
author: NetYeti
created: 2026-06-07
author-role: contributor
---
## Conclusion
Section exists but frontmatter field missing.')"

assert_fails "status:concluded with conclusion:open" "$(make_research '---
title: Concluded open
status: concluded
question: Test?
conclusion: open
author: NetYeti
created: 2026-06-07
author-role: contributor
---
## Conclusion
open is invalid for concluded status.')"

assert_fails "status:concluded without ## Conclusion section" "$(make_research '---
title: Concluded no section
status: concluded
question: Test?
conclusion: recommends
author: NetYeti
created: 2026-06-07
author-role: contributor
---
## Findings
No Conclusion section.')"

assert_fails "status:archived without conclusion field" "$(make_research '---
title: Archived no conclusion
status: archived
question: Test?
author: NetYeti
created: 2026-06-07
author-role: contributor
---
Body.')"

assert_fails "invalid conclusion enum (maybe)" "$(make_research '---
title: Bad conclusion
status: active
question: Test?
conclusion: maybe
author: NetYeti
created: 2026-06-07
author-role: contributor
---
Body.')"

# Non-research path must be silently skipped
if validate_research_document "proposals/some-proposal.md" 2>/dev/null; then
    echo "  ✅ non-research path skipped (exits 0)"
    ((passed++))
else
    echo "  ❌ non-research path skipped (expected 0)"
    ((failed++))
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "$((passed + failed)) tests: $passed passed, $failed failed"
[ $failed -gt 0 ] && exit 1
exit 0
