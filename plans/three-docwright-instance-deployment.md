---
title: DocWright dev-cloud instances — dogfood, csdocs, cs-erp-images, msp-pilot
status: draft
author: NetYeti
created: 2026-07-11
tags:
  - deployment
  - docker
  - release-channel
  - dogfooding
  - cascade-steam
  - plugins
  - msp-pilot
  - bms
proposal_source: proposals/approved/three-docwright-instance-deployment.md
priority: 2
automated: guided
assigned_to: NetYeti
tests_defined: false
tests_human_reviewed: false
_path: plans/three-docwright-instance-deployment.md
---

# DocWright dev-cloud instances — dogfood, csdocs, cs-erp-images, msp-pilot

## Overview

Delivers the approved proposal [[proposals/approved/three-docwright-instance-deployment.md]] — see it for the full *what & why*.
Held at `status: draft`; fill in the implementation steps below before moving to `in-progress`.



## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Clone DocWright repository | Clone the docwright repo and checkout the `dogfood` branch for development work | ⏳ Pending |
| 2 | Configure dogfood-dev environment | Set up `.env` configuration with dogfood-dev specific settings and local development parameters | ⏳ Pending |
| 3 | Enable dev-mode flag | Set `DEV_MODE=true` in environment to enable hot-reload and development tooling | ⏳ Pending |
| 4 | Install dependencies | Run package manager install to pull all required Node/Python dependencies from source | ⏳ Pending |
| 5 | Initialize database schema | Run migrations to create the dogfood-dev database schema from the dogfood branch | ⏳ Pending |
| 6 | Start dev-mode server | Launch the application server with watch mode to verify self-hosted development cycle works | ⏳ Pending |
| 7 | Validate dogfood-dev health | Confirm the instance boots cleanly, serves the UI, and accepts authentication in dev-mode | ⏳ Pending |
| 8 | Fetch latest tagged release | Identify and pull the latest stable tagged release from the DocWright registry or Git tags | ⏳ Pending |
| 9 | Create csdocs environment | Provision the csdocs instance with production-like configuration for Cascade STEAM early access | ⏳ Pending |
| 10 | Deploy csdocs instance | Install and start the csdocs instance using the latest tagged release binary or container image | ⏳ Pending |
| 11 | Configure user access | Set up authentication and grant access credentials for Cascade STEAM early access and leadership accounts | ⏳ Pending |
| 12 | Verify csdocs deployment | Confirm the csdocs instance is accessible, renders documentation correctly, and serves all expected routes | ⏳ Pending |
| 13 | Clone cs-erp-images plugin | Fetch the `cs-erp-images` plugin repository for integration with the Frappe/ERPNext image pipeline | ⏳ Pending |
| 14 | Align erp-images release | Ensure erp-images instance uses the exact same tagged release version as the csdocs deployment | ⏳ Pending |
| 15 | Install cs-erp-images plugin | Register and install the cs-erp-images plugin into the erp-images DocWright instance | ⏳ Pending |
| 16 | Configure image pipeline | Set up Frappe/ERPNext API credentials and image processing configuration in the erp-images instance | ⏳ Pending |
| 17 | Validate erp-images pipeline | Test end-to-end image ingestion from Frappe/ERPNext through the cs-erp-images plugin pipeline | ⏳ Pending |
| 18 | Provision msp-pilot instance | Deploy the msp-pilot instance using the latest tagged release for Bellingham Makerspace validation | ⏳ Pending |
| 19 | Configure makerspace settings | Set Bellingham Makerspace-specific infrastructure parameters, site URLs, and organizational metadata | ⏳ Pending |
| 20 | Enable pilot features | Activate pilot validation feature flags and configure monitoring/logging for infrastructure assessment | ⏳ Pending |
| 21 | Validate msp-pilot deployment | Confirm the msp-pilot instance is operational and all makerspace infrastructure integrations respond correctly | ⏳ Pending |
| 22 | Document instance endpoints | Record all four instance URLs, ports, and access credentials in a central reference for the team | ⏳ Pending |
| 23 | Cross-validate all instances | Run health checks across dogfood-dev, csdocs, erp-images, and msp-pilot to confirm parity and stability | ⏳ Pending |

## Testing Plan

### Step Verification

- [ ] dogfood-dev: running on `dogfood` branch, dev-mode enabled, self-hosted commits trigger rebuild without restart
- [ ] csdocs: latest tagged release (`git describe --tags --abbrev=0` matches deployed version), content loads at csdocs hostname
- [ ] erp-images: cs-erp-images plugin listed in site config (`bench --site all list-apps`), image pipeline endpoints respond 200
- [ ] msp-pilot: latest tagged release deployed, Bellingham Makerspace team confirms login and document creation

### Integration & Regression

- [ ] `npm test` passes across all four instance deployment definitions
- [ ] `npm run typecheck` clean with zero errors
- [ ] NPMPlus proxy routes each hostname to correct upstream instance with no cross-talk
- [ ] Existing docwright functionality (create, edit, version) unaffected on any instance
- [ ] Vault permissions enforce isolation—no cross-instance secret or config leakage

### Gate Criteria

- [ ] All four instances reachable at their designated hostnames with valid TLS
- [ ] Each instance returns correct version tag in `/_version` or equivalent endpoint
- [ ] Deployment definitions committed to git and reproducible via single `docker compose up` (or equivalent) per instance
- [ ] At least one non-owner user has authenticated and performed a write operation on csdocs and msp-pilot
- [ ] Rollback verified: each instance restores to prior release version without data loss

## Rollback Procedures

## Rollback Procedures

| Scenario | Rollback |
|----------|----------|
| dogfood-dev fails to start or exhibits critical bugs in dev-mode | Stop the running instance and revert to the previous known-good commit on the dogfood branch; redeploy from source at that commit. |
| csdocs instance deployment fails or introduces regressions | Roll back to the previously tagged release by redeploying the prior image tag; restore the database backup taken before migration. |
| erp-images instance fails after plugin install or release upgrade | Revert to the previous release tag shared with csdocs; uninstall or disable the cs-erp-images plugin; restore from pre-upgrade backup. |
| msp-pilot instance fails validation or has stability issues | Roll back to the prior tagged release; revert any configuration changes made for the pilot; restore the database snapshot from before the upgrade. |

## Risk Assessment

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| dogfood-dev instance breaks production data due to dev-mode misconfiguration | Medium | High | Isolated vault and network segment; dev-mode flag enforced in deployment definition; no access to prod vault credentials |
| csdocs release drifts from erp-images shared version, causing plugin incompatibility | Low | Medium | Both instances pinned to same tagged release; update policy requires coordinated version bump in deployment definitions |
| NPMPlus proxy single point of failure blocks all four instances | Medium | High | Deploy proxy with health checks and auto-restart; document manual bypass procedure for emergency access |
| msp-pilot pilot validates flawed assumptions due to insufficient real-world load | Medium | Medium | Define explicit pilot success criteria before launch; run load testing against instance before connecting Makerspace infra |
| Git-managed deployment definitions leaked or unauthorized changes merged | Low | High | Enforce branch protection and signed commits on deployment repo; restrict write access to designated operators |
| Cascade STEAM early access users encounter data loss from pre-release bugs | Medium | Medium | Enable automated vault backups on csdocs; clearly communicate early-access status and backup SLA to users |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-11 | Created from approved proposal | NetYeti |
