/**
 * commit-format check — canonical TypeScript source.
 * Validates the first line of a commit message matches the required format.
 * Mirrors the enforcement in .githooks/commit-msg exactly.
 *
 * CheckContext.content = full commit message text
 */
import { regexMatch } from '../../src/policy-atoms-core/checks/regex-match.js';
import type { CheckContext, CheckResult } from '../../src/policy-atoms-core/schema.js';

const COMMIT_FORMAT_RE = '^(feat|fix|docs|refactor|test|chore|policy|decision): .+';

export function check(ctx: CheckContext): CheckResult {
  const firstLine = ctx.content.split('\n')[0].replace(/\r$/, '');
  const result = regexMatch(COMMIT_FORMAT_RE)({ ...ctx, content: firstLine });
  return {
    ...result,
    atom_id: 'commit-format',
    message: result.pass
      ? 'commit message format is valid'
      : `commit message "${firstLine}" does not match '<type>: <description>'. Valid types: feat|fix|docs|refactor|test|chore|policy|decision`,
  };
}
