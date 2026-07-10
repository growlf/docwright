/**
 * ai-text — shared cleanup for raw AI output. Used server-side (the legacy
 * /api/improve path) and client-side (the live Improve flow extracts the improved
 * body from the streamed events, step 3.4). Keep both callers on this one copy so
 * applied text is cleaned identically regardless of transport.
 */

/**
 * Strip AI wrapper artifacts from improved text:
 * - a wrapping ```markdown … ``` / ``` … ``` code fence around the whole response
 * - short "Here's the improved body:" style preamble before the first heading
 */
export function stripAIWrapper(text: string): string {
  let s = (text ?? '').trim();
  const fenced = s.match(/^```(?:markdown|md)?\n([\s\S]+?)(?:\n```\s*)?$/);
  if (fenced) return fenced[1].trimEnd();
  const headingIdx = s.search(/^#{1,6} /m);
  if (headingIdx > 0 && headingIdx < 300) {
    const before = s.slice(0, headingIdx);
    if (!before.includes('\n##') && !before.includes('\n#')) {
      s = s.slice(headingIdx);
    }
  }
  return s;
}
