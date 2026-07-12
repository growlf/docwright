#!/usr/bin/env bash
# test/hooks/test-lifecycle-hook.sh — automated tests for claude-lifecycle-hook.sh
# Run: bash test/hooks/test-lifecycle-hook.sh
#
# Pipes JSON payloads to the hook and asserts exit codes + stop reasons.

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$REPO/scripts/claude-lifecycle-hook.sh"

passed=0
failed=0

# ── Helpers ───────────────────────────────────────────────────────────────────

assert_blocked() {
    local label="$1" payload="$2"
    local output exit_code
    output=$(echo "$payload" | bash "$HOOK" 2>/dev/null)
    exit_code=$?
    # Claude Code PreToolUse deny contract: exit 2 + permissionDecision: deny.
    if [[ $exit_code -eq 2 ]] && echo "$output" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d['hookSpecificOutput']['permissionDecision'] == 'deny'
" 2>/dev/null; then
        echo "  ✅ $label"
        ((passed++))
    else
        echo "  ❌ $label  (exit=$exit_code output=$(echo "$output" | head -c 120))"
        ((failed++))
    fi
}

assert_allowed() {
    local label="$1" payload="$2"
    local exit_code
    echo "$payload" | bash "$HOOK" 2>/dev/null
    exit_code=$?
    if [[ $exit_code -eq 0 ]]; then
        echo "  ✅ $label"
        ((passed++))
    else
        echo "  ❌ $label  (exit=$exit_code — expected allow)"
        ((failed++))
    fi
}

assert_reason_contains() {
    local label="$1" payload="$2" needle="$3"
    local output
    output=$(echo "$payload" | bash "$HOOK" 2>/dev/null)
    if echo "$output" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert '$needle' in d['hookSpecificOutput']['permissionDecisionReason']
" 2>/dev/null; then
        echo "  ✅ $label"
        ((passed++))
    else
        echo "  ❌ $label  (needle='$needle' not in stopReason)"
        echo "     output: $(echo "$output" | head -c 200)"
        ((failed++))
    fi
}

plan_path="$REPO/plans/collation.md"

# ── Write to plans/*.md ───────────────────────────────────────────────────────

echo ""
echo "Write to plans/*.md:"

write_plan_payload=$(python3 -c "
import json
print(json.dumps({'tool_name': 'Write', 'tool_input': {'file_path': '$plan_path', 'content': '# test'}}))
")

assert_blocked "Write to plans/*.md is blocked" "$write_plan_payload"
assert_reason_contains "Write to plans/*.md → suggests write_plan tool" "$write_plan_payload" "write_plan"

# ── Edit to plans/*.md — category A: status change ───────────────────────────

echo ""
echo "Edit to plans/*.md — status field:"

edit_status_payload=$(python3 -c "
import json
print(json.dumps({'tool_name': 'Edit', 'tool_input': {
    'file_path': '$plan_path',
    'old_string': 'status: in_progress',
    'new_string': 'status: completed'
}}))
")

assert_blocked "Edit status field in plans/*.md is blocked" "$edit_status_payload"
assert_reason_contains "Edit status field → suggests update_plan_status" "$edit_status_payload" "update_plan_status"

# ── Edit to plans/*.md — category B: step marker ─────────────────────────────

echo ""
echo "Edit to plans/*.md — step marker:"

edit_step_payload=$(python3 -c "
import json
print(json.dumps({'tool_name': 'Edit', 'tool_input': {
    'file_path': '$plan_path',
    'old_string': '| 1 | Do thing | ⏳ Pending |',
    'new_string': '| 1 | Do thing | ✅ Done |'
}}))
")

assert_blocked "Edit step marker in plans/*.md is blocked" "$edit_step_payload"
assert_reason_contains "Edit step marker → suggests update_step" "$edit_step_payload" "update_step"

# ── Edit to plans/*.md — category C: catch-all ───────────────────────────────

echo ""
echo "Edit to plans/*.md — catch-all:"

edit_catchall_payload=$(python3 -c "
import json
print(json.dumps({'tool_name': 'Edit', 'tool_input': {
    'file_path': '$plan_path',
    'old_string': 'some old text',
    'new_string': 'some new text'
}}))
")

assert_blocked "Catch-all edit to plans/*.md is blocked" "$edit_catchall_payload"
assert_reason_contains "Catch-all edit → lists mutation tools" "$edit_catchall_payload" "append_history"

# ── proposals/approved/ without HUMAN_APPROVED ───────────────────────────────

echo ""
echo "Write approved: true to proposals/approved/ (no HUMAN_APPROVED):"

approved_path="$REPO/proposals/approved/some-proposal.md"

write_approved_payload=$(python3 -c "
import json
print(json.dumps({'tool_name': 'Write', 'tool_input': {
    'file_path': '$approved_path',
    'content': '---\napproved: true\n---\n# A proposal'
}}))
")

assert_blocked "Write approved:true without HUMAN_APPROVED is blocked" "$write_approved_payload"
assert_reason_contains "Blocked approved write → human auth message" "$write_approved_payload" "HUMAN_APPROVED"

# ── proposals/approved/ WITH HUMAN_APPROVED=1 ────────────────────────────────

echo ""
echo "Write approved: true with HUMAN_APPROVED=1:"

# HUMAN_APPROVED must be set in the shell environment that invokes bash, not in the payload.
echo "$write_approved_payload" | HUMAN_APPROVED=1 bash "$HOOK" 2>/dev/null
approved_exit=$?
if [[ $approved_exit -eq 0 ]]; then
    echo "  ✅ Write approved:true WITH HUMAN_APPROVED=1 passes hook"
    ((passed++))
else
    echo "  ❌ Write approved:true WITH HUMAN_APPROVED=1 — expected exit 0, got $approved_exit"
    ((failed++))
fi

# ── Edit flipping approved: false → true without HUMAN_APPROVED ──────────────

echo ""
echo "Edit flipping approved: false → true:"

edit_flip_payload=$(python3 -c "
import json
print(json.dumps({'tool_name': 'Edit', 'tool_input': {
    'file_path': '$approved_path',
    'old_string': 'approved: false',
    'new_string': 'approved: true'
}}))
")

assert_blocked "Edit approved:false→true without HUMAN_APPROVED is blocked" "$edit_flip_payload"

# ── Writes to non-plan files are allowed ─────────────────────────────────────

echo ""
echo "Non-plan writes are allowed:"

write_doc_payload=$(python3 -c "
import json
print(json.dumps({'tool_name': 'Write', 'tool_input': {
    'file_path': '$REPO/docs/some-doc.md',
    'content': '# Doc'
}}))
")

assert_allowed "Write to docs/*.md is allowed" "$write_doc_payload"

write_src_payload=$(python3 -c "
import json
print(json.dumps({'tool_name': 'Write', 'tool_input': {
    'file_path': '$REPO/src/dispatch/profile.ts',
    'content': 'export {}'
}}))
")

assert_allowed "Write to src/**/*.ts is allowed" "$write_src_payload"

# ── No file_path → pass-through ──────────────────────────────────────────────

echo ""
echo "Missing file_path:"

assert_allowed "Payload with no file_path passes through" \
    '{"tool_name": "Write", "tool_input": {}}'

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "$((passed + failed)) tests: $passed passed, $failed failed"
[[ $failed -eq 0 ]] || exit 1
