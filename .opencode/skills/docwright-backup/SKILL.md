---
name: docwright-backup
description: Backup and recovery procedures for infrastructure and configuration
---

# DocWright Backup Skill

## Schedule

| Frequency | Task |
|-----------|------|
| Daily | System config exports, Git repo push |
| Weekly | Service/VM backups |
| Monthly | Secrets vault export |
| Quarterly | Test restore from backup |
| Annually | Full disaster recovery drill |

## Procedure
1. Verify each backup after creation
2. Check backup logs/cron output
3. Alert on backup failure
4. Prune old backups to avoid disk full
5. Document restore tests

## Storage Locations
- **Backup server:** Configurable per environment
- **Remote git:** GitHub, GitLab, or self-hosted
- **Offsite:** Cloud or secondary physical location

## Recovery
1. Identify the backup to restore from
2. Verify backup integrity before restore
3. Restore to test environment first when possible
4. Document the restore procedure and any issues
