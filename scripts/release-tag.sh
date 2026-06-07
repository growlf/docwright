#!/usr/bin/env bash
# scripts/release-tag.sh — code-enforced tag push with CI watch
#
# Usage: npm run release:tag [version]
#   version — optional; defaults to the value in VERSION file (e.g. 0.2.1)
#
# This is the canonical way to push a release tag from ANY tool
# (Claude Code, OpenCode, or the terminal). It:
#   1. Validates the tag is v0.x.x (per policies/core/versioning.md)
#   2. Creates the annotated tag if it doesn't already exist
#   3. Pushes the tag to origin
#   4. Watches the triggered CI run and exits non-zero on failure
#
# Claude Code also catches direct tag pushes via the PostToolUse hook.
# Using this script from OpenCode guarantees the same watch behaviour
# without relying on hooks that OpenCode does not yet support.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

py() { python3 -c "$1" 2>/dev/null || echo ""; }

# Resolve version: argument > VERSION file
VERSION="${1:-$(cat "$ROOT/VERSION" 2>/dev/null | tr -d '[:space:]')}"

if [ -z "$VERSION" ]; then
    echo "Error: no version provided and VERSION file is missing." >&2
    echo "Usage: npm run release:tag [version]" >&2
    exit 1
fi

# Normalise: strip leading v if present, then re-add it
VERSION="${VERSION#v}"
TAG="v${VERSION}"

# Enforce v0.x.x per versioning policy
if ! printf '%s' "$TAG" | grep -qE '^v0\.[0-9]+\.[0-9]+$'; then
    echo "Error: tag '$TAG' does not match v0.x.x." >&2
    echo "Major version changes require an approved release plan." >&2
    echo "See policies/core/versioning.md." >&2
    exit 1
fi

# Derive GitHub repo slug from origin remote
REPO=$(git -C "$ROOT" remote get-url origin 2>/dev/null \
    | sed -E 's|.*github\.com[:/]([^/]+/[^/]+?)(\.git)?$|\1|' || true)

if [ -z "$REPO" ]; then
    echo "Error: could not determine GitHub repo from origin remote." >&2
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Release: $TAG  →  $REPO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create annotated tag if not already present locally
if git -C "$ROOT" tag --list | grep -qx "$TAG"; then
    echo "  Tag $TAG already exists locally — skipping creation."
else
    git -C "$ROOT" tag -a "$TAG" -m "Release $TAG"
    echo "  Created annotated tag $TAG."
fi

# Push tag to origin
echo "  Pushing $TAG to origin…"
git -C "$ROOT" push origin "$TAG"
echo ""

# ── Watch the triggered CI run ────────────────────────────────────────────────
echo "🔔  Monitoring CI/CD pipeline…"

RUN_ID=""
for i in $(seq 1 15); do
    RUN_ID=$(gh run list --repo "$REPO" --limit 5 \
        --json databaseId,event,headBranch,status 2>/dev/null | \
        py "
import sys, json, re
runs = json.load(sys.stdin)
for r in runs:
    branch = r.get('headBranch', '')
    event  = r.get('event', '')
    status = r.get('status', '')
    if event == 'push' and re.match(r'^v0\.[0-9]+\.[0-9]+\$', branch) and status != 'completed':
        print(r['databaseId'])
        break
")
    if [ -n "$RUN_ID" ]; then
        echo "  Run #${RUN_ID} found — watching until complete…"
        echo ""
        break
    fi
    printf '  waiting for CI run to appear (%ds elapsed)...\n' $((i * 3))
    sleep 3
done

if [ -z "$RUN_ID" ]; then
    echo "⚠️  No tag-triggered CI run appeared within 45s."
    echo "    Check manually: gh run list --repo $REPO"
    exit 1
fi

gh run watch "$RUN_ID" --repo "$REPO" 2>&1 || true

CONCLUSION=$(gh run view "$RUN_ID" --repo "$REPO" \
    --json conclusion -q '.conclusion' 2>/dev/null || echo "unknown")

echo ""
if [ "$CONCLUSION" = "success" ]; then
    echo "✅  CI PASSED — $TAG release is green."
    exit 0
fi

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  🚨  BUILD FAILURE — TAGGED RELEASE IS BROKEN  🚨       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Repo:   $REPO"
echo "  Tag:    $TAG"
echo "  Run:    https://github.com/$REPO/actions/runs/$RUN_ID"
echo "  Status: $CONCLUSION"
echo ""
echo "── Failed step output ───────────────────────────────────────"
gh run view "$RUN_ID" --repo "$REPO" --log-failed 2>&1 | tail -100
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "ACTION REQUIRED: Diagnose the failure above, then choose:"
echo "  Fix forward — patch the code and push a new tag"
echo "  Roll back   — git tag -d $TAG && git push origin :refs/tags/$TAG"
echo "  Defer       — document the failure in a plan and create a fix"
exit 1
