---
title: "SOP: Lifecycle Compliance Audit"
category: governance
created: 2026-06-03
author: NetYeti
reviewed_by: ""
status: approved
tags:
  - governance
  - security
  - lifecycle
  - audit
---

<agent-instructions triggers="audit,compliance,lifecycle-check,self-approval">
Perform a lifecycle compliance audit using the steps below.
Run `node scripts/lifecycle-gate.js --status` and `--audit` first.
Report any violations clearly. Do not remediate without human approval.
</agent-instructions>

# SOP: Lifecycle Compliance Audit

## Purpose

Detect and document lifecycle governance violations: self-approvals, plan-less
mutations, skipped stages, and unauthorized state transitions.

## When to Run

- Before major releases
- After any session where an agent made unexpected lifecycle changes
- On request ("audit lifecycle compliance")
- Automatically in CI (future)

## Quick Check

```bash
node scripts/lifecycle-gate.js --status    # current vault state
node scripts/lifecycle-gate.js --audit     # last 30 logged transitions
```

## Full Audit Procedure

### 1. Check for self-approvals

Scan `proposals/approved/` for any file where the git log shows `approved`
changed from `false` to `true` in a single commit that lacks `HUMAN_APPROVED=1`
in the commit message or environment context:

```bash
for f in proposals/approved/*.md; do
  git log --oneline --follow -p -- "$f" \
    | grep -A2 -B2 'approved: true' | head -20
done
```

### 2. Check plan-proposal linkage

Every plan must trace to an approved proposal via `proposal_source`:

```bash
for f in plans/*.md plans/completed/*.md; do
  grep -q "proposal_source:" "$f" || echo "MISSING proposal_source: $f"
done
```

### 3. Check lifecycle audit log

```bash
cat .docwright/lifecycle-audit.jsonl | python3 -c "
import sys, json
for line in sys.stdin:
    e = json.loads(line.strip())
    print(e['ts'], e['event'], e['file'], e.get('user',''))
"
```

Look for:
- `staged` events on `proposals/approved/` — were these followed by a human commit?
- Transitions that happen outside business hours (possible unattended agent)
- Multiple rapid transitions on the same file (possible agent loop)

### 4. Verify completed plans have docs

```bash
for f in plans/completed/*.md; do
  title=$(grep "^title:" "$f" | sed 's/^title: *//' | tr -d '"')
  slug=$(basename "$f" .md)
  ls docs/$slug.md 2>/dev/null || echo "No doc for completed plan: $f"
done
```

### 5. Check for orphaned approvals

Approved proposals without a corresponding active or completed plan:

```bash
node scripts/vault-status.js | grep "Approved — awaiting plan"
```

## Remediation

If violations are found:
1. Document in `docs/incident-log.md` with timestamp, affected files, description
2. Determine if violation was agent-initiated (automatic remediation) or intentional (policy question)
3. For self-approvals: revert the approval, have a human re-approve properly
4. For missing plan_source: add the field linking to the correct proposal

## Bypass Authorization Record

Any commit made with `HUMAN_APPROVED=1` should be recorded here:

| Date | Commit | Reason | Authorized by |
|------|--------|--------|--------------|
| (none yet) | — | — | — |
