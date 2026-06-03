#!/usr/bin/env python3
"""
Transition unit tests for the MCP server lifecycle state machine.

Tests all transition_to_* tools in isolation using temporary files,
verifying validation rules, success paths, and audit logging.

Safe to run — creates and cleans up test artifacts.
"""

import asyncio
import os
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.resolve()
sys.path.insert(0, str(REPO_ROOT / "scripts"))

# Import the MCP server module
spec = __import__("importlib.util").util.spec_from_file_location(
    "mcp_server", str(REPO_ROOT / "scripts" / "mcp-server.py")
)
mod = __import__("importlib.util").util.module_from_spec(spec)
spec.loader.exec_module(mod)

PASS = 0
FAIL = 0


def check(label: str, condition: bool, detail: str = "") -> None:
    global PASS, FAIL
    if condition:
        print(f"  ✓  {label}")
        PASS += 1
    else:
        print(f"  ✗  {label}  -- {detail}")
        FAIL += 1


async def run_tests():
    global PASS, FAIL
    print("\nTransition Unit Tests")
    print("=" * 60)

    # ── Test 1: transition_to_approved rejects when approved=false ──
    print("\n--- transition_to_approved ---")
    mod._write_file("proposals/_tut_approve_reject.md", """\
---
title: "Test — reject"
author: NetYeti
created: 2026-06-02
tags: [test]
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
---
""")
    result = await mod.transition_to_approved("_tut_approve_reject")
    check("rejects when approved=false", "approved=false" in result, result)
    os.remove(mod.REPO_ROOT / "proposals" / "_tut_approve_reject.md")

    # ── Test 2: transition_to_approved rejects when assigned_to empty ──
    mod._write_file("proposals/_tut_approve_noassign.md", """\
---
title: "Test — no assign"
author: NetYeti
created: 2026-06-02
tags: [test]
approved: true
created_by: NetYeti@phoenix
assigned_to: ""
---
""")
    result = await mod.transition_to_approved("_tut_approve_noassign")
    check("rejects when assigned_to empty", "no assigned_to" in result, result)
    os.remove(mod.REPO_ROOT / "proposals" / "_tut_approve_noassign.md")

    # ── Test 3: transition_to_completed rejects when status != completed ──
    print("\n--- transition_to_completed ---")
    mod._write_file("plans/_tut_complete_reject.md", """\
---
title: "Test — reject"
status: approved
author: NetYeti
created: 2026-06-02
tags: [test]
automated: off
assigned_to: NetYeti
---
""")
    result = await mod.transition_to_completed("_tut_complete_reject")
    check("rejects when status=approved", "status=approved" in result, result)
    os.remove(mod.REPO_ROOT / "plans" / "_tut_complete_reject.md")

    # ── Test 4: transition_to_canceled rejects empty reason ──
    print("\n--- transition_to_canceled ---")
    result = await mod.transition_to_canceled("_nonexistent_", "")
    check("rejects empty reason", "cancellation_reason is required" in result, result)

    # ── Test 5: transition_to_canceled success path ──
    mod._write_file("plans/_tut_cancel_success.md", """\
---
title: "Test — cancel"
status: approved
author: NetYeti
created: 2026-06-02
tags: [test]
automated: off
assigned_to: NetYeti
---
""")
    result = await mod.transition_to_canceled("_tut_cancel_success", "Test cancellation")
    check("cancels and moves to completed/", "canceled and moved" in result, result)
    # Clean up
    completed = mod.REPO_ROOT / "plans" / "completed" / "_tut_cancel_success.md"
    if completed.exists():
        os.remove(completed)

    # ── Test 6: run_dry_run detects ready proposals ──
    print("\n--- run_dry_run ---")
    mod._write_file("proposals/_tut_dryrun_ready.md", """\
---
title: "Test — dry run"
author: NetYeti
created: 2026-06-02
tags: [test]
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
---
""")
    result = await mod.run_dry_run()
    check("detects ready proposal", "READY TO APPROVE" in result)
    os.remove(mod.REPO_ROOT / "proposals" / "_tut_dryrun_ready.md")

    # ── Test 7: audit_log returns content after transitions ──
    print("\n--- audit_log ---")
    result = await mod.audit_log()
    check("returns log content", "CANCELED" in result and "COMPLETED" in result)

    # ── Summary ──
    total = PASS + FAIL
    print(f"\n{'=' * 60}")
    print(f"  Results: {PASS}/{total} passed, {FAIL} failed")
    print(f"{'=' * 60}\n")
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(run_tests()))
