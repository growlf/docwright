#!/usr/bin/env python3
"""
DocWright MCP Server (dw-mcp) — lifecycle state machine for this project.

Serves lifecycle data as tools and owns all state transitions so agents
never directly mutate lifecycle files. The Claude Code PreToolUse hook
intercepts direct write attempts; this server validates all transition calls.

Tools:
  get_session_context()       SESSION-LOG.md + active plans
  get_status()                Full lifecycle status (60s TTL cache)
  list_active_plans()         Plans with status approved/in_progress
  get_plan(name)              Read a specific plan file
  get_facts()                 Project invariants and operational gotchas
  run_dry_run()               Show pending transitions (read-only)

  -- Plan mutation (use these; direct file writes to plans/ are blocked) --
  update_step(name, match, status)   Update one step row; recounts totals
  update_plan_status(name, status)   Change status with pending-step validation
  append_history(name, change)       Append a Document History row
  set_plan_field(name, field, value) Set one frontmatter field (restricted fields blocked)
  write_plan(name, content)          Full structural rewrite (escape hatch)

  -- Lifecycle transitions --
  transition_to_approved()    Move approved proposal + create plan
  transition_to_completed()   Move completed plan + generate doc
  transition_to_canceled()    Cancel a plan with reason
  audit_log()                 Read back all lifecycle transitions

Usage:
  .venv/bin/python3 scripts/mcp-server.py           # MCP stdio
  .venv/bin/python3 scripts/mcp-server.py --test    # smoke-test all tools
"""

import asyncio
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import yaml

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    print("ERROR: mcp package not installed.\nRun: .venv/bin/pip install mcp", file=sys.stderr)
    sys.exit(1)

REPO_ROOT = Path(__file__).parent.parent.resolve()
CACHE_FILE = Path(os.environ.get("DOCWRIGHT_CACHE_DIR", "/tmp")) / "docwright-status-cache.txt"
AUDIT_LOG = REPO_ROOT / ".docwright" / "audit.jsonl"
CACHE_TTL = 60

# Single source of truth for mutation tool names — footer reads from this list.
# Add a new mutation tool here and the get_plan() governance footer updates automatically.
PLAN_MUTATION_TOOLS = [
    "update_step",
    "update_plan_status",
    "append_history",
    "set_plan_field",
    "write_plan",
]

mcp = FastMCP("docwright")


# ── Helpers ─────────────────────────────────────────────────────────────────


def _governance_footer() -> str:
    """Footer appended to every get_plan() response — reminds agents to use MCP tools."""
    tools = " · ".join(PLAN_MUTATION_TOOLS)
    return (
        "\n\n---\n"
        f"⚠ **Governance:** mutate this plan via MCP only — {tools}. "
        "Direct writes to `plans/*.md` are blocked by the PreToolUse hook. "
        "Bash/Python writes bypass the hook and are equally prohibited (AGENTS.md §Invariant 6). "
        "If MCP is unavailable: halt and report, do not fall back to direct writes."
    )


def _read_file(rel_path: str) -> str:
    p = REPO_ROOT / rel_path
    if not p.exists():
        raise FileNotFoundError(f"{rel_path} not found")
    return p.read_text()


def _write_file(rel_path: str, content: str) -> None:
    p = REPO_ROOT / rel_path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)


def _move_file(src_rel: str, dst_rel: str) -> None:
    src = REPO_ROOT / src_rel
    dst = REPO_ROOT / dst_rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    src.rename(dst)


def _status_cache_hit() -> str | None:
    if CACHE_FILE.exists() and (time.time() - CACHE_FILE.stat().st_mtime) < CACHE_TTL:
        return CACHE_FILE.read_text()
    return None


def _write_cache(text: str) -> None:
    CACHE_FILE.write_text(text)


def _extract_frontmatter_field(text: str, field: str) -> str:
    m = re.search(rf"^{field}:\s*(.+)$", text, re.MULTILINE)
    return m.group(1).strip().strip("\"'") if m else ""


def _set_frontmatter_field(text: str, field: str, value: str) -> str:
    return re.sub(
        rf"^({field}:).*$",
        rf"\1 {value}",
        text,
        count=1,
        flags=re.MULTILINE,
    )


def _has_pending_steps(text: str) -> bool:
    """Return True if ⏳ appears in the Status column (last cell) of a step row.
    ⏳ in the Details column is fine — only the Status column matters."""
    in_sec = False
    for line in text.splitlines():
        if line.startswith("## "):
            in_sec = "Implementation Steps" in line
        elif line.startswith("### ") and not in_sec:
            pass
        elif in_sec and line.startswith("|") and not line.startswith("|---"):
            cells = [c.strip() for c in line.split("|") if c.strip()]
            if cells and "⏳" in cells[-1]:
                return True
    return False


def _count_steps(text: str) -> tuple[int, int]:
    """Return (total, completed) step counts from Implementation Steps section."""
    total = completed = 0
    in_sec = False
    for line in text.splitlines():
        if line.startswith("## "):
            in_sec = "Implementation Steps" in line
        elif line.startswith("### ") and not in_sec:
            pass
        elif in_sec and line.startswith("|"):
            if "✅" in line:
                total += 1
                completed += 1
            elif "⏳" in line:
                total += 1
    return total, completed


