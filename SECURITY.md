# Security Policy

## Supported Versions

docwright is currently in pre-alpha. Security fixes will be applied to the
latest version only.

| Version | Supported |
|---------|-----------|
| 0.x.x   | ✅        |

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Email: growlfd@gmail.com

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations

You will receive a response within 48 hours. If the vulnerability is confirmed,
we will work with you on a coordinated disclosure timeline.

## Scope

Security concerns relevant to docwright include:
- The Web UI server (localhost by default — binds to 127.0.0.1 only)
- The Forgejo OAuth integration
- The AI dispatch layer and trust tier enforcement
- The `author-role:` ACL model
- Pre-receive hook scripts

Out of scope: vulnerabilities in upstream dependencies (OpenCode, Forgejo,
SvelteKit, markdown-it). Please report those to their respective projects.
