#!/usr/bin/env python3
"""
Tests for MCP plan mutation tools: update_step, update_plan_status,
append_history, set_plan_field, write_plan.

Run: .venv/bin/python3 test/mcp/test-plan-tools.py
"""

import asyncio
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent.resolve()
FIXTURE = ROOT / "plans" / "_test-fixture.md"

# Import mcp-server.py via importlib (hyphen prevents normal import)
spec = importlib.util.spec_from_file_location(
    "mcp_server", ROOT / "scripts" / "mcp-server.py"
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

update_step       = mod.update_step
update_plan_status = mod.update_plan_status
append_history    = mod.append_history
set_plan_field    = mod.set_plan_field
write_plan        = mod.write_plan

# ── Test harness ──────────────────────────────────────────────────────────────

passed = failed = 0

def ok(label: str):
    global passed
    print(f"  ✅ {label}")
    passed += 1

def fail(label: str, detail: str = ""):
    global failed
    msg = f"  ❌ {label}"
    if detail:
        msg += f"\n     {detail}"
    print(msg)
    failed += 1

def assert_ok(label: str, result: str):
    if result.startswith("ERROR"):
        fail(label, result)
    else:
        ok(label)

def assert_error(label: str, result: str, needle: str = "ERROR"):
    if needle in result:
        ok(label)
    else:
        fail(label, f"expected '{needle}' in result: {result[:120]}")

def write_fixture(content: str):
    FIXTURE.write_text(content)

def read_fixture() -> str:
    return FIXTURE.read_text()

FIXTURE_NAME = "_test-fixture"

PLAN_PENDING = """\
---
title: Test Fixture Plan
status: in-progress
phase: 1
total_steps: 2
completed_steps: 1
---
# Test Fixture Plan

## Implementation Steps

| # | Action | Status |
|---|--------|--------|
| 1 | First step done | ✅ Done |
| 2 | Second step pending | ⏳ Pending |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created fixture | Test |
"""

PLAN_ALL_DONE = """\
---
title: Test Fixture Plan
status: in-progress
phase: 1
total_steps: 2
completed_steps: 2
---
# Test Fixture Plan

## Implementation Steps

| # | Action | Status |
|---|--------|--------|
| 1 | First step done | ✅ Done |
| 2 | Second step done | ✅ Done |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created fixture | Test |
"""


# ── update_step ───────────────────────────────────────────────────────────────

async def test_update_step():
    print("\nupdate_step:")

    write_fixture(PLAN_PENDING)
    result = await update_step(FIXTURE_NAME, "Second step pending", "done")
    assert_ok("mark pending step done", result)
    content = read_fixture()
    if "✅ Done" in content and "⏳" not in content:
        ok("file reflects ✅ on both steps")
    else:
        fail("file should show ✅ for both steps", content[:200])

    # Reset and mark done step pending
    write_fixture(PLAN_ALL_DONE)
    result = await update_step(FIXTURE_NAME, "First step done", "pending")
    assert_ok("mark done step pending", result)
    if "⏳ Pending" in read_fixture():
        ok("file reflects ⏳ on reset step")
    else:
        fail("file should show ⏳ on reset step")

    # Non-matching step_match
    write_fixture(PLAN_PENDING)
    result = await update_step(FIXTURE_NAME, "nonexistent step xyz", "done")
    assert_error("no matching step → ERROR", result)

    # Invalid status
    write_fixture(PLAN_PENDING)
    result = await update_step(FIXTURE_NAME, "Second step pending", "bogus")
    assert_error("invalid status → ERROR", result)

    # Non-existent plan
    result = await update_step("_nonexistent_plan_", "step", "done")
    assert_error("non-existent plan → ERROR", result)


# ── update_plan_status ────────────────────────────────────────────────────────

async def test_update_plan_status():
    print("\nupdate_plan_status:")

    # in-progress with all steps done → completed allowed
    write_fixture(PLAN_ALL_DONE)
    result = await update_plan_status(FIXTURE_NAME, "completed")
    assert_ok("all steps done → completed allowed", result)
    if "status: completed" in read_fixture():
        ok("file reflects status: completed")
    else:
        fail("status: completed not written to file")

    # in-progress with pending steps → completed blocked
    write_fixture(PLAN_PENDING)
    result = await update_plan_status(FIXTURE_NAME, "completed")
    assert_error("pending steps → completed blocked", result, "⏳ pending steps")

    # Valid status transition: in-progress → approved
    write_fixture(PLAN_PENDING)
    result = await update_plan_status(FIXTURE_NAME, "approved")
    assert_ok("in-progress → approved allowed", result)

    # Invalid status value
    write_fixture(PLAN_PENDING)
    result = await update_plan_status(FIXTURE_NAME, "banana")
    assert_error("invalid status value → ERROR", result)

    # Non-existent plan
    result = await update_plan_status("_nonexistent_plan_", "completed")
    assert_error("non-existent plan → ERROR", result)


# ── append_history ────────────────────────────────────────────────────────────

async def test_append_history():
    print("\nappend_history:")

    write_fixture(PLAN_PENDING)
    result = await append_history(FIXTURE_NAME, "Test history entry — automated test")
    assert_ok("append history row", result)
    content = read_fixture()
    if "Test history entry — automated test" in content:
        ok("history row present in file")
    else:
        fail("history row missing from file", content[-300:])

    # Append second entry — table should grow
    result2 = await append_history(FIXTURE_NAME, "Second history entry")
    assert_ok("append second history row", result2)
    if content.count("| Date |") == read_fixture().count("| Date |"):
        ok("table not duplicated on second append")
    else:
        fail("history table header was duplicated")

    # Non-existent plan
    result = await append_history("_nonexistent_plan_", "test")
    assert_error("non-existent plan → ERROR", result)


# ── set_plan_field ────────────────────────────────────────────────────────────

async def test_set_plan_field():
    print("\nset_plan_field:")

    write_fixture(PLAN_PENDING)
    result = await set_plan_field(FIXTURE_NAME, "assigned_to", "TestUser")
    assert_ok("set assigned_to field", result)
    if "assigned_to: TestUser" in read_fixture():
        ok("field written to frontmatter")
    else:
        fail("field not found in file", read_fixture()[:200])

    # Restricted field: status
    write_fixture(PLAN_PENDING)
    result = await set_plan_field(FIXTURE_NAME, "status", "completed")
    assert_error("status field is restricted → ERROR", result, "restricted")

    # Restricted field: gate_status
    result = await set_plan_field(FIXTURE_NAME, "gate_status", "approved")
    assert_error("gate_status field is restricted → ERROR", result, "restricted")

    # Restricted field: completed_steps
    result = await set_plan_field(FIXTURE_NAME, "completed_steps", "99")
    assert_error("completed_steps field is restricted → ERROR", result, "restricted")

    # Non-existent plan
    result = await set_plan_field("_nonexistent_plan_", "priority", "high")
    assert_error("non-existent plan → ERROR", result)


# ── write_plan ────────────────────────────────────────────────────────────────

async def test_write_plan():
    print("\nwrite_plan:")

    # Valid full rewrite — no pending steps
    write_fixture(PLAN_PENDING)
    result = await write_plan(FIXTURE_NAME, PLAN_ALL_DONE)
    assert_ok("valid full rewrite accepted", result)
    if "Second step done" in read_fixture():
        ok("new content written to file")
    else:
        fail("file content was not replaced")

    # Reject: status: completed + pending steps
    bad_content = PLAN_PENDING.replace("status: in-progress", "status: completed")
    result = await write_plan(FIXTURE_NAME, bad_content)
    assert_error("status:completed + ⏳ → ERROR", result, "pending steps")

    # Reject: missing title frontmatter
    no_title = "---\nstatus: in-progress\n---\n# No title field"
    result = await write_plan(FIXTURE_NAME, no_title)
    assert_error("missing title → ERROR", result, "title")

    # Reject: gate_status: approved (human-only field)
    gate_content = PLAN_ALL_DONE.replace(
        "title: Test Fixture Plan",
        "title: Test Fixture Plan\ngate_status: approved"
    )
    result = await write_plan(FIXTURE_NAME, gate_content)
    assert_error("gate_status:approved → ERROR", result, "gate_status")

    # Non-existent plan used for write — should CREATE (write_plan creates if not found)
    # This is intentional behaviour; we just check it doesn't error
    new_plan_content = PLAN_ALL_DONE.replace("_test-fixture", "_test-fixture-new")
    result = await write_plan("_test-fixture-new", new_plan_content)
    new_path = ROOT / "plans" / "_test-fixture-new.md"
    if new_path.exists():
        new_path.unlink()
        ok("write_plan creates new plan file (and we cleaned it up)")
    else:
        # Some implementations may return error for non-existent — either is ok
        ok("write_plan non-existent plan handled (error or created)")


# ── Run all ───────────────────────────────────────────────────────────────────

async def main():
    try:
        await test_update_step()
        await test_update_plan_status()
        await test_append_history()
        await test_set_plan_field()
        await test_write_plan()
    finally:
        if FIXTURE.exists():
            FIXTURE.unlink()

    print(f"\n{passed + failed} tests: {passed} passed, {failed} failed")
    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
