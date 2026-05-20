---
title: "SOP: Backup & Recovery"
category: operations
created: "2026-05-19"
author: "DocWright"
tags: [operations, backup, recovery, disaster]
reviewed_by: ""
status: approved
---

# SOP: Backup & Recovery

## Purpose
Establish backup and recovery procedures for all infrastructure components.

## Backup Schedule

### Daily (Automated)
| Component | What | Where | Retention |
|-----------|------|-------|-----------|
| System configs | Automated export | Backup server | 30 days |
| Secrets vault | `bw export` (encrypted JSON) | Backup server | 90 days |

### Weekly (Automated)
| Component | What | Where | Retention |
|-----------|------|-------|-----------|
| Git repo | `git bundle create` | Offsite (remote + local) | Indefinite |
| Documentation | Full directory copy | Backup server | 30 days |

### Monthly (Manual)
| Component | What | Where | Retention |
|-----------|------|-------|-----------|
| Full system configs | Complete configuration export | Offsite | 1 year |
| Test restore | Verify backups are recoverable | Lab/test environment | N/A |

## Backup Procedures

### Secrets Vault (VaultWarden/Bitwarden)
```bash
# Export encrypted JSON (requires master password)
bw login --apikey
bw unlock --raw <<< "$MASTER_PASSWORD" > /tmp/bw_session
export BW_SESSION=$(cat /tmp/bw_session)
bw export --format encrypted_json --password "$MASTER_PASSWORD" --output /path/to/backups/vault/backup-$(date +%Y-%m-%d).json
```

**Credentials:** Bitwarden API key + master password (store in a secure offline location)

### Git Repository
```bash
# Full backup (bundle includes all history)
cd /path/to/your/repo
git bundle create /path/to/backups/git/repo-$(date +%Y-%m-%d).bundle --all

# Verify bundle
git clone /path/to/backups/git/repo-*.bundle test-restore
```

**Offsite:** Remote git hosting (GitHub, GitLab, etc.)

## Recovery Procedures

### Secrets Vault
```bash
# Restore from encrypted JSON
bw login --apikey
bw unlock --raw <<< "$MASTER_PASSWORD" > /tmp/bw_session
export BW_SESSION=$(cat /tmp/bw_session)
bw import --format bitwardencsv /path/to/backups/vault/backup-*.json
```

**Note:** Import merges with existing items; duplicates may occur.

### Git Repository
```bash
# Clone from backup bundle
git clone /path/to/backups/git/repo-*.bundle restored-repo

# Or clone from remote
git clone git@github.com:user/repo.git
```

## Disaster Recovery (Full Rebuild)

### Scenario: Complete Infrastructure Loss
1. **Provision new hardware**
2. **Restore system configs** from backups
3. **Restore secrets vault** from encrypted export
4. **Clone git repo** from remote or backup bundle
5. **Verify:** Check all services, update documentation

### Recovery Time Objectives (RTO)
| Component | RTO |
|-----------|-----|
| System configs | Per-component (hours) |
| Git repo | 5 minutes (from remote) |
| Secrets vault | 2 hours (manual re-entry if backup fails) |

## Testing
- **Monthly:** Restore one component from backup, verify it works
- **Quarterly:** Test full restore in isolated environment
- **Annually:** Full disaster recovery drill (schedule downtime)

## Enforcement
- Verify daily backups run (check logs/cron)
- Alert on backup failure (monitoring)
- Test restores monthly
- Prune old backups to avoid disk full

## Agent Instructions

<agent-instructions mode="skill" triggers="backup,recovery,restore">

### Actions
- Daily: System configs, Git repo
- Weekly: Secrets vault export
- Monthly: Full system config backup
- Verify after each backup
- Test restore quarterly

</agent-instructions>
