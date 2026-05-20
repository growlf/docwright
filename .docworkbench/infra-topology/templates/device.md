---
title: "${1:Device name}"
type: device
status: planned
hostname: "${2:hostname}"
ip: "${3:0.0.0.0}"
depends-on:
  - "${4:[[service.example-service]]}"
location: "${5:}"
tags: [${6:tags}]
---

# ${1:Device name}

## Purpose
${7:What does this device do?}

## Specifications
${8:Hardware specs, OS version, etc.}

## Network Connections
${9:Connected to which networks/segment?}

## Dependencies
${10:What services or devices does this depend on?}

## Notes
${11:Any additional information}