def _ensure_frontmatter_field(text: str, field: str, value: str) -> str:
    """Set a frontmatter field, inserting it if not already present."""
    if re.search(rf"^{field}:\s", text, re.MULTILINE):
        return _set_frontmatter_field(text, field, value)
    m = re.match(r"^(---\n)(.*?)(---\n)", text, re.DOTALL)
    if m:
        fm = m.group(2).rstrip("\n") + f"\n{field}: {value}\n"
        return m.group(1) + fm + m.group(3) + text[m.end():]
    return text


def _update_step_counts(text: str) -> str:
    """Recount steps and write total_steps / completed_steps into frontmatter."""
    total, completed = _count_steps(text)
    text = _ensure_frontmatter_field(text, "total_steps", str(total))
    text = _ensure_frontmatter_field(text, "completed_steps", str(completed))
    return text


def _update_parent_deliverable(
    sub_plan_text: str, sub_plan_name: str
) -> str:
    """
    If the plan has parent_plan + parent_deliverable frontmatter, update
    the parent's Deliverables table row to ✅ Done and append history.
    Returns status message or empty string if no parent fields set.
    """
    fm = _parse_frontmatter(sub_plan_text)
    parent_plan = (fm.get("parent_plan") or "").strip()
    parent_deliverable = (fm.get("parent_deliverable") or "").strip()
    if not parent_plan or not parent_deliverable:
        return ""

    # Normalize parent filename
    if not parent_plan.endswith(".md"):
        parent_plan += ".md"
    parent_path = f"plans/{parent_plan}"

    try:
        parent_text = _read_file(parent_path)
    except FileNotFoundError:
        return f"WARNING: Parent plan '{parent_plan}' not found — no deliverable updated."

    deliverable_num = parent_deliverable.strip()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Find the ## Deliverables section and update the matching row
    in_deliverables = False
    lines = parent_text.splitlines()
    new_lines: list[str] = []
    row_found = False
    old_status = ""

    for line in lines:
        if line.startswith("## "):
            in_deliverables = "Deliverables" in line

        if in_deliverables and line.startswith("|") and not line.startswith("|---"):
            parts = line.split("|")
            # parts[1] is the first cell (after opening |)
            if len(parts) >= 2 and parts[1].strip() == deliverable_num:
                # Replace the last non-empty cell with ✅ Done
                for i in range(len(parts) - 1, -1, -1):
                    if parts[i].strip():
                        old_status = parts[i].strip()
                        parts[i] = " ✅ Done "
                        break
                line = "|".join(parts)
                row_found = True

        new_lines.append(line)

    if not row_found:
        return f"WARNING: Deliverable row #{deliverable_num} not found in parent '{parent_plan}' — no update."

    new_parent_text = "\n".join(new_lines)

    # Write back and verify
    _write_file(parent_path, new_parent_text)
    verify = _read_file(parent_path)
    if verify != new_parent_text:
        return f"ERROR: Parent '{parent_plan}' write verification failed — file may be corrupted."

    # Append history to parent
    history_row = f"| {now} | Sub-plan {sub_plan_name.replace('.md','')} completed — Deliverable {deliverable_num}: {old_status} → ✅ Done | _auto_ |"
    if "## Document History" in verify:
        verify = verify.rstrip("\n") + "\n" + history_row + "\n"
    else:
        verify += f"\n\n## Document History\n\n| Date | Change | Author |\n|------|--------|--------|\n{history_row}\n"
    _write_file(parent_path, verify)

    return f"Parent '{parent_plan}' deliverable #{deliverable_num}: {old_status} → ✅ Done."


def _has_testing_plan(content: str) -> bool:
    """Check if content has a ## Testing Plan section with non-empty content."""
    m = re.search(r"^##\s+Testing Plan\s*\n(.*?)(?=^##\s|\Z)", content, re.MULTILINE | re.DOTALL)
    if not m:
        return False
    section = m.group(1).strip()
    # Consider it meaningful if it has more than just a placeholder or empty text
    return bool(section) and section not in ("_Add test plan during implementation._", "", "{{VALUE:testing}}")


def _check_completion_gate(text: str, plan_name: str) -> str | None:
    """
    Validate that a plan is ready to be marked completed.
    Returns an error string if any gate check fails, or None if all pass.
    Checks (in order):
      1. tests_defined: true must be set in frontmatter
      2. A ## Phase Gate section must exist
      3. No unchecked [ ] items in the Phase Gate section
    """
    tests_defined = _extract_frontmatter_field(text, "tests_defined")
    if tests_defined != "true":
        return (
            f"ERROR: Plan '{plan_name}' has tests_defined: {tests_defined or 'missing'}. "
            "A human reviewer must set tests_defined: true after confirming test "
            "coverage is adequate before the plan can be completed."
        )

    in_gate = False
    gate_found = False
    unchecked = 0
    for line in text.splitlines():
        if line.startswith("## "):
            if in_gate:
                break
            in_gate = "Phase Gate" in line
            if in_gate:
                gate_found = True
        elif in_gate and "- [ ]" in line:
            unchecked += 1

    if not gate_found:
        return (
            f"ERROR: Plan '{plan_name}' has no ## Phase Gate section. "
            "All plans must have a Phase Gate section that is fully signed off "
            "before completion."
        )

    if unchecked > 0:
        return (
            f"ERROR: Plan '{plan_name}' has {unchecked} unchecked Phase Gate "
            f"item{'s' if unchecked != 1 else ''}. All Phase Gate items must be "
            "checked [x] before the plan can be completed."
        )

    return None


