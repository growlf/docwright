---
name: docwright-infra
description: Infrastructure placement and reliability standards
---

# DocWright Infrastructure Skill

## Placement Principles
- Services should run in isolated environments (LXCs/VMs/containers), NOT on hypervisors directly
- Static IPs preferred for infrastructure services
- Configuration management (Ansible, Terraform, etc.) required for repeatable deployments
- Must be documented before deployment

## Reliability (N+1 Strategy)
- Critical services run on 2+ nodes
- Health checks at regular intervals
- Auto-failover for: DNS, Monitoring, Authentication

## Deployment Best Practices
- Use a documented subnet scheme
- Maintain DNS records for all services
- Centralize monitoring and logging
- Document architecture as it evolves
