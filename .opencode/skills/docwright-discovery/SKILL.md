---
name: docwright-discovery
description: Hardware and network asset discovery — runs unified Ansible playbook, cross-references router ARP, detects drift, syncs device YAMLs
distributable: false
---

# DocWright Discovery Skill

> **This skill enforces the layered validation framework defined in `docs/SOPs/asset-discovery.md`.**
> Every fact must be corroborated by at least two independent sources before it enters the inventory.

## Triggers

Use this skill when the task involves:
- `discover` — discover hardware or network inventory
- `scan` — run a discovery scan against a network or hosts
- `inventory` — update asset inventory, sync device records
- `asset audit` — audit known assets against live state
- `hardware audit` — run hardware discovery against servers
- `drift` — check for drift between recorded and live state

## Workflow

### 1. Verify Environment Access

```bash
# Check VPN connectivity to target network
traceroute -n <gateway>

# Verify SSH config host aliases resolve
ssh <hostname> hostname
```

### 2. Dump Router ARP / DHCP Tables

Use MikroMCP tools to capture network-layer ground truth:

```
list_dhcp_leases    → every known DHCP lease (MAC ↔ IP)
list_address_list   → static address entries
list_arp_entries    → current ARP table
```

Save output as YAML to a staging path for cross-reference.

### 3. Run Unified Discovery Playbook

```bash
cd /home/netyeti/Projects/bms-ai-cluster
ansible-playbook ansible/playbooks/gather-device-inventory.yml \
  -i ansible/inventory/hosts.yml \
  --limit proxmox_nodes
```

Output is cached to `ansible/inventory/host_vars/<host>/hardware-inventory.yml`

### 4. Sync Discovery to Device YAMLs (Diff Mode)

```bash
python3 scripts/sync-device-from-discovery.py --env bms --mode diff
```

Review the output. Every drift alert should be investigated before proceeding.

If ARP data was dumped, include it for MAC cross-reference:
```bash
python3 scripts/sync-device-from-discovery.py --env bms --mode diff \
  --arp-file /tmp/bms-arp-dump.yml
```

### 5. Review Drift Alerts

Drift alerts indicate a value changed since the last recorded scan:

- **Corroborated drift** — multiple discovery layers agree on the new value
  → likely a real change (hardware replaced, IP reconfigured)
- **Uncorroborated drift** — only one source reports a different value
  → likely a scan artifact, flag for re-scan

### 6. Sync Discovery to Device YAMLs (Update Mode)

Only after drift review:
```bash
python3 scripts/sync-device-from-discovery.py --env bms --mode update
```

This also triggers `sync-device-inventory.py` to regenerate .md views.

### 7. Verify Views

Check the generated `.md` files and `index.base` in `docs/reference/<env>-devices/`.

## Relationship Resolution

### Orphan BMC → Parent Server

When an iDRAC/iLO has no `parent` field:

1. Note the BMC MAC address
2. Dump router ARP table to find which subnet/locale the MAC lives on
3. Run discovery on all hypervisors in that subnet
4. Cross-reference: the hypervisor whose `ipmitool lan print` MAC matches
   the orphan BMC MAC is the parent
5. Set `parent: <hostname>` on BMC device, `manages: <bmc-name>` on server

### Peer Detection

When two devices share a broadcast domain (same router interface, adjacent ARP
entries), they are likely `peers`. Flag for manual confirmation.

## Provenance & Drift Log

Every sync run appends to `inventory/DRIFT-LOG.md` with:

| Host | Field | Old Value | New Value | Timestamp |
|------|-------|-----------|-----------|-----------|

## Analysis Guidelines

- **Drift severity:** A hardware identity drift (serial, manufacturer) is HIGH.
  An IP drift (BMC) is MEDIUM — could be reconfiguration or stale record.
- **Unreachable hosts:** If a previously reachable host fails ping/SSH during
  scan, it's logged as negative evidence but does not overwrite existing data.
- **Cross-reference confirms:** A fact corroborated by 2+ layers gets
  `maturity: L2`. A fact from a single source stays `maturity: L1`.