def _replace_step_status(text: str, step_match: str, new_status: str) -> tuple[str, bool]:
    """Find first step row containing step_match (in any step section) and replace its status column."""
    lines = text.split("\n")
    in_sec = False
    for i, line in enumerate(lines):
        if line.startswith("## "):
            in_sec = "Implementation Steps" in line
        elif line.startswith("### ") and not in_sec:
            pass
        elif in_sec and line.startswith("|") and step_match in line:
            stripped = line.rstrip()
            if stripped.endswith("|"):
                inner = stripped[:-1].rstrip()
                last_pipe = inner.rfind("|")
                if last_pipe >= 0:
                    lines[i] = inner[: last_pipe + 1] + " " + new_status + " |"
                    return "\n".join(lines), True
    return text, False


def _append_history_row(text: str, change: str, author: str, date: str) -> str:
    """Append a row to the Document History table; create the table if absent."""
    new_row = f"| {date} | {change} | {author} |"
    lines = text.split("\n")
    in_history = False
    last_table_idx = -1
    for i, line in enumerate(lines):
        if line.startswith("## "):
            if in_history and last_table_idx >= 0:
                break
            in_history = "Document History" in line
        elif in_history and line.startswith("|"):
            last_table_idx = i
    if last_table_idx >= 0:
        lines.insert(last_table_idx + 1, new_row)
        return "\n".join(lines)
    return text.rstrip("\n") + "\n\n## Document History\n\n| Date | Change | Author |\n|------|--------|--------|\n" + new_row + "\n"


def _get_human_identity() -> str:
    """Resolve human identity from .env → git config → fallback."""
    env_file = REPO_ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("OPCODE_USER_NAME="):
                name = line.split("=", 1)[1].strip().strip("\"'")
                if name and name != "Your Full Name":
                    return name
    try:
        import subprocess
        r = subprocess.run(["git", "config", "user.name"], capture_output=True, text=True, cwd=REPO_ROOT)
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip()
    except Exception:
        pass
    return "NetYeti"


_STEP_STATUS_MAP = {
    "done": "✅ Done", "complete": "✅ Done", "completed": "✅ Done",
    "✅": "✅ Done", "✅ done": "✅ Done",
    "pending": "⏳ Pending", "todo": "⏳ Pending", "not done": "⏳ Pending",
    "⏳": "⏳ Pending", "⏳ pending": "⏳ Pending",
}

_VALID_PLAN_STATUSES = {"draft", "approved", "in-progress", "completed", "canceled"}

_RESTRICTED_PLAN_FIELDS = {
    "status": "Use update_plan_status() instead.",
    "gate_status": "gate_status must be set by a human reviewer.",
    "approved": "Plans do not use the approved field.",
    "total_steps": "total_steps is managed automatically.",
    "completed_steps": "completed_steps is managed automatically.",
}


def _safe_plan_name(plan_name: str) -> str:
    return Path(plan_name if plan_name.endswith(".md") else plan_name + ".md").name


def _scan_plans(dir_name: str, *statuses: str) -> list[tuple[str, str, str]]:
    base = REPO_ROOT / dir_name
    results = []
    for path in sorted(base.glob("*.md")):
        text = path.read_text()
        status = _extract_frontmatter_field(text, "status")
        if statuses and status not in statuses:
            continue
        title = _extract_frontmatter_field(text, "title") or path.stem
        results.append((title, path.name, status))
    return results


def _active_plans_text() -> str:
    plans = _scan_plans("plans", "approved", "in_progress", "in-progress")
    if not plans:
        return "No plans ready for execution."
    lines = [f"- {t}  ({f}) [{s}]" for t, f, s in plans]
    return "Active plans:\n" + "\n".join(lines)


# ── Collation (keyword overlap) ────────────────────────────────────────────


_STOP_WORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "shall", "can", "not",
    "no", "nor", "so", "if", "then", "than", "that", "this", "these",
    "those", "it", "its", "they", "them", "their", "we", "you", "our",
    "all", "each", "every", "both", "few", "more", "most", "other",
    "some", "such", "only", "own", "same", "too", "very", "just",
    "about", "above", "after", "again", "against", "because", "before",
    "between", "under", "over", "up", "down", "out", "off", "into",
}


