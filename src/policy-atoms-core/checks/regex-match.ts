import { CheckFunction } from '../schema.js';

/**
 * Asserts that a frontmatter field (or full file content) matches a regex pattern.
 *
 * @param pattern  Regex pattern string
 * @param field    Frontmatter field to check; if omitted, checks full file content
 * @param flags    Regex flags (default: '')
 */
export function regexMatch(pattern: string, field?: string, flags = ''): CheckFunction {
  const re = new RegExp(pattern, flags);
  return (ctx) => {
    const value = field
      ? String(ctx.frontmatter[field] ?? '')
      : ctx.content;

    const subject = field ? `field '${field}'` : 'file content';
    const pass = re.test(value);
    return {
      pass,
      message: pass
        ? `${subject} matches /${pattern}/${flags}`
        : `${subject} does not match /${pattern}/${flags}`,
      atom_id: '',
    };
  };
}
