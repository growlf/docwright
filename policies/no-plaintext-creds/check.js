// Generated from check.ts by npm run build:atoms — do not edit manually.
// policies/no-plaintext-creds/check.ts
var CRED_PATTERNS = [
  { pattern: /\bpassword\s*[:=]\s*(?!['"]?(vault|bitwarden|<|stored|see|refer|set in|from)\b)[^\s"'<]{4,}/i, label: "plaintext password" },
  { pattern: /\bsecret\s*[:=]\s*(?!['"]?(vault|bitwarden|<|stored|see|refer)\b)[^\s"'<]{6,}/i, label: "plaintext secret" },
  { pattern: /\b(?:api[_-]?key|apikey)\s*[:=]\s*(?!['"]?(?:vault|bitwarden|<|stored|see))[^\s"'<]{8,}/i, label: "plaintext API key" },
  { pattern: /\btoken\s*[:=]\s*(?!['"]?(?:vault|bitwarden|<|stored|see|\$))[a-zA-Z0-9_\-\.]{12,}/i, label: "plaintext token" }
];
function check(ctx) {
  const text = ctx.content;
  for (const { pattern, label } of CRED_PATTERNS) {
    if (pattern.test(text)) {
      return {
        pass: false,
        message: `possible ${label} detected in content \u2014 use a vault reference (e.g., "Bitwarden: item-name") instead of plaintext`,
        atom_id: "no-plaintext-creds"
      };
    }
  }
  return { pass: true, message: "no plaintext credential patterns detected", atom_id: "no-plaintext-creds" };
}
export {
  check
};
