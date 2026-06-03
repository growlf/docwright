---
title: Containerization
author: NetYeti
created: 2026-06-03
tags: []
category: []
complexity: ""
estimated_effort: ""
depends_on: []
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
_path: proposals/containerization.md
---
## Problem

We will want to be able to easily deploy this tool to servers - current layout makes this more challenging than if it was containerized.  Also, if it were in containers, we could also support (more easily) multiple instances on a single server host for multiple standalone projects for the same organization.  Example, one instance for company policies, another for a specific product, and still another for the marketing group intentions, etc. Another example is for an author who is working on multiple unrelated books, each would have it's own instance.

## Proposed Solution