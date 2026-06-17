---
name: docwright-tools
description: Security audit and hardening tools reference — lynis, rkhunter, fail2ban, firewalld, OpenSCAP, auditd
distributable: false
---

# DocWright Tools Skill

> **All scans below are read-only.** No system changes, no installations, no modifications. The commands only inspect and report. If a finding needs remediation, it will be presented for your review and approval before any change is made.

Load this skill before running or recommending any security audit tool.

## Tool Run Commands

### lynis — System Hardening Audit
```bash
sudo lynis audit system --quick 2>/dev/null | tail -30
```
Look for `Hardening index` line. Index < 70 indicates room for improvement.

### rkhunter — Rootkit Detection
```bash
sudo rkhunter --check --skip-keypress --quiet 2>/dev/null
```
Check `/var/log/rkhunter.log` for `Warning` lines.

### fail2ban — SSH/Service Protection
```bash
# Check active jails and banned IPs
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

### firewalld — Firewall Status
```bash
# Check zones and rules
sudo firewall-cmd --get-active-zones
sudo firewall-cmd --list-all
```

### OpenSCAP — Compliance Scanning
```bash
# Scan against CIS benchmark
sudo oscap xccdf eval --profile xccdf_org.ssgproject.content_profile_cis_server_l1 \
  --results /tmp/oscap-results.xml /usr/share/xml/scap/ssg/content/ssg-*-ds.xml
```

### auditd — System Event Auditing
```bash
# Check audit status and rules
sudo auditctl -s
sudo auditctl -l
# Search audit logs for specific events
sudo ausearch --start recent --success no --interpret | tail -20
```

## Analysis Guidelines

### lynis Output
- **Hardening Index:** Track over time (goal: 80+)
- **Suggestions:** Review `suggestions` section, prioritize `HIGH` and `MEDIUM`
- **Warnings:** Address within next maintenance window
- **Follow-up:** Re-run after changes to measure improvement

### rkhunter Output
- **Known issues:** Compare warnings against `rkhunter --propupd` database
- **False positives:** Document known good files in `/etc/rkhunter.conf.local`
- **Alert response:** Quarantine system, preserve evidence, investigate
