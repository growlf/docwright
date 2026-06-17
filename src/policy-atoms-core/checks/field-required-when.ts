import { CheckFunction } from '../schema.js';

/**
 * Asserts a field is present and non-empty ONLY when a condition field equals
 * one of the trigger values. Passes unconditionally otherwise.
 *
 * @param field         The frontmatter field that must be present
 * @param conditionField  The frontmatter field to check the condition on
 * @param triggerValues   If conditionField equals any of these, field is required
 *
 * Example: fieldRequiredWhen('assigned_to', 'status', ['approved', 'in-progress'])
 *   → passes when status is 'draft', fails when status is 'approved' and assigned_to is empty.
 */
export function fieldRequiredWhen(
  field: string,
  conditionField: string,
  triggerValues: string[],
): CheckFunction {
  return (ctx) => {
    const condVal = String(ctx.frontmatter[conditionField] ?? '');
    if (!triggerValues.includes(condVal)) {
      return { pass: true, message: `${conditionField}='${condVal}' — '${field}' not required`, atom_id: '' };
    }
    const val = ctx.frontmatter[field];
    const valStr = Array.isArray(val) ? val[0] : val;
    const missing = valStr === undefined || valStr === null || String(valStr).trim() === '' ||
      String(valStr).trim().toLowerCase() === 'none';
    return {
      pass: !missing,
      message: missing
        ? `'${field}' is required when ${conditionField}='${condVal}' but is missing or empty`
        : `'${field}' present as required when ${conditionField}='${condVal}'`,
      atom_id: '',
    };
  };
}
