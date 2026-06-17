import { CheckFunction } from '../schema.js';

/**
 * Asserts that a required frontmatter field is present and non-empty.
 * @param field  The frontmatter field name to check
 */
export function fieldRequired(field: string): CheckFunction {
  return (ctx) => {
    const val = ctx.frontmatter[field];
    const missing = val === undefined || val === null || val === '' ||
      (Array.isArray(val) && val.length === 0);
    return {
      pass: !missing,
      message: missing
        ? `required frontmatter field '${field}' is missing or empty`
        : `field '${field}' present`,
      atom_id: '',
    };
  };
}