def _tokenize(text: str) -> set[str]:
    words = re.findall(r"[a-zA-Z][a-zA-Z0-9]{2,}", text.lower())
    return {w for w in words if w not in _STOP_WORDS}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _scan_docs_for_collation() -> list[dict]:
    docs = []
    for dir_name in ["proposals", "proposals/approved", "plans", "plans/completed"]:
        base = REPO_ROOT / dir_name
        for path in sorted(base.glob("*.md")):
            text = path.read_text()
            fm_end = text.find("---", 3)
            fm = text[3:fm_end] if fm_end > 0 else ""
            body = text[fm_end + 3:] if fm_end > 0 else text
            title = _extract_frontmatter_field(fm, "title") or path.stem
            rel = str(path.relative_to(REPO_ROOT))
            docs.append({
                "path": rel,
                "title": title,
                "tokens": _tokenize(fm + "\n" + body),
            })
    return docs


# ── End collation helpers ────────────────────────────────────────────────────


def _log_transition(action: str, detail: str) -> None:
    import json as _json
    AUDIT_LOG.parent.mkdir(parents=True, exist_ok=True)
    entry = _json.dumps({
        "ts": datetime.now(timezone.utc).isoformat(),
        "event": action,
        "detail": detail,
        "host": __import__("socket").gethostname(),
    })
    with open(AUDIT_LOG, "a") as f:
        f.write(entry + "\n")


def _build_status() -> str:
    lines = []
    sep = "-" * 80
    lines.append(f"{'LIFECYCLE DOCUMENT STATUS':^80}")
    lines.append(f"  {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}")
    lines.append("")

    active = _scan_plans("plans", "approved", "in_progress", "in-progress")
    if not active:
        lines.append("  ⚠  COMPLIANCE WARNING: No active approved plan.")
        lines.append("      Lifecycle transitions require an active plan.")
        lines.append("      Run list_active_plans() to see available plans.")
        lines.append("")

    lines.append("  PROPOSALS (proposals/):")
    lines.append(f"  {sep}")
    for t, f, s in _scan_plans("proposals"):
        approved = "✗" if s == "false" else "✓" if s == "true" else s
        lines.append(f"     {f:<55} approved={approved}")
    lines.append("")

    lines.append("  APPROVED PROPOSALS (proposals/approved/):")
    lines.append(f"  {sep}")
    for path in sorted((REPO_ROOT / "proposals" / "approved").glob("*.md")):
        text = path.read_text()
        assigned = _extract_frontmatter_field(text, "assigned_to") or "—"
        lines.append(f"     {path.stem:<55} assigned_to={assigned}")
    lines.append("")

    lines.append("  PLANS (plans/):")
    lines.append(f"  {sep}")
    for t, f, s in _scan_plans("plans"):
        lines.append(f"     {f:<55} status={s}")
    lines.append("")

    lines.append("  COMPLETED PLANS (plans/completed/):")
    lines.append(f"  {sep}")
    for t, f, s in _scan_plans("plans/completed"):
        lines.append(f"     {f:<55} status={s}")

    return "\n".join(lines)


# ── MCP Tools — Informational ────────────────────────────────────────────────


@mcp.tool()
async def get_session_context() -> str:
    """SESSION-LOG.md (last 100 lines) + active plans summary."""
    parts = []
    try:
        log = _read_file("SESSION-LOG.md")
        lines = log.splitlines()
        if len(lines) > 100:
            parts.append(f"[SESSION-LOG.md — showing last 100 of {len(lines)} lines]\n\n" + "\n".join(lines[-100:]))
        else:
            parts.append(f"[SESSION-LOG.md]\n\n{log}")
    except Exception as e:
        parts.append(f"[SESSION-LOG.md unavailable: {e}]")
    try:
        parts.append(f"[Active Plans]\n\n{_active_plans_text()}")
    except Exception as e:
        parts.append(f"[Active plans unavailable: {e}]")
    return "\n\n---\n\n".join(parts)


@mcp.tool()
async def get_status() -> str:
    """Full lifecycle status of proposals, plans, and completed items. 60s cache."""
    cached = _status_cache_hit()
    if cached:
        return cached
    try:
        result = _build_status()
        _write_cache(result)
        return result
    except Exception as e:
        if CACHE_FILE.exists():
            return f"[stale cache — live fetch failed: {e}]\n\n" + CACHE_FILE.read_text()
        return f"Status unavailable: {e}"


@mcp.tool()
async def list_active_plans() -> str:
    """List all plans currently with status: approved or in_progress."""
    try:
        return _active_plans_text()
    except Exception as e:
        return f"Error listing plans: {e}"


@mcp.tool()
async def get_plan(name: str) -> str:
    """Read a specific plan file. Pass filename with or without .md extension."""
    footer = _governance_footer()
    try:
        safe = Path(name if name.endswith(".md") else name + ".md").name
        text = _read_file(f"plans/{safe}")
        return text + footer
    except FileNotFoundError:
        try:
            text = _read_file(f"plans/completed/{safe}")
            return f"[completed plan]\n\n{text}" + footer
        except FileNotFoundError:
            return f"Plan '{name}' not found. Use list_active_plans() or get_status()."
    except Exception as e:
        return f"Error reading plan: {e}"


