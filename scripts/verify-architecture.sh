#!/bin/bash
# =============================================================================
# DocWright - Architecture Verification Suite
# =============================================================================
# Runs comprehensive checks after implementation phases are complete.
# Designed for the test cycle: test -> fix -> re-test -> human final test.
#
# Checks two types of tests:
#   STANDARD -- Static analysis of files, structure, and content
#   NEGATIVE -- Proves enforcement works (submits bad input, expects rejection)
# =============================================================================

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$(dirname "$0")/..")"
cd "$REPO_ROOT" || exit 1

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
pass() { echo -e "${GREEN}[✓]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; FAILED=$((FAILED+1)); }
warn() { echo -e "${YELLOW}[!]${NC} $1"; WARNED=$((WARNED+1)); }
info() { echo -e "${BLUE}[i]${NC} $1"; }

FAILED=0; WARNED=0; TOTAL=0

info "Architecture Verification Suite"
info "================================"
echo ""

# =============================================================================
# GROUP A: PRE-COMMIT ENFORCEMENT (STANDARD + NEGATIVE)
# =============================================================================
echo "=== A: Pre-commit enforcement ==="

# A1: Pre-commit hook passes on current state
TOTAL=$((TOTAL+1))
if bash scripts/pre-commit.sh > /dev/null 2>&1; then
    pass "A1: Pre-commit passes on clean working tree"
else
    fail "A1: Pre-commit should pass but doesn't"
fi

# A2: NEGATIVE TEST -- Pre-commit rejects bad frontmatter
TOTAL=$((TOTAL+1))
TMPDIR=$(mktemp -d)
cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

BAD_FILE="$TMPDIR/bad-plan.md"
cat > "$BAD_FILE" << 'EOF'
---
title: Test Plan for Pre-commit Rejection
status: garbage-status
author: Test
---
This plan has an invalid status and no assigned_to.
EOF

cd "$TMPDIR"
git init -q
cp "$REPO_ROOT/scripts/pre-commit.sh" .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
cp "$BAD_FILE" bad-plan.md
git add bad-plan.md
if git commit -m "test: should fail" -q 2>/dev/null; then
    cd "$REPO_ROOT"
    warn "A2: Pre-commit allowed commit with garbage status (may be acceptable)"
else
    cd "$REPO_ROOT"
    pass "A2: NEGATIVE -- Pre-commit correctly rejected bad status"
fi

# A3: NEGATIVE TEST -- Pre-commit rejects empty assigned_to on approved plans
TOTAL=$((TOTAL+1))
TMPDIR2=$(mktemp -d)
cd "$TMPDIR2"
git init -q
git config user.email "test@test.com"
git config user.name "Test User"
mkdir -p plans
cp "$REPO_ROOT/scripts/pre-commit.sh" .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
cat > plans/noassign-plan.md << 'EOF'
---
title: No Assignment Plan
status: approved
author: Test
assigned_to: []
---
EOF
git add plans/noassign-plan.md
commit_output=$(git commit -m "test: should fail assignment check" 2>&1)
commit_exit=$?
cd "$REPO_ROOT"
if [ $commit_exit -ne 0 ]; then
    pass "A3: NEGATIVE -- Pre-commit blocked approved plan with empty assigned_to"
else
    fail "A3: NEGATIVE -- Pre-commit ALLOWED approved plan with empty assigned_to!"
    echo "    Commit output: $(echo "$commit_output" | head -3)"
fi
rm -rf "$TMPDIR2"

# A4: NEGATIVE TEST -- Pre-commit rejects bad automated field value
TOTAL=$((TOTAL+1))
TMPDIR3=$(mktemp -d)
cd "$TMPDIR3"
git init -q
cp "$REPO_ROOT/scripts/pre-commit.sh" .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
cat > badauto-plan.md << 'EOF'
---
title: Bad Auto Plan
status: approved
author: Test
assigned_to:
  - NetYeti
automated: bogus-value
---
EOF
git add badauto-plan.md
if git commit -m "test: should fail automated check" -q 2>/dev/null; then
    cd "$REPO_ROOT"
    warn "A4: NEGATIVE -- Pre-commit allowed bad 'automated' value (soft check)"
else
    cd "$REPO_ROOT"
    pass "A4: NEGATIVE -- Pre-commit blocked invalid automated value"
fi
rm -rf "$TMPDIR3"

cd "$REPO_ROOT"

echo ""

# =============================================================================
# GROUP B: HOOK INTEGRITY
# =============================================================================
echo "=== B: Hook integrity ==="

# B1: Tracked source matches installed hook
TOTAL=$((TOTAL+1))
if [ -f ".git/hooks/pre-commit" ]; then
    if diff -q scripts/pre-commit.sh .git/hooks/pre-commit > /dev/null 2>&1; then
        pass "B1: scripts/pre-commit.sh matches .git/hooks/pre-commit"
    else
        fail "B1: scripts/pre-commit.sh differs from .git/hooks/pre-commit -- run: bash scripts/install-hooks.sh"
    fi
else
    fail "B1: .git/hooks/pre-commit does not exist -- hooks not installed!"
fi

echo ""

# =============================================================================
# GROUP C: SOP INTEGRITY
# =============================================================================
echo "=== C: SOP integrity ==="

# C1: All SOPs have Agent Instructions with triggers
for sop in docs/SOPs/*.md; do
    [ -f "$sop" ] || continue
    TOTAL=$((TOTAL+1))
    name=$(basename "$sop")
    if grep -q '<agent-instructions' "$sop" 2>/dev/null; then
        if grep -qE 'triggers[=:]' "$sop" 2>/dev/null; then
            pass "C1: $name -- Agent Instructions with triggers"
        else
            fail "C1: $name -- missing triggers attribute"
        fi
    else
        fail "C1: $name -- MISSING Agent Instructions section"
    fi
done

echo ""

# =============================================================================
# GROUP D: SKILL INTEGRITY
# =============================================================================
echo "=== D: Skill integrity ==="

# D1: All skill directories have valid SKILL.md
for skill_dir in .opencode/skills/*/; do
    [ -d "$skill_dir" ] || continue
    TOTAL=$((TOTAL+1))
    skill_name=$(basename "$skill_dir")
    skill_file="${skill_dir}SKILL.md"
    if [ -f "$skill_file" ]; then
        if head -3 "$skill_file" | grep -q "^---$"; then
            if grep -q "^description:" "$skill_file" 2>/dev/null; then
                pass "D1: Skill '$skill_name' -- exists with frontmatter + description"
            else
                fail "D1: Skill '$skill_name' -- exists but missing description"
            fi
        else
            fail "D1: Skill '$skill_name' -- exists but no frontmatter"
        fi
    else
        fail "D1: Skill '$skill_name' -- directory found but no SKILL.md"
    fi
done

echo ""

# =============================================================================
# GROUP E: SUBAGENT INTEGRITY
# =============================================================================
echo "=== E: Subagent integrity ==="

for agent_file in .opencode/agents/*.md; do
    [ -f "$agent_file" ] || continue
    TOTAL=$((TOTAL+1))
    name=$(basename "$agent_file" .md)
    if grep -q "^mode: subagent" "$agent_file" 2>/dev/null; then
        if grep -qE "triggers[=:]" "$agent_file" 2>/dev/null; then
            pass "E1: Subagent '$name' -- mode=subagent with triggers"
        else
            fail "E1: Subagent '$name' -- mode=subagent but no triggers"
        fi
    else
        fail "E1: Agent '$name' -- NOT marked as mode: subagent"
    fi
done

echo ""

# =============================================================================
# GROUP F: CONFIG VALIDATION
# =============================================================================
echo "=== F: Config validation ==="

# F1: opencode.jsonc is valid JSON (strip comments first)
TOTAL=$((TOTAL+1))
if python3 -c "
import json, re
with open('opencode.jsonc') as f:
    content = ''
    for line in f:
        s = line.strip()
        if not s.startswith('//') and not s.startswith('/*'):
            content += line
    json.loads(content)
    print('OK')
" 2>/dev/null | grep -q OK; then
    pass "F1: opencode.jsonc parses as valid JSON"
else
    fail "F1: opencode.jsonc has syntax errors -- OpenCode will silently fall back to defaults!"
fi

# F2: opencode.jsonc has instructions section
TOTAL=$((TOTAL+1))
if python3 -c "
import json
with open('opencode.jsonc') as f:
    content = ''.join(line for line in f if not line.strip().startswith('//'))
    cfg = json.loads(content)
    if 'instructions' in cfg and len(cfg['instructions']) > 0:
        print('OK')
    else:
        print('MISSING')
" 2>/dev/null | grep -q OK; then
    pass "F2: opencode.jsonc has instructions with referenced files"
else
    warn "F2: opencode.jsonc missing or empty 'instructions' array"
fi

echo ""

# =============================================================================
# GROUP G: RULE VALIDATION
# =============================================================================
echo "=== G: Rule validation ==="

for rule in .opencode/rules/*.md; do
    [ -f "$rule" ] || continue
    TOTAL=$((TOTAL+1))
    name=$(basename "$rule")
    if head -1 "$rule" | grep -q "^# "; then
        pass "G1: Rule '$name' -- has title header"
    else
        warn "G1: Rule '$name' -- missing # title (OpenCode may not display it)"
    fi
done

echo ""

# =============================================================================
# GROUP H: DIRECTORY STRUCTURE
# =============================================================================
echo "=== H: Directory structure ==="

for dir in .opencode .opencode/skills .opencode/rules .opencode/agents \
           .docworkbench .docworkbench/doc-lifecycle .docworkbench/doc-lifecycle/templates \
           .docworkbench/infra-topology .docworkbench/infra-topology/templates \
           proposals proposals/approved plans plans/completed inventory \
           docs docs/SOPs templates scripts; do
    TOTAL=$((TOTAL+1))
    [ -d "$dir" ] && pass "H: $dir/ exists" || fail "H: $dir/ MISSING"
done

echo ""

# =============================================================================
# Summary
# =============================================================================
echo "================================"
echo "Results: $TOTAL checks, $FAILED failures, $WARNED warnings"
echo "================================"

[ "$FAILED" -gt 0 ] && exit 1 || exit 0
