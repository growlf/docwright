---
title: "Docker image lacks openssh-client — SSH remotes / deploy keys don't work despite entrypoint docs"
status: resolved
closed_by_pr: "#134"
author: NetYeti
author-role: contributor
created: 2026-07-05
category: bug
priority: medium
complexity: low
estimated_effort: S
tags:
  - docker
  - deployment
  - git
  - ssh
  - dogfooding
milestone: v0.6.0
created_by: "NetYeti@cluster-llm"
assigned_to: ""
---

> Found by dogfooding on 2026-07-05 setting up per-repo **deploy-key** git-push auth for the
> release-container dev-cloud instances (#2/#3/#4).

## Problem

`docker-entrypoint.sh` documents SSH-key auth ("For SSH key auth: mount your key at
`/root/.ssh/id_ed25519`"), and the vault repos use SSH remotes (`git@github.com:...`). But
the image (`Dockerfile`) installs only `git` and `wget` — **not `openssh-client`**. So in the
container:

```
$ ssh -T git@github.com
sh: 1: ssh: not found
$ git ls-remote origin      # SSH remote
<fails — no ssh transport>
```

Any SSH git operation (clone/fetch/push to an SSH remote, mounted deploy keys) is impossible.
Only the HTTPS `GIT_TOKEN` path currently works.

## Fix

Add `openssh-client` to the apt install in the `Dockerfile`. **Applied in this PR.**

## Acceptance

- `docker exec <c> ssh -T git@github.com` reaches GitHub (auth greeting) with a mounted key.
- A container with a mounted write deploy key can `git push` to its SSH remote.

## Notes

Blocks deploy-key git-push for instances 2–4 until a release carries this fix. Pairs with
the deploy-key mounts already wired in each deployment's `docker-compose.override.yml`.

## Resolution (2026-07-04)

Fixed by PR #134 (commit 7a0c625) — Dockerfile now installs `openssh-client`.