@mcp.tool()
async def get_facts() -> str:
    """Project invariants and operational gotchas. Call before lifecycle changes."""
    parts = []
    parts.append("""\
## Invariants

1. Agents NEVER set approved: true on proposals — only humans
2. No active work before plan approval (status: approved or in-progress)
3. Lifecycle transitions MUST use `transition_to_*` MCP tools, not direct file edits
4. Frontmatter is audit record, not enforcement
5. Git is the canonical store — index.json is derived cache, rebuild don't restore
6. No telemetry, ever
7. author-role field required in all templates

## MCP State Machine Rules

- transition_to_approved: requires approved: true + non-empty assigned_to (human sets these)
- transition_to_completed: requires all tasks completed, plan not already done
- transition_to_canceled: requires non-empty cancellation_reason
- All transitions are logged to .docwright/audit.jsonl (append-only NDJSON)""")
    try:
        sops = sorted((REPO_ROOT / "docs" / "SOPs").glob("*.md"))
        sop_list = "\n".join(f"- docs/SOPs/{p.name}" for p in sops)
        parts.append(f"## Available SOPs\n\n{sop_list}")
    except Exception:
        pass
    return "\n\n---\n\n".join(parts)


@mcp.tool()
async def collate(threshold: float = 0.12) -> str:
    """
    Find overlapping proposals and plans by keyword similarity.
    Scans all lifecycle docs, computes Jaccard similarity on significant words,
    and groups matches above the threshold (default 0.12).
    Pass higher threshold to reduce noise, lower to surface more potential overlaps.
    """
    try:
        docs = _scan_docs_for_collation()
        n = len(docs)
        pairs = []
        for i in range(n):
            for j in range(i + 1, n):
                score = _jaccard(docs[i]["tokens"], docs[j]["tokens"])
                if score >= threshold:
                    pairs.append((score, docs[i], docs[j]))
        pairs.sort(key=lambda x: -x[0])

        if not pairs:
            return f"No overlaps found above threshold {threshold} across {n} documents."

        lines = [f"Overlap analysis ({len(pairs)} pairs above threshold {threshold}):", ""]
        for score, a, b in pairs:
            pct = f"{score:.0%}" if score >= 0.1 else f"{score:.1%}"
            lines.append(f"  {pct}  {a['path']}")
            lines.append(f"       {b['path']}")
            lines.append("")
        return "\n".join(lines)
    except Exception as e:
        return f"Collation error: {e}"


# ── MCP Tools — State Machine (Transition Tools) ─────────────────────────────


@mcp.tool()
async def run_dry_run() -> str:
    """
    Show pending lifecycle transitions without applying them.
    Safe read-only operation. Call before any transition_to_* tool.
    """
    lines = []
    lines.append("PENDING LIFECYCLE TRANSITIONS (dry run)")
    lines.append("=" * 50)

    proposals_dir = REPO_ROOT / "proposals"
    for path in sorted(proposals_dir.glob("*.md")):
        if path.parent.name == "approved":
            continue
        text = path.read_text()
        approved = _extract_frontmatter_field(text, "approved")
        assigned = _extract_frontmatter_field(text, "assigned_to")
        if approved == "true" and assigned:
            title = _extract_frontmatter_field(text, "title") or path.stem
            lines.append(f"\n[READY TO APPROVE]  {path.stem}")
            lines.append(f"  Title: {title}")
            lines.append(f"  Assigned to: {assigned}")
            lines.append(f"  Run: transition_to_approved(name='{path.stem}')")

    plans_dir = REPO_ROOT / "plans"
    for path in sorted(plans_dir.glob("*.md")):
        if path.parent.name == "completed":
            continue
        text = path.read_text()
        status = _extract_frontmatter_field(text, "status")
        if status == "completed":
            title = _extract_frontmatter_field(text, "title") or path.stem
            lines.append(f"\n[READY TO COMPLETE]  {path.stem}")
            lines.append(f"  Title: {title}")
            lines.append(f"  Run: transition_to_completed(name='{path.stem}')")

    if len(lines) == 1:
        return "No pending lifecycle transitions."

    return "\n".join(lines)


@mcp.tool()
def _parse_frontmatter(text: str) -> dict:
    """Parse YAML frontmatter from markdown text into a dict."""
    m = re.match(r"^---\s*\n(.*?)\n---", text, re.DOTALL)
    if not m:
        return {}
    try:
        return yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        return {}


def _format_yaml_list(items: list) -> str:
    """Format a list as indented YAML lines."""
    if not items:
        return ""
    return "\n" + "\n".join(f"  - {item}" for item in items)


