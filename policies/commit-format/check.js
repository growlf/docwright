// commit-format check — compiled artifact (mirrors check.ts).
// Do not edit manually; regenerate from check.ts.
const COMMIT_FORMAT_RE = /^(feat|fix|docs|refactor|test|chore|policy|decision): .+/;

export function check(ctx) {
  const firstLine = ctx.content.split('\n')[0].replace(/\r$/, '');
  const pass = COMMIT_FORMAT_RE.test(firstLine);
  return {
    pass,
    atom_id: 'commit-format',
    message: pass
      ? 'commit message format is valid'
      : `commit message "${firstLine}" does not match '<type>: <description>'. Valid types: feat|fix|docs|refactor|test|chore|policy|decision`,
  };
}
