# Rule: SSH via ~/.ssh/config Aliases Only

All SSH connections MUST use a `~/.ssh/config` host alias — never a raw IP address.

- Right: `ssh pve2`
- Wrong: `ssh 10.10.0.5`
- Right: `ssh -o ConnectTimeout=6 frank`
- Wrong: `ssh root@10.10.0.13`

**Why:** Direct IP SSH bypasses the canonical host definitions in `~/.ssh/config`,
leading to inconsistent user/key/port selection, unreachable-host confusion, and
device identity drift between config and ad-hoc usage.

## Exceptions

Temporary port-forwarding tunnels (`-L`, `-R`, `-D`) and first-time bootstrap
of a new host may use a raw IP, but MUST be explicitly justified per-invocation
in the command description.

## Enforcement

1. **Missing alias:** If a required SSH alias does not exist in `~/.ssh/config`,
   halt and report the gap rather than falling through to `user@ip`. Propose
   adding the alias to `~/.ssh/config` as a prerequisite step.

2. **Busted alias:** If the alias exists but authentication fails (wrong user,
   missing or incorrect key, permission denied), halt and report the failure.
   Diagnose the alias — does `ssh -v <alias>` reveal the root cause? Propose
   fixing the alias (user, key path, port) in `~/.ssh/config` as a
   prerequisite step. Do NOT fall through to `user@ip` — that bypasses the
   config entirely and silently papers over the config bug.

3. **No fallthrough.** Neither case permits falling back to a raw IP. Halting
   is correct — it surfaces the config gap so it gets fixed properly.
