#!/bin/bash
# =============================================================================
# DocWright - Master Test Runner
# =============================================================================
# Single entry point for all tests. Run after any change to verify integrity.
# Usage: bash scripts/run-tests.sh [--verbose]
# =============================================================================

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
fail() { echo -e "${RED}[✗]${NC} $1"; }
pass() { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

ALL_PASSED=0
START_TIME=$(date +%s)

echo ""
echo "========================================"
echo " DocWright - Test Suite"
echo "========================================"
echo ""

# === Test 1: Pre-commit validation ===
echo "--- Test 1: Pre-commit hook ---"
if bash scripts/pre-commit.sh > /dev/null 2>&1; then
    pass "Pre-commit passes"
else
    fail "Pre-commit FAILED -- run: bash scripts/pre-commit.sh"
    ALL_PASSED=1
fi

# === Test 2: Architecture verification ===
echo "--- Test 2: Architecture verification ---"
if bash scripts/verify-architecture.sh > /dev/null 2>&1; then
    pass "Architecture verification passes"
else
    fail "Architecture verification FAILED -- run: bash scripts/verify-architecture.sh"
    ALL_PASSED=1
fi

# === Test 3: Hook installation integrity ===
echo "--- Test 3: Hook integrity ---"
if [ -f ".git/hooks/pre-commit" ]; then
    if diff -q scripts/pre-commit.sh .git/hooks/pre-commit > /dev/null 2>&1; then
        pass "Tracked source matches installed hook"
    else
        fail "Hook MISMATCH -- run: bash scripts/install-hooks.sh"
        ALL_PASSED=1
    fi
else
    fail "No hook installed -- run: bash scripts/install-hooks.sh"
    ALL_PASSED=1
fi

# === Test 4: Config validation ===
echo "--- Test 4: Config validation ---"
if python3 -c "
import json
with open('opencode.jsonc') as f:
    content = ''.join(line for line in f if not line.strip().startswith('//'))
    json.loads(content)
    print('OK')
" 2>/dev/null | grep -q OK; then
    pass "opencode.jsonc is valid JSON"
else
    fail "opencode.jsonc has syntax errors"
    ALL_PASSED=1
fi

# === Test 5: Install hooks self-test ===
echo "--- Test 5: Hook installation ---"
if bash scripts/install-hooks.sh > /dev/null 2>&1; then
    pass "Hook installation works"
else
    fail "Hook installation FAILED"
    ALL_PASSED=1
fi

# === Test 6: MCP server smoke test ===
echo "--- Test 6: MCP server smoke test ---"
if .venv/bin/python3 scripts/mcp-server.py --test > /dev/null 2>&1; then
    pass "MCP server (10/10 tests pass)"
else
    fail "MCP server smoke test FAILED -- run: .venv/bin/python3 scripts/mcp-server.py --test"
    ALL_PASSED=1
fi

# === Test 7: Transition unit tests ===
echo "--- Test 7: Transition unit tests ---"
if .venv/bin/python3 scripts/test-transitions.py > /dev/null 2>&1; then
    pass "Transition unit tests pass"
else
    fail "Transition unit tests FAILED -- run: .venv/bin/python3 scripts/test-transitions.py"
    ALL_PASSED=1
fi

# === Summary ===
DURATION=$(( $(date +%s) - START_TIME ))
echo ""
echo "========================================"
if [ $ALL_PASSED -eq 0 ]; then
    echo -e "${GREEN} ALL TESTS PASSED (${DURATION}s) ${NC}"
    echo "========================================"
    exit 0
else
    echo -e "${RED} SOME TESTS FAILED (${DURATION}s) ${NC}"
    echo "========================================"
    exit 1
fi
