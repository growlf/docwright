// Generated from check.ts by npm run build:atoms — do not edit manually.
// src/policy-atoms-core/checks/field-required-when.ts
function fieldRequiredWhen(field, conditionField, triggerValues) {
  return (ctx) => {
    const condVal = String(ctx.frontmatter[conditionField] ?? "");
    if (!triggerValues.includes(condVal)) {
      return { pass: true, message: `${conditionField}='${condVal}' \u2014 '${field}' not required`, atom_id: "" };
    }
    const val = ctx.frontmatter[field];
    const valStr = Array.isArray(val) ? val[0] : val;
    const missing = valStr === void 0 || valStr === null || String(valStr).trim() === "" || String(valStr).trim().toLowerCase() === "none";
    return {
      pass: !missing,
      message: missing ? `'${field}' is required when ${conditionField}='${condVal}' but is missing or empty` : `'${field}' present as required when ${conditionField}='${condVal}'`,
      atom_id: ""
    };
  };
}

// policies/lifecycle-gate/check.ts
var requireCompletedDate = fieldRequiredWhen("completed_date", "status", ["completed"]);
var requireCanceledDate = fieldRequiredWhen("canceled_date", "status", ["canceled"]);
var requireCancelReason = fieldRequiredWhen("cancellation_reason", "status", ["canceled"]);
function check(ctx) {
  const r1 = requireCompletedDate(ctx);
  if (!r1.pass) return { ...r1, atom_id: "lifecycle-gate" };
  const r2 = requireCanceledDate(ctx);
  if (!r2.pass) return { ...r2, atom_id: "lifecycle-gate" };
  const r3 = requireCancelReason(ctx);
  if (!r3.pass) return { ...r3, atom_id: "lifecycle-gate" };
  const gate = ctx.frontmatter["gate_status"];
  if (gate === "approved" || gate === "waived") {
    return { pass: false, message: `gate_status: '${gate}' must be set by a human reviewer \u2014 AI cannot approve or waive gates`, atom_id: "lifecycle-gate" };
  }
  return { pass: true, message: "lifecycle gate fields are structurally valid", atom_id: "lifecycle-gate" };
}
export {
  check
};
