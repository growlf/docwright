---
title: "${1:Service name}"
type: service
status: planned
hostname: "${2:hostname}"
ip: "${3:0.0.0.0}"
depends-on:
  - "${4:[[device.example-device]]}"
location: "${5:}"
tags: [${6:tags}]
---

# ${1:Service name}

## Purpose
${7:What does this service provide?}

## Configuration
${8:Key configuration details}

## Dependencies
${9:What devices or services does this depend on?}

## Endpoints
${10:API endpoints, ports, URLs}

## Notes
${11:Any additional information}
