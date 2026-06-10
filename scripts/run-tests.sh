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

# === Test 4: Node.js components test (MCP + Parity) ===
echo "--- Test 4: MCP + Parity tests ---"
if npm run test:mcp > /dev/null 2>&1; then
    pass "MCP parity tests pass"
else
    fail "MCP parity tests FAILED -- run: npm run test:mcp"
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

# === Test 6: Dispatch module unit tests ===
echo "--- Test 6: Dispatch unit tests ---"
if npm run test:dispatch > /dev/null 2>&1; then
    pass "Dispatch unit tests pass"
else
    fail "Dispatch unit tests FAILED -- run: npm run test:dispatch"
    ALL_PASSED=1
fi

# === Test 7: Executor engine unit tests ===
echo "--- Test 7: Executor engine unit tests ---"
if npm run test:executor > /dev/null 2>&1; then
    pass "Executor engine unit tests pass"
else
    fail "Executor engine unit tests FAILED -- run: npm run test:executor"
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
