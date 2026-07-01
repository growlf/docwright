// Root Mocha config. The require hook installs a repo-isolation guard so a test
// that forgets to point its writes at a temp vault can never silently mutate the
// real repo's governance files (audit log, plans, proposals, issues, decisions,
// policies). Enforced in code, not memory — see
// issues/bug-tests-pollute-real-audit-log.
module.exports = {
  require: ['./test/repo-isolation-guard.cjs'],
};
