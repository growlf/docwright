#!/usr/bin/env bash
# claude-tag-push-watch.sh — PostToolUse hook: watch CI after a tagged version push
#
# Fires after every Bash tool call. If the command pushed a version tag (v*),
# polls GitHub Actions until the triggered run completes, then reports the result
# directly in the conversation so Claude can alert the human and offer options.
#
# NO AI INVOLVED — pure shell + gh CLI. Zero cloud tokens consumed.
#
# Stdin: JSON { tool_name, tool_input: { command, ... }, tool_response }
# Stdout: printed into Claude's conversation as hook feedback
# Exit 0 always (never blocks; informational only)

set -uo pipefail

INPUT=$(cat)

py() { python3 -c "$1" 2>/dev/null || echo ""; }

# Extract the bash command that was just run
CMD=$(py "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" <<< "$INPUT")

# Only proceed for git push commands that include version tags
if ! printf '%s' "$CMD" | grep -qE 'git push'; then
    exit 0
fi
if ! printf '%s' "$CMD" | grep -qEi '(--tags|--follow-tags|refs/tags/| v[0-9]+\.[0-9]+)'; then
    exit 0
fi

# Derive GitHub repo slug from origin remote
REPO=$(git -C "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" \
    remote get-url origin 2>/dev/null \
    | sed -E 's|.*github\.com[:/]([^/]+/[^/]+?)(\.git)?$|\1|' \
    || true)

if [ -z "$REPO" ] || [ "$REPO" = "$(git remote get-url origin 2>/dev/null || true)" ]; then
    # Not a GitHub remote or couldn't parse — skip silently
    exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔔  TAG PUSHED — monitoring CI/CD for $REPO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Wait up to 45s for the triggered run to appear (tag push events take a few seconds to register)
RUN_ID=""
for i in $(seq 1 15); do
    RUN_ID=$(gh run list --repo "$REPO" --limit 5 \
        --json databaseId,event,headBranch,status 2>/dev/null | \
        py "
import sys, json
runs = json.load(sys.stdin)
for r in runs:
    branch = r.get('headBranch', '')
    event = r.get('event', '')
    status = r.get('status', '')
    # tag push: event=push, headBranch looks like a version tag
    if event == 'push' and branch.startswith('v') and status != 'completed':
        print(r['databaseId'])
        break
" || true)
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
    exit 0
fi

# Stream live progress until the run finishes
gh run watch "$RUN_ID" --repo "$REPO" 2>&1 || true

# Read the final result
CONCLUSION=$(gh run view "$RUN_ID" --repo "$REPO" \
    --json conclusion -q '.conclusion' 2>/dev/null || echo "unknown")

echo ""
if [ "$CONCLUSION" = "success" ]; then
    echo "✅  CI PASSED — tagged release is green. All jobs succeeded."
    exit 0
fi

# ── FAILURE PATH ─────────────────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  🚨  BUILD FAILURE — TAGGED RELEASE IS BROKEN  🚨       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Repo:   $REPO"
echo "  Run:    https://github.com/$REPO/actions/runs/$RUN_ID"
echo "  Status: $CONCLUSION"
echo ""
echo "── Failed step output ───────────────────────────────────────"
gh run view "$RUN_ID" --repo "$REPO" --log-failed 2>&1 | tail -100
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "ACTION REQUIRED: Review the failure above. Diagnose the root"
echo "cause, then present the human with clear options to resolve."
echo "(Fix forward, roll back the tag, or skip if non-critical.)"

exit 0
