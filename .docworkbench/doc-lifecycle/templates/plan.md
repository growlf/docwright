---
title: "${1:Plan title}"
status: plan
author: "${2:Your name}"
created: "${3:$(date +%Y-%m-%d)}"
tags: [${4:tags}]
proposal_source: "${5:proposals/approved/source-proposal.md}"
---

# ${1:Plan title}

## Overview
${6:Brief description of the plan}

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | ${7} | ${8} | ⏳ Pending |

## Testing Plan
${9:How will this be tested?}

## Rollback Procedures
${10:How to undo if something goes wrong}

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ${11} | ${12} | ${13} | ${14} |

## Phase Gate

- [ ] All implementation steps resolved (delivered or formally deferred with captured proposals)
- [ ] Test coverage defined and human-reviewed
- [ ] Deferred ideas captured as proposals before closing
- [ ] Rollback procedures documented
- [ ] Risk assessment completed

## Document History

| Date | Change | Author |
|------|--------|--------|
| ${3:$(date +%Y-%m-%d)} | Created | ${2:Your name} |
