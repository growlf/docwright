/**
 * Repo-isolation guard (Mocha root hook).
 *
 * Fails the test run loudly if any test mutated the real repo's governance
 * files instead of an isolated temp vault. This turns a silent, dangerous
 * leak (see issues/bug-tests-pollute-real-audit-log) into a hard failure —
 * code-over-memory enforcement, so no future test can quietly corrupt the
 * audit log, plans, proposals, issues, decisions, or policies.
 *
 * Detection only — it never mutates the working tree, so it can't clobber a
 * developer's legitimate uncommitted changes. It compares `git status` of the
 * guarded paths before and after the run; only NEW changes (introduced by the
 * suite) trip it.
 */
const { execSync } = require('node:child_process');

const REAL_REPO = process.cwd(); // mocha runs from the repo root
const GUARDED = ['audit', 'plans', 'proposals', 'issues', 'decisions', 'policies'];

function guardedStatus() {
  try {
    return execSync(`git status --porcelain -- ${GUARDED.join(' ')}`, {
      cwd: REAL_REPO,
      encoding: 'utf8',
    });
  } catch {
    return null; // not a git repo / git unavailable — skip the guard
  }
}

const before = guardedStatus();

exports.mochaHooks = {
  afterAll() {
    if (before === null) return;
    const after = guardedStatus();
    if (after !== before) {
      throw new Error(
        'Repo-isolation leak: a test mutated real repo governance files.\n' +
          'Guarded paths: ' + GUARDED.join(', ') + '\n' +
          '--- git status before ---\n' + (before || '(clean)') + '\n' +
          '--- git status after ---\n' + (after || '(clean)') + '\n' +
          'Fix: point the offending test\'s writes at a temp vault root (pass the ' +
          'root through, e.g. executeTransition(tmpDir, ...) + logTransition(..., tmpDir)), ' +
          'then revert the leaked changes.',
      );
    }
  },
};
