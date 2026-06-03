---
complexity: low
title: "Remote Registry Sync"
author: NetYeti
created: 2026-06-03
tags:
  - project-registry
  - sync
  - remote
  - post-v1
  - improvements
approved: false
deferred: true
deferred_reason: "Post-v1. Local registry covers all pre-launch needs. Remote sync raises privacy and trust questions that need careful design."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/approved/project-registry.md
---

## Problem

The project registry (`~/.docwright/registry.json`) is local to each machine.
A contributor working across multiple machines, or a team sharing a common
set of vault references, must manually maintain registry entries on each
device. There is no way to synchronise known vaults across a team or
across a contributor's own devices.

## Proposed Solution

An optional remote registry sync mechanism:

- A registry can be backed by a remote source: a Forgejo/GitHub Gist, a
  shared URL, or a self-hosted endpoint
- Sync is explicit (pull/push commands) — never automatic, to avoid
  unexpected state changes
- Remote entries are read-only by default; a contributor can promote a
  remote entry to a local pinned entry
- Privacy-first: no vault contents are synced, only vault metadata
  (name, URL, profile type, last-accessed hint)
- Trust model: remote registries are signed or served over authenticated
  endpoints; unsigned remote registries prompt a warning before import

A simple first milestone is export/import (share a registry as a JSON file
or URL) without a live sync protocol — covers the multi-device use case
at low complexity.

## Deferred Because

Remote sync raises non-trivial questions about trust, privacy, and conflict
resolution that are out of scope for the initial release. Local registry
covers all pre-launch needs.
See [[proposals/approved/project-registry.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from project-registry proposal | NetYeti |
