---
title: "SOP: Asset Discovery & Inventory"
category: operations
created: "2026-06-22"
author: "docwright-agent"
tags: [discovery, inventory, asset, hardware, network]
reviewed_by:
status: draft
template_version: "1.0"
---

# SOP: Asset Discovery & Inventory

## Purpose

Define the layered validation framework for discovering, cross-referencing,
and maintaining hardware and network asset inventory. Every fact must be
corroborated by at least two independent sources before it enters the
inventory. The method trace of every discovery run is preserved as
provenance.

## Scope

Any device, BMC, network interface, or service that exists within a managed
environment (BMS Makerspace, Cascade STEAM, YetiCraft, or future
environments). This SOP governs:

- Hardware identity (manufacturer, model, serial, UUID)
- BMC/iDRAC/iLO discovery and host association
- Network topology (MAC↔IP, switch port connections)
- Component inventory (CPU, RAM, storage, PCI devices)
- Relationship mapping (parent, manages, peers, member_of, provides)
- Drift detection between discovered state and recorded state

## Rules (MANDATORY)

1. **Single unified tool** — One Ansible playbook (`gather-device-inventory`)
   performs ALL discovery: system facts, hardware audit, BMC interrogation,
   and network cross-reference. No parallel tools that can diverge.

2. **Layered validation** — Every fact must come from at least two
   independent sources before it is trusted:
   - **Layer 1** — Router ARP/DHCP (network ground truth via MikroMCP)
   - **Layer 2** — Ansible system facts (OS, CPU, RAM, product name)
   - **Layer 3** — SSH dmidecode (manufacturer, model, serial, UUID)
   - **Layer 4** — SSH ipmitool (BMC MAC, IP, FRU, firmware)
   - **Layer 5** — SSH component scan (lshw, lsblk, lspci, ip link)

3. **Corroboration is mandatory** — Single-source facts are hypotheses.
   Cross-ref BMC MAC (ipmitool layer 4) against router ARP (layer 1). If
   they match, the BMC→parent relationship is confirmed. Log each
   corroboration explicitly.

4. **Provenance is preserved** — Every discovery run produces a `_provenance`
   block recording: which host was scanned, which commands ran, which
   timestamps, and which corroborations passed/failed.

5. **Drift is detected, not silently fixed** — When discovered values differ
   from the recorded inventory, the difference is surfaced as a drift alert
   in both a `DRIFT-LOG.md` file and the DocWright Web UI notification
   panel. No value is overwritten without acknowledgement.

6. **Negative evidence is captured** — Expected-but-absent data
   (e.g. "no ipmitool", "port unreachable", "dmidecode empty") is recorded.
   Absence of evidence is itself evidence.

7. **SSH config is the connectivity source of truth** — All SSH access flows
   through `~/.ssh/config` host aliases. The Ansible inventory references
   these same hosts. Both DocWright and bms-ai-cluster maintain this as the
   single source of truth for reachability.

## Procedures

### A. Run Full Discovery Cycle

1. **Verify environment access** — Confirm VPN to target network is active.
   Check `traceroute -n <gateway>` to validate routing.

2. **Dump router ARP table** — Use MikroMCP `list_dhcp_leases` +
   `list_address_list_entries` to capture every known MAC↔IP mapping.
   Save to a staging file for cross-reference.

3. **Run unified discovery playbook**:
   ```bash
   cd /home/netyeti/Projects/bms-ai-cluster
   ansible-playbook ansible/playbooks/gather-device-inventory.yml \
     -i ansible/inventory/hosts.yml \
     --limit proxmox_nodes
   ```

4. **Run sync script (diff mode)**:
   ```bash
   python3 scripts/sync-device-from-discovery.py --env bms --mode diff
   ```
   Review the output. Every drift alert should be investigated.

5. **Run sync script (update mode)** — Only after diff review:
   ```bash
   python3 scripts/sync-device-from-discovery.py --env bms --mode update
   ```

6. **Regenerate views** — The sync script calls
   `sync-device-inventory.py update` automatically. Verify the generated
   `.md` files and `index.base`.

### B. Resolve Orphan BMC

An orphan BMC is a discovered management controller (iDRAC/iLO) not
associated with any known parent server.

1. Note the BMC MAC address from the orphan device YAML or ipmitool output.
2. Query the router ARP table for that MAC → identifies which switch port
   and subnet it lives on.
3. Run `ipmitool lan print` on each hypervisor in that subnet. The hypervisor
   whose ipmitool reports a matching BMC MAC *is* the parent.
4. Add `parent: <hostname>` to the BMC device YAML and `manages: <bmc-name>`
   to the server device YAML.

### C. Handle Drift

When `sync-device-from-discovery.py` reports a drift:

1. The drift is written to `DRIFT-LOG.md` in the inventory root with:
   - Field name, old value, new value
   - Which host, which scan timestamp
   - Whether the corroborating source agrees
2. A notification is published to the DocWright Web UI notification panel.
3. If the drift is confirmed valid (new hardware, reconfiguration), run
   update mode to accept it.
4. If the drift is a false positive (scan error, transient), flag the scan
   result and preserve the existing value.

## Enforcement

- Pre-commit hook rejects device YAML updates without a `_provenance` block
  in the metadata or a matching drift log entry.
- The `docwright-discovery` skill enforces the layered validation sequence
  and will refuse to write un-corroborated facts.
- Drift without acknowledgement generates a warning at every subsequent scan
  until resolved.

## Examples

**Layer 4 corroboration (BMC→host match):**
```
Router ARP: MAC 78:2B:CB:61:5B:00 → 10.10.1.186
pve2 ipmitool: BMC MAC 84:7B:EB:D8:AB:06 → 10.10.5.2  (no match)
pve3 ipmitool: BMC MAC 78:2B:CB:61:5B:00 → 10.10.1.186 (MATCH!)
→ idrac-5YW6VR1's parent is pve3
```

**Drift alert:**
```
DRIFT: pve2 iDRAC IP changed
  Old: 10.10.1.6 (from 2026-05-19 manual entry)
  New: 10.10.5.2 (from 2026-06-22 hardware-audit via ipmitool)
  Corroboration: Router ARP shows 84:7B:EB:D8:AB:06 at 10.10.5.2 (CONFIRMED)
  Action: Pending review
```

## Related SOPs

- `order-of-work-lifecycle.md` — Proposal→plan→completed doc generation
- `plan-completion.md` — Plan close-out with visual verification
- `incident-response.md` — Hardware failure triggers re-discovery
- `one-off-formalization.md` — Live methodology capture on any ad-hoc scan

## Resync Rule

When this SOP changes, agent must update:
1. `.opencode/rules/` — Add auto-enforcement rule
2. `.opencode/skills/docwright-discovery/SKILL.md` — Match procedure
3. Related scripts — Ensure matches SOP

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-22 | Created | docwright-agent |
