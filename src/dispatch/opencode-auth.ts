/**
 * opencode-auth — shared Authorization header builder for every fetch that
 * targets the OpenCode server (OPENCODE_URL).
 *
 * OpenCode supports HTTP basic auth via OPENCODE_SERVER_PASSWORD, with the
 * username defaulting to "opencode" (override: OPENCODE_SERVER_USERNAME).
 * See docs: https://opencode.ai/docs/server/
 *
 * Env vars are read at call time, not module load, so tests and late
 * configuration behave predictably.
 *
 * Lives in dispatch (not webui) because dispatch modules (ai.ts, promote.ts)
 * also call OpenCode and must not import from webui.
 */

export function opencodeHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const password = process.env.OPENCODE_SERVER_PASSWORD;
  if (!password) return { ...extra };
  const username = process.env.OPENCODE_SERVER_USERNAME || 'opencode';
  const token = Buffer.from(`${username}:${password}`).toString('base64');
  return { ...extra, Authorization: `Basic ${token}` };
}
