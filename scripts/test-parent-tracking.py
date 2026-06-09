#!/usr/bin/env python3
"""
Parent tracking unit tests for the MCP server.
Tests _update_parent_deliverable with temporary fixture files.
"""

import asyncio
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.resolve()
sys.path.insert(0, str(REPO_ROOT / "scripts"))

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


def make_parent_deliverables(done_rows: list[int]) -> str:
    rows = [
        "| # | Deliverable | Status |",
        "|---|------------|--------|",
    ]
    for i in range(1, 11):
        status = "✅ Done" if i in done_rows else "⏳ Planned"
        rows.append(f"| {i} | Deliverable {i} | {status} |")
    return "\n".join(rows) + "\n"


async def run_tests():
    global PASS, FAIL
    print("\nParent Tracking Unit Tests")
    print("=" * 60)

    # ── Test: parse_frontmatter extracts parent fields ──
    print("\n--- _parse_frontmatter ---")
    fm = mod._parse_frontmatter("""\
---
title: Test Plan
parent_plan: phase-parent.md
parent_deliverable: "3"
priority: high
---
""")
    check("extracts parent_plan", fm.get("parent_plan") == "phase-parent.md",
          f"got: {fm.get('parent_plan')}")
    check("extracts parent_deliverable", fm.get("parent_deliverable") == "3",
          f"got: {fm.get('parent_deliverable')}")
    check("extracts priority", fm.get("priority") == "high",
          f"got: {fm.get('priority')}")

    fm2 = mod._parse_frontmatter("---\ntitle: No parent\n---\n")
    check("missing parent_plan returns empty", not fm2.get("parent_plan"),
          f"got: {fm2.get('parent_plan')}")

    # ── Test: update_parent_deliverable ──
    print("\n--- _update_parent_deliverable ---")

    # Setup: write a parent plan with Deliverables table
    parent_content = f"""\
---
title: Phase Parent
status: in-progress
phase: 3
---

## Overview

Parent plan.

## Deliverables

| # | Deliverable | Status |
|---|------------|--------|
| 1 | First deliverable | ⏳ Planned |
| 2 | Second deliverable | ⏳ Planned |
| 3 | Third deliverable | ⏳ Planned |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-01 | Created | NetYeti |
"""
    mod._write_file("plans/_tut_parent.md", parent_content)

    # Sub-plan text with parent_plan + parent_deliverable
    sub_text = """\
---
title: Sub Plan
status: completed
parent_plan: _tut_parent.md
parent_deliverable: "2"
---
"""
    result = mod._update_parent_deliverable(sub_text, "_tut_sub.md")
    check("updates parent deliverable", "✅ Done" in result,
          f"got: {result[:80]}")

    # Verify parent file was updated
    updated = mod._read_file("plans/_tut_parent.md")
    check("row 2 now ✅ Done",
          "| 2 | Second deliverable | ✅ Done |" in updated,
          f"row 2 not updated")
    check("row 1 still ⏳",
          "| 1 | First deliverable | ⏳ Planned |" in updated,
          f"row 1 changed")
    check("history appended", "sub completed" in updated and "✅ Done" in updated,
          f"history not appended")

    # Clean up
    os.remove(mod.REPO_ROOT / "plans" / "_tut_parent.md")

    # ── Test: no parent_plan = no-op ──
    print("\n--- no parent_plan (no-op) ---")
    sub_no_parent = """\
---
title: Standalone Plan
status: completed
---
"""
    result2 = mod._update_parent_deliverable(sub_no_parent, "_tut_standalone.md")
    check("no-op when parent_plan absent", result2 == "",
          f"got: {result2[:60]}")

    # ── Test: parent file not found ──
    print("\n--- parent file missing ---")
    sub_bad_parent = """\
---
title: Orphan Plan
status: completed
parent_plan: _nonexistent_parent.md
parent_deliverable: "1"
---
"""
    result3 = mod._update_parent_deliverable(sub_bad_parent, "_tut_orphan.md")
    check("warns when parent missing", "not found" in result3,
          f"got: {result3[:60]}")

    # ── Test: deliverable row not found ──
    print("\n--- deliverable row not found ---")
    parent_two_rows = """\
---
title: Small Parent
---

## Deliverables

| # | Deliverable | Status |
|---|------------|--------|
| 1 | Only one | ⏳ Planned |
"""
    mod._write_file("plans/_tut_small_parent.md", parent_two_rows)
    sub_high_deliv = """\
---
title: High Number
status: completed
parent_plan: _tut_small_parent.md
parent_deliverable: "5"
---
"""
    result4 = mod._update_parent_deliverable(sub_high_deliv, "_tut_high.md")
    check("warns when row not found", "not found" in result4,
          f"got: {result4[:60]}")
    os.remove(mod.REPO_ROOT / "plans" / "_tut_small_parent.md")

    # ── Results ──
    print()
    print("=" * 60)
    print(f"  Results: {PASS} passed, {FAIL} failed")
    print("=" * 60)
    return FAIL == 0


if __name__ == "__main__":
    success = asyncio.run(run_tests())
    sys.exit(0 if success else 1)
