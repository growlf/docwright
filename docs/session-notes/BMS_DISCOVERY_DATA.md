# BMS Asset Discovery — Hardware Audit Data (session 2026-06-22)
# First thing: recover router access, then resume scan.

## Router (BMS MikroTik) — ACCESS LOST
- IP: 10.10.0.1 (port 22/80/8291 all live)
- Identity: MikroTik RouterOS (webfig on port 80)
- Bitwarden entry: "BMS Router" — admin / luke-i-am-your-father
- SSH status: Password REJECTED — stale/corrupted in BW
- Winbox (8291) and webfig (80) — UNTESTED
- MAC-telnet: Cannot test from phoenix — not on same L2 segment
- **ACTION: Try from BMS (same L2) — Winbox/webfig first, then MAC-telnet, then Netinstall**
- BW has `7.18.1.backup` attachment (encrypted, same password)

## Discovered Hardware (via SSH aliases — all fixed)
| Host    | Model                | Serial      | BMC IP     | BMC MAC             |
|---------|----------------------|-------------|------------|---------------------|
| pve1    | HP DL360p Gen8       | USE311YAFS  | 10.10.5.1  | 6c:3b:e5:b1:0d:08  |
| pve2    | Dell R630            | 40HKPD2     | 10.10.5.2  | 84:7b:eb:d8:ab:06  |
| crash   | HP DL360 Gen9        | MXQ6250274  | 10.10.5.3  | 1c:98:ec:23:b8:18  |
| frank   | Custom (i7-6700K)    | n/a         | n/a        | n/a                 |
| pve3    | Unknown (10.10.0.6)  | ?           | ?          | ? → NO ROUTE        |

## Drift Found
- **pve2 iDRAC IP**: device YAML says 10.10.1.6, live reports 10.10.5.2 — needs sync-script run

## Orphan iDRACs (BMC MAC not matched to any scanned host)
1. idrac-5YW6VR1 — 78:2B:CB:61:5B:00 at 10.10.1.186
2. columbiarac    — D0:94:66:48:9F:6C (probably pve3's BMC)
3. foundrylab2-bmc — unknown MAC
4. unknown-1071-bmc — unknown MAC

## SSH Config Changes (made this session)
- Added `Host frank` (10.10.0.13, User root)
- Added `Host crash` (10.10.0.8, User root)
- Fixed `Host router.bms` (added User admin)

## New Rules Created
- `.opencode/rules/ssh-config-only.md` — all SSH via ~/.ssh/config aliases
- `.opencode/rules/password-manager-first.md` — update BW before continuing after creds change
- Both listed in AGENTS.md Available Rules + Invariants

## New Files Created (DocWright)
- `docs/SOPs/asset-discovery.md` — layered validation SOP
- `.opencode/skills/docwright-discovery/SKILL.md` — discovery skill
- `src/profiles/asset-management/` — profile + schema + device template
- `src/webui/src/lib/notifications.ts` — notification store with drift type
- `src/webui/src/routes/+layout.svelte` — notification area (modified)
- `.opencode/rules/one-off-formalization.md` — added live methodology capture

## New Files Created (bms-ai-cluster)
- `ansible/playbooks/gather-device-inventory.yml` — unified discovery playbook
- `scripts/sync-device-from-discovery.py` — sync + drift detection + ARP cross-ref
- Awaits: router ARP dump to run sync script for real

## Next Session — First Actions
```bash
# If at BMS (same L2):
# 1. Check router reachability
ping 10.10.0.1
# 2. Try Winbox/webfig with BW password
# 3. If password works, update BW immediately
# 4. Dump ARP table
ssh router.bms "/ip arp print without-paging"
# 5. Run scan
cd ~/Projects/bms-ai-cluster
ansible-playbook ansible/playbooks/gather-device-inventory.yml -l proxmox_nodes
# 6. Sync + drift check
python3 scripts/sync-device-from-discovery.py
# 7. Resolve orphan iDRACs
```