async def transition_to_approved(proposal_name: str) -> str:
    """
    Transition a proposal with approved: true to proposals/approved/ and create a plan.
    Only call this after the human has set approved: true and assigned_to in the frontmatter.
    Validates: approved must be true, assigned_to must be non-empty.
    Carries over priority, parent_plan, parent_deliverable, phase, tags from the proposal.
    """
    safe = Path(proposal_name if proposal_name.endswith(".md") else proposal_name + ".md").name

    try:
        text = _read_file(f"proposals/{safe}")
    except FileNotFoundError:
        return f"ERROR: Proposal '{proposal_name}' not found in proposals/."

    fm = _parse_frontmatter(text)

    approved = str(fm.get("approved", "")).lower()
    assigned = str(fm.get("assigned_to", "")).strip()
    title = fm.get("title") or safe.replace(".md", "")

    if approved != "true":
        return f"ERROR: Proposal '{proposal_name}' has approved={approved}. Only humans set approved: true."
    if not assigned:
        return f"ERROR: Proposal '{proposal_name}' has no assigned_to. Human must set it."

    _move_file(f"proposals/{safe}", f"proposals/approved/{safe}")

    tags = fm.get("tags", [])
    if isinstance(tags, str):
        tags = [tags]
    tags_yaml = _format_yaml_list(tags)

    priority = fm.get("priority", "medium")
    phase = fm.get("phase", "")
    parent_plan = fm.get("parent_plan", "")
    parent_deliverable = fm.get("parent_deliverable", "")
    complexity = fm.get("complexity", "")

    fields = []
    fields.append(f"title: {title}")
    fields.append(f"status: approved")
    fields.append(f"author: {fm.get('author') or 'NetYeti'}")
    fields.append(f"created: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}")
    fields.append(f"tags:{tags_yaml}")
    fields.append(f"proposal_source: proposals/approved/{safe}")
    fields.append(f"priority: {priority}")
    if phase:
        fields.append(f"phase: {phase}")
    if complexity:
        fields.append(f"complexity: {complexity}")
    fields.append(f"automated: guided")
    fields.append(f"assigned_to: {assigned}")
    if parent_plan:
        fields.append(f"parent_plan: {parent_plan}")
    if parent_deliverable:
        fields.append(f"parent_deliverable: \"{parent_deliverable}\"")
    has_tests = _has_testing_plan(body)
    fields.append(f"tests_defined: {'true' if has_tests else 'false'}")

    plan_slug = safe

    # Extract proposal body (everything after frontmatter) as overview material
    body = re.sub(r"^---.*?\n---\s*", "", text, count=1, flags=re.DOTALL).strip()

    plan_content = f"""---
{chr(10).join(fields)}
---

# {title}

## Overview

*Plan generated from approved proposal: {title}*

{body}

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | | | ⏳ Pending |

## Testing Plan

_Add test plan during implementation._

## Rollback Procedures

_Add rollback procedures during implementation._

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| | | | |

## Document History

| Date | Change | Author |
|------|--------|--------|
| {datetime.now(timezone.utc).strftime('%Y-%m-%d')} | Created from approved proposal | {fm.get('author') or 'NetYeti'} |
"""
    _write_file(f"plans/{plan_slug}", plan_content)

    _log_transition("APPROVED", f"proposal/{safe} → proposals/approved/ + plan created")
    return f"✅ Proposal '{safe}' approved and moved to proposals/approved/. Plan created at plans/{plan_slug}."


@mcp.tool()
async def transition_to_completed(plan_name: str) -> str:
    """
    Transition a plan with status: completed to plans/completed/ and generate doc.
    Validates: plan must have status: completed, must not already be in completed/.
    """
    safe = Path(plan_name if plan_name.endswith(".md") else plan_name + ".md").name

    try:
        text = _read_file(f"plans/{safe}")
    except FileNotFoundError:
        return f"ERROR: Plan '{plan_name}' not found in plans/. Has it already been completed?"

    status = _extract_frontmatter_field(text, "status")
    title = _extract_frontmatter_field(text, "title") or safe.replace(".md", "")

    if status != "completed":
        return f"ERROR: Plan '{plan_name}' has status={status}. Set status: completed first."

    if _has_pending_steps(text):
        return f"ERROR: Plan '{plan_name}' has ⏳ pending steps. Mark all step rows ✅ Done before completing."

    # Update parent plan's Deliverables table if parent_plan + parent_deliverable set
    parent_msg = _update_parent_deliverable(text, safe)

    completed_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Inject completed_date into the plan frontmatter before archiving
    if "completed_date:" not in text:
        text = text.replace("status: completed", f"status: completed\ncompleted_date: {completed_date}", 1)
        _write_file(f"plans/{safe}", text)

    _move_file(f"plans/{safe}", f"plans/completed/{safe}")

    doc_slug = safe
    doc_content = f"""---
title: {title}
status: completed
completed_date: {completed_date}
author: {_extract_frontmatter_field(text, 'author') or 'NetYeti'}
created: {_extract_frontmatter_field(text, 'created') or completed_date}
tags: {_extract_frontmatter_field(text, 'tags') or ''}
---

## Summary

*Plan completed: {title}*

## Completion

- Completed: {completed_date}
- Source plan: plans/completed/{safe}
"""
    _write_file(f"docs/{doc_slug}", doc_content)

    _log_transition("COMPLETED", f"plan/{safe} → plans/completed/ + doc generated")
    msg = f"✅ Plan '{safe}' completed and moved to plans/completed/. Doc generated at docs/{doc_slug}."
    if parent_msg:
        msg += f"\n{parent_msg}"
    return msg


