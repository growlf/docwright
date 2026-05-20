#!/bin/bash
# =============================================================================
# DocWright - Hook Installer
# =============================================================================
# Syncs tracked pre-commit source to .git/hooks/ and validates installation.
# Run after cloning, or when scripts/pre-commit.sh is updated.
# =============================================================================

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
pass() { echo -e "${GREEN}[✓]${NC} $1"; }

echo "DocWright Hook Installer"
echo "========================="
echo ""

# Check source exists
[ ! -f "scripts/pre-commit.sh" ] && fail "Source scripts/pre-commit.sh not found"

# Ensure .git/hooks exists
mkdir -p .git/hooks

# Copy with validation
cp scripts/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
pass "Copied scripts/pre-commit.sh -> .git/hooks/pre-commit"

# Verify they match
if diff -q scripts/pre-commit.sh .git/hooks/pre-commit > /dev/null 2>&1; then
    pass "Integrity verified: source and installed hook match"
else
    fail "Integrity FAILED: files differ after copy"
fi

# Test hook is executable
[ -x ".git/hooks/pre-commit" ] && pass "Hook is executable" || fail "Hook not executable"

# Quick smoke test
echo ""
echo "Running smoke test..."
if bash .git/hooks/pre-commit > /dev/null 2>&1; then
    pass "Smoke test: pre-commit runs cleanly"
else
    warn "Smoke test: pre-commit found issues (expected on dirty tree)"
fi

echo ""
pass "Hooks installed successfully"
