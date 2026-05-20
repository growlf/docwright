---
title: "SOP: Incident Response"
category: operations
created: "2026-05-19"
author: "DocWright"
tags: [operations, incident, response, alerting]
reviewed_by: ""
status: approved
---

# SOP: Incident Response

## Purpose
Define the standard procedure for responding to network incidents, security breaches, and service outages.

## Incident Classification

### Severity Levels
| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P1 - Critical** | Complete service outage, security breach | 1 hour | Router down, hacked system, data breach |
| **P2 - High** | Partial outage, performance degradation | 4 hours | Service degraded, resource abuse |
| **P3 - Medium** | Minor issue, no immediate impact | 24 hours | Single service down, monitoring alert |
| **P4 - Low** | Cosmetic, future enhancement | 1 week | Documentation typo, feature request |

## Incident Response Procedure

### Step 1: Detection
**Who:** Automated (monitoring alerts) or Human (user report)
**Action:**
- Monitoring alert fires → Notification channel (email/Slack/Discord)
- Human discovers issue → Report to on-call contact
- Log incident in `docs/incident-log.md` (create if missing)

### Step 2: Triage (P1/P2 only)
**Who:** On-call admin or delegate
**Action:**
1. Verify the incident is real (not false positive)
2. Classify severity (P1-P4)
3. Notify stakeholders if P1/P2
4. Create incident plan in `plans/` with `tags: [incident, P1/P2]`

### Step 3: Investigation
**Who:** Assigned admin + Agent
**Action:**
1. Gather evidence:
   - System logs: `/var/log/syslog`, `/var/log/auth.log`
   - Application logs: service-specific log directories
   - Monitoring metrics
2. Identify root cause
3. Document findings in incident plan

### Step 4: Containment (P1/P2 only)
**Who:** Assigned admin
**Action:**
- **Security breach:** Isolate system (disable port, change firewall rules)
- **Resource abuse:** Rate-limit or block offending source
- **Compromised system:** Disconnect from network, preserve evidence

### Step 5: Remediation
**Who:** Agent (with human approval for changes)
**Action:**
1. Fix the issue per approved plan
2. Test the fix
3. Monitor for recurrence
4. Update documentation/SOPs to prevent future occurrences

### Step 6: Post-Incident Review
**Who:** Admin + Agent
**Action:**
1. Document what happened in `docs/incident-log.md`
2. Update relevant SOPs if process failed
3. Add monitoring/alerts to catch similar issues faster
4. Share lessons learned with team

## Common Incidents & Responses

### Resource Abuse
**Symptoms:** Service slow, monitoring alert for high usage
**Response:**
1. Identify top consumer via monitoring tools
2. Determine if legitimate (deployment, backup) or abuse
3. If abuse: Rate-limit or block offending source
4. Notify user if identifiable; block if malicious

### Service Down
**Symptoms:** Monitoring alert, users report unavailability
**Response:**
1. Check service status: `systemctl status <service>`
2. Check logs: `journalctl -u <service> -n 50`
3. Restart service if software issue
4. If hardware failure: Document, plan replacement

### Suspected Security Breach
**Symptoms:** Unknown login, unexpected config changes, strange traffic
**Response:**
1. **DO NOT** turn off system (preserve evidence)
2. Isolate from network: Disable interface or firewall rule
3. Collect logs: auth logs, access logs, audit trails
4. Change ALL passwords for affected systems (from vault)
5. Review SSH keys, API tokens; revoke suspicious ones
6. Rebuild system from known-good backup if compromised

### DNS/Internet Down
**Symptoms:** Cannot resolve hostnames, no internet access
**Response:**
1. Check DNS server: `dig @<dns-server> google.com`
2. Check gateway: `ping <gateway>`
3. Check uplink: `ping 8.8.8.8`
4. Restart services if needed: DNS server, router (last resort)

## Communication Templates

### P1 Incident Notification
```
🚨 P1 INCIDENT: <title>
**Status:** Investigating
**Impact:** <what's down>
**ETA:** <estimated fix time>
**Updates:** Thread this message for updates
```

### Incident Resolved
```
✅ RESOLVED: <title>
**Root Cause:** <brief explanation>
**Fix Applied:** <what was done>
**Prevention:** <how we'll avoid this in future>
```

## Incident Log
Maintain `docs/incident-log.md` with:
| Date | Severity | Title | Root Cause | Resolution |
|------|----------|-------|------------|-------------|
| YYYY-MM-DD | P2 | Brief description | Root cause | Resolution applied |

## Contacts
- Maintain contacts in your secrets vault with escalation paths
- Update this SOP when contacts change

## Agent Instructions

<agent-instructions mode="subagent" triggers="incident,breach,outage,p1,p2">

### Rules
- P1: 15min response, 1hr containment
- P2: 1hr response, 4hr containment
- P3: 4hr response, 24hr containment
- P4: 24hr response, 72hr containment

### Actions
1. Detection → log to docs/incident-log.md
2. Triage → classify P1-P4
3. Investigation → gather data
4. Containment → isolate
5. Remediation → fix
6. Post-incident → PIR documentation

</agent-instructions>
