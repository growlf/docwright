#!/bin/bash
# commit-msg — git hands this hook the REAL commit message file as $1, which is
# always current (unlike .git/COMMIT_EDITMSG at pre-commit time). It enforces:
#   1. Conventional commit format on the subject line.
#   2. The HUMAN-APPROVED:<name> marker, when pre-commit's validate_no_self_approval
#      detected a proposal's `approved` flipping false→true and armed the flag.
# Splitting detection (pre-commit) from message assertion (here) is the fix for
# the stale-COMMIT_EDITMSG approval bug.

MSG_FILE="$1"
subject=$(head -1 "$MSG_FILE" | tr -d '\r')

# ── 1. Conventional commit format ────────────────────────────────────────────
if [ -n "$subject" ] && \
   ! echo "$subject" | grep -qE '^(feat|fix|docs|refactor|test|chore|policy|decision): .+'; then
    echo -e "\033[0;31m[✗]\033[0m Commit message must follow: <type>: <description>"
    echo -e "\033[0;31m[✗]\033[0m Types: feat, fix, docs, refactor, test, chore, policy, decision"
    exit 1
fi

# ── 2. Human-approval marker ─────────────────────────────────────────────────
# Flag is armed by pre-commit when a proposal is being approved (false→true).
FLAG="$(git rev-parse --git-dir)/dw-needs-human-approval"
if [ -f "$FLAG" ]; then
    rm -f "$FLAG"
    # Look only at the message itself — strip comment lines (and any verbose-commit
    # diff, which git also comments out) so a "HUMAN-APPROVED:" string inside the
    # proposal's own diff can't satisfy the gate.
    if ! grep -v '^#' "$MSG_FILE" | grep -qE 'HUMAN-APPROVED:[[:space:]]*[^[:space:]]'; then
        echo -e "\033[0;31m[✗]\033[0m A proposal's 'approved' changed false→true."
        echo -e "\033[0;31m[✗]\033[0m Only humans can approve proposals. Add a"
        echo -e "\033[0;31m[✗]\033[0m   HUMAN-APPROVED:<name>"
        echo -e "\033[0;31m[✗]\033[0m line to the commit message if you approved this."
        exit 1
    fi
fi

exit 0