@mcp.tool()
async def update_step(plan_name: str, step_match: str, new_status: str) -> str:
    """
    Update a single step row in a plan's Implementation Steps table.
    step_match: substring that uniquely identifies the row.
    new_status: 'done' or 'pending' (also accepts ✅/⏳ forms).
    Updates total_steps / completed_steps counts automatically.
    """
    safe = _safe_plan_name(plan_name)
    try:
        text = _read_file(f"plans/{safe}")
    except FileNotFoundError:
        return f"ERROR: Plan '{plan_name}' not found in plans/."

    normalized = _STEP_STATUS_MAP.get(new_status.lower().strip())
    if not normalized:
        return f"ERROR: Unknown status '{new_status}'. Use: done, pending (or ✅ Done, ⏳ Pending)."

    new_text, found = _replace_step_status(text, step_match, normalized)
    if not found:
        return f"ERROR: No step row matching '{step_match}' found in '{safe}'."

    new_text = _update_step_counts(new_text)
    # Reset tests_defined when a step changes — tests must be re-run to re-certify.
    new_text = _set_frontmatter_field(new_text, "tests_defined", "false")
    _write_file(f"plans/{safe}", new_text)
    _log_transition("STEP_UPDATE", f"plan/{safe}: '{step_match[:50]}' → {normalized}")
    return f"✅ Step updated in '{safe}': '{step_match[:50]}' → {normalized}."


@mcp.tool()
async def update_plan_status(plan_name: str, new_status: str) -> str:
    """
    Update a plan's status field with full lifecycle validation.
    Blocks status:completed if any ⏳ pending steps remain.
    Updates total_steps / completed_steps counts automatically.
    To archive a completed plan use transition_to_completed() afterward.
    """
    safe = _safe_plan_name(plan_name)
    if new_status not in _VALID_PLAN_STATUSES:
        return f"ERROR: Invalid status '{new_status}'. Valid: {', '.join(sorted(_VALID_PLAN_STATUSES))}."

    try:
        text = _read_file(f"plans/{safe}")
    except FileNotFoundError:
        return f"ERROR: Plan '{plan_name}' not found in plans/."

    current = _extract_frontmatter_field(text, "status")

    if new_status == "completed" and _has_pending_steps(text):
        return f"ERROR: Plan '{plan_name}' has ⏳ pending steps. Mark all step rows ✅ Done before completing."

    if new_status == "completed":
        gate_err = _check_completion_gate(text, plan_name)
        if gate_err:
            return gate_err

    text = _set_frontmatter_field(text, "status", new_status)
    text = _update_step_counts(text)
    _write_file(f"plans/{safe}", text)
    _log_transition("STATUS_CHANGE", f"plan/{safe}: {current} → {new_status}")
    return f"✅ Plan '{safe}' status: {current} → {new_status}."


@mcp.tool()
async def append_history(plan_name: str, change: str) -> str:
    """
    Append a row to the plan's Document History table.
    Auto-fills today's date and resolves the human identity from .env / git config.
    Creates the table if it doesn't exist.
    """
    safe = _safe_plan_name(plan_name)
    try:
        text = _read_file(f"plans/{safe}")
    except FileNotFoundError:
        return f"ERROR: Plan '{plan_name}' not found in plans/."

    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    author = _get_human_identity()
    new_text = _append_history_row(text, change, author, date)
    _write_file(f"plans/{safe}", new_text)
    _log_transition("HISTORY_APPEND", f"plan/{safe}: {change[:60]}")
    return f"✅ History entry added to '{safe}': {date} | {change} | {author}."


@mcp.tool()
async def set_plan_field(plan_name: str, field: str, value: str) -> str:
    """
    Set a single frontmatter field on a plan file.
    Restricted fields (status, gate_status, total_steps, completed_steps) are blocked —
    use their dedicated tools or perform the action as a human.
    """
    if field in _RESTRICTED_PLAN_FIELDS:
        return f"ERROR: Field '{field}' is restricted. {_RESTRICTED_PLAN_FIELDS[field]}"

    safe = _safe_plan_name(plan_name)
    try:
        text = _read_file(f"plans/{safe}")
    except FileNotFoundError:
        return f"ERROR: Plan '{plan_name}' not found in plans/."

    text = _ensure_frontmatter_field(text, field, value)
    _write_file(f"plans/{safe}", text)
    _log_transition("FIELD_SET", f"plan/{safe}: {field} = {value}")
    return f"✅ Field '{field}' set to '{value}' in '{safe}'."


@mcp.tool()
async def write_plan(plan_name: str, content: str) -> str:
    """
    Full content replacement for a plan file.
    Use only for structural rewrites — all other mutations should use
    update_step, update_plan_status, append_history, or set_plan_field.

    Applies the same lifecycle validation as update_plan_status:
    - status: completed is blocked if any pending steps remain
    - gate_status: approved/waived cannot be set via this tool (human-only)
    Recounts and updates total_steps / completed_steps automatically.
    """
    safe = _safe_plan_name(plan_name)
    if not _extract_frontmatter_field(content, "title"):
        return "ERROR: Content is missing required 'title' frontmatter field."

    new_status = _extract_frontmatter_field(content, "status")
    if new_status == "completed" and _has_pending_steps(content):
        return (
            f"ERROR: Content sets status: completed but plan has ⏳ pending steps. "
            "Clear all pending steps first, then resubmit with all steps ✅ Done, "
            "or use update_plan_status() which enforces this check explicitly."
        )

    if new_status == "completed":
        gate_err = _check_completion_gate(content, safe)
        if gate_err:
            return gate_err

    gate = _extract_frontmatter_field(content, "gate_status")
    if gate in ("approved", "waived"):
        return (
            f"ERROR: write_plan cannot set gate_status: {gate}. "
            "Gate sign-off requires human authorization."
        )

    content = _update_step_counts(content)
    # Auto-detect tests_defined from content — mutations may add or remove tests
    has_tests = _has_testing_plan(content)
    content = _set_frontmatter_field(content, "tests_defined", "true" if has_tests else "false")
    _write_file(f"plans/{safe}", content)
    _log_transition("PLAN_REWRITE", f"plan/{safe}: structural rewrite")
    return f"✅ Plan '{safe}' rewritten. Step counts updated in frontmatter."


