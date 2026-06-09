import asyncio
import os
import sys
import json
import importlib.util
from pathlib import Path

# Fix: Dynamically import hyphenated script
scripts_dir = Path(__file__).parent.parent.parent / "scripts"
server_path = scripts_dir / "mcp-server.py"

spec = importlib.util.spec_from_file_location("mcp_server", str(server_path))
mod = importlib.util.module_from_spec(spec)
sys.modules["mcp_server"] = mod
spec.loader.exec_module(mod)

async def capture_baseline():
    tools = [
        ("get_status", {}),
        ("list_active_plans", {}),
        ("get_plan", {"name": "sample"}),
        ("get_facts", {}),
        ("collate", {}),
        ("run_dry_run", {}),
    ]
    
    baseline_dir = Path(__file__).parent / "fixtures" / "python-baseline"
    baseline_dir.mkdir(parents=True, exist_ok=True)
    
    for name, args in tools:
        print(f"Capturing {name}...")
        func = getattr(mod, name)
        if args:
            res = await func(**args)
        else:
            res = await func()
            
        (baseline_dir / f"{name}.txt").write_text(str(res))
        
    print("Baseline capture complete.")

if __name__ == "__main__":
    vault_root = Path(__file__).parent / "fixtures" / "sample-vault"
    os.environ["DOCWRIGHT_VAULT_ROOT"] = str(vault_root)
    # Mock REPO_ROOT in the module
    mod.REPO_ROOT = vault_root
    # Mock AUDIT_LOG to stay local to fixture
    mod.AUDIT_LOG = vault_root / ".docwright" / "audit.jsonl"
    
    asyncio.run(capture_baseline())
