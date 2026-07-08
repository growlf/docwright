---
title: .bms.local deployment hostnames unresolvable from standard clients — .local is mDNS-reserved
status: new
created: 2026-07-07
author: NetYeti@phoenix
author-role: user
category: bug
priority: medium
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-07]
channel: dev
github_issue: https://github.com/growlf/docwright/issues/259
tags:
  - reported-bug
---

# .bms.local deployment hostnames unresolvable from standard clients — .local is mDNS-reserved

## Description

The four BMS dev-cloud instance hostnames (docwright-dev.bms.local, csdocs.bms.local, erp-images.bms.local, msp.bms.local — see proposals/three-docwright-instance-deployment.md, BMS-0091) sit under `.local`, which RFC 6762 reserves for mDNS. systemd-resolved (default on modern Linux) and macOS refuse to send `*.local` queries to unicast DNS, so out of the box these names fail with "No appropriate name servers or networks for name found" even though Technitium (10.10.0.4) serves correct CNAMEs → swarm.bellinghammakerspace.org and the backends are healthy.

Observed 2026-07-06 on-site at BMS from phoenix (wired link, DHCP DNS 10.10.0.4): all four names NXDOMAIN-equivalent locally; `dig @10.10.0.4` resolves fine; direct 10.10.0.201:5173 answers. Any Linux/macOS visitor at BMS will hit the same wall.

Workaround (per-client, non-persistent): `sudo resolvectl domain <link> ... '~bms.local'` — routing domain overrides the .local special-casing; verified HTTP 200 on all four /status pages afterward. Lost on reconnect/reboot.

Proper fix: rename the zone off `.local` — e.g. `.bms.internal` (ICANN-reserved for private use) or a real subdomain like `*.bms.bellinghammakerspace.org` (also enables Let's Encrypt DNS-01 certs). Update Technitium records + NPMPlus proxy hosts via the existing idempotent playbook `bms-ai-cluster:ansible/playbooks/configure-docwright-dev-cloud.yml`, plus DOCWRIGHT_ALLOWED_HOSTS env on the instances and the hostname table in proposals/three-docwright-instance-deployment.md. Alternatively (weaker), push a resolved drop-in to managed clients — but that doesn't help unmanaged/guest devices.

## System Info

phoenix, Linux 6.17.0-35-generic, systemd-resolved, wired enx50a03009fd45 via BMS DHCP (DNS 10.10.0.4)
