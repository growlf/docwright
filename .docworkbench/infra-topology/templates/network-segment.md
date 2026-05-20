---
title: "${1:Segment name}"
type: network-segment
status: planned
hostname: "${2:gateway-hostname}"
ip: "${3:0.0.0.0/24}"
depends-on:
  - "${4:[[device.router-main]]}"
location: "${5:}"
tags: [${6:tags}]
---

# ${1:Segment name}

## Purpose
${7:What is this network segment for?}

## Subnet Details
- **CIDR:** ${3:0.0.0.0/24}
- **Gateway:** ${8}
- **DNS:** ${9}
- **DHCP Range:** ${10}

## Connected Devices
${11:Devices attached to this segment}

## Access Rules
${12:Firewall rules, VLAN ACLs, routing policies}

## Notes
${13:Any additional information}
