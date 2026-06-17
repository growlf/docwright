import { CheckFunction } from '../schema.js';

/**
 * Asserts that the frontmatter `status` field is one of the allowed values.
 * Optionally validates from→to transitions if `fromField` is provided.
 *
 * @param allowedValues  Allowed status values
 * @param transitions    Optional map of from→[allowedTo] for transition validation
 * @param fromField      Optional frontmatter field name holding the prior status
 */
export function statusTransitionAllowed(
  allowedValues: string[],
  transitions?: Record<string, string[]>,
  fromField?: string,
): CheckFunction {
  return (ctx) => {
    const to = ctx.frontmatter['status'] as string | undefined;

    if (!to) {
      return { pass: false, message: "frontmatter field 'status' is missing", atom_id: '' };
    }

    if (!allowedValues.includes(to)) {
      return {
        pass: false,
        message: `status '${to}' is not in allowed values: [${allowedValues.join(', ')}]`,
        atom_id: '',
      };
    }

    if (transitions && fromField) {
      const from = ctx.frontmatter[fromField] as string | undefined;
      if (from && from !== to) {
        const allowed = transitions[from];
        if (allowed && !allowed.includes(to)) {
          return {
            pass: false,
            message: `status transition '${from}' → '${to}' is not allowed. Allowed: [${allowed.join(', ')}]`,
            atom_id: '',
          };
        }
      }
    }

    return { pass: true, message: `status '${to}' is valid`, atom_id: '' };
  };
}
