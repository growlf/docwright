---
complexity: high
title: "Kubernetes / Helm Deployment"
author: NetYeti
created: 2026-06-04
approved: false
tags:
  - infrastructure
  - kubernetes
  - enterprise
  - improvements
deferred: true
deferred_reason: "Docker compose covers all Phase 2 needs. Kubernetes adds significant complexity only justified by enterprise scale. Post-launch."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/approved/containerization.md
milestone: backlog
---

## Problem

Large enterprise deployments may need Kubernetes for: automated scaling,
rolling updates, health-based restarts, namespace isolation per org unit,
and integration with existing k8s infrastructure.

## Proposed Solution

A Helm chart for DocWright that packages:
- Deployment with configurable replica count
- PersistentVolumeClaim for the vault
- ConfigMap for non-secret configuration
- Secret for API keys and passwords
- Service + Ingress with TLS
- Optional OpenCode sidecar deployment

## Deferred Because

Docker compose satisfies all Phase 2 deployment needs. Kubernetes adds
operational complexity that is only justified at enterprise scale.
See [[proposals/approved/containerization.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — deferred from containerization proposal | NetYeti |