@mcp.tool()
async def transition_to_canceled(plan_name: str, cancellation_reason: str) -> str:
    """
    Cancel a plan with a reason. Moves to plans/completed/ with canceled status.
    Validates: cancellation_reason must be non-empty.
    """
    if not cancellation_reason.strip():
        return "ERROR: cancellation_reason is required."

    safe = Path(plan_name if plan_name.endswith(".md") else plan_name + ".md").name

    try:
        text = _read_file(f"plans/{safe}")
    except FileNotFoundError:
        return f"ERROR: Plan '{plan_name}' not found in plans/."

    canceled_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    text = _set_frontmatter_field(text, "status", "canceled")

    if "canceled_date:" not in text.split("---")[1]:
        text = re.sub(
            r"^(status:.*)$",
            rf"\1\ncanceled_date: {canceled_date}\ncancellation_reason: \"{cancellation_reason}\"",
            text,
            count=1,
            flags=re.MULTILINE,
        )

    _write_file(f"plans/{safe}", text)
    _move_file(f"plans/{safe}", f"plans/completed/{safe}")

    _log_transition("CANCELED", f"plan/{safe} → plans/completed/ (reason: {cancellation_reason})")
    return f"✅ Plan '{safe}' canceled and moved to plans/completed/."


@mcp.tool()
async def audit_log(limit: int = 50) -> str:
    """Read recent lifecycle transitions from .docwright/audit.jsonl (append-only NDJSON).
    Returns the last `limit` entries (default 50) formatted as a table."""
    import json as _json
    if not AUDIT_LOG.exists():
        return "No audit log entries yet."
    lines = [l for l in AUDIT_LOG.read_text().splitlines() if l.strip()]
    entries = []
    for l in lines[-limit:]:
        try:
            entries.append(_json.loads(l))
        except ValueError:
            pass
    if not entries:
        return "No audit log entries yet."
    rows = "\n".join(
        f"| {e.get('ts','')[:19]} | {e.get('event','')} | {e.get('detail','') or e.get('file','')} |"
        for e in entries
    )
    return f"| Timestamp | Event | Detail |\n|-----------|-------|--------|\n{rows}"


# ── Test mode ─────────────────────────────────────────────────────────────────


async def _run_tests():
    cases = [
        ("get_session_context", get_session_context, {}),
        ("get_status", get_status, {}),
        ("list_active_plans", list_active_plans, {}),
        ("get_facts", get_facts, {}),
        ("run_dry_run", run_dry_run, {}),
        ("get_plan", get_plan, {"name": "collation"}),
        ("transition_to_approved (dry — missing approved)", transition_to_approved, {"proposal_name": "_nonexistent_"}),
        ("transition_to_completed (dry — not completed)", transition_to_completed, {"plan_name": "collation"}),
        ("transition_to_canceled (dry — missing reason)", transition_to_canceled, {"plan_name": "collation", "cancellation_reason": ""}),
        ("audit_log", audit_log, {}),
    ]
    passed = failed = 0
    for name, fn, kwargs in cases:
        label = f"{name}({', '.join(f'{k}={v!r}' for k, v in kwargs.items())})"
        print(f"\n{'─' * 64}")
        print(f"  {label}")
        print('─' * 64)
        try:
            result = await fn(**kwargs)
            preview = result[:400] + ("…" if len(result) > 400 else "")
            print(preview)
            print(f"\n  [{len(result)} chars]  ✓")
            passed += 1
        except Exception as e:
            print(f"  ERROR: {e}  ✗")
            failed += 1
    print(f"\n{'=' * 64}")
    print(f"  Results: {passed} passed, {failed} failed")
    print('=' * 64)


if __name__ == "__main__":
    # Sync Ollama model to opencode.json at startup
    try:
        subprocess.run(["node", str(REPO_ROOT / "scripts/sync-ollama-model.js")], 
                      capture_output=True, text=True)
    except Exception as e:
        print(f"[dw-mcp] Ollama sync failed: {e}", file=sys.stderr)

    if "--test" in sys.argv:
        asyncio.run(_run_tests())
    elif "--serve" in sys.argv:
        port = int(os.environ.get("MCP_PORT", "3002"))
        host = os.environ.get("MCP_HOST", "127.0.0.1")
        mcp.settings.host = host
        mcp.settings.port = port
        print(f"[dw-mcp] Starting SSE on {host}:{port}/sse", file=sys.stderr)
        mcp.run(transport="sse")
    else:
        mcp.run()
