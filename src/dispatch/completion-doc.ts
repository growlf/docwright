/**
 * Completion doc generator — the docs/<plan>.md stub written when a plan is
 * archived (#142). Shared by the MCP transition_to_completed tool and the
 * Web UI /api/lifecycle/transition-completed endpoint so both surfaces emit
 * the identical doc: fresh minimal frontmatter built from parsed fields, not
 * a re-serialization of the plan's own frontmatter block.
 *
 * Frontmatter is emitted via a YAML-safe serializer (js-yaml dump), NOT raw
 * string interpolation — a title with a colon/pipe/quote/# (#185/#136 class)
 * used to produce YAML that js-yaml refused to load. Serialize, don't interpolate.
 */
import * as yaml from 'js-yaml';
import { extractFrontmatterField } from './frontmatter';

export function generateCompletionDoc(
  planText: string,
  safeName: string,
  completedDate: string,
): string {
  const title = String(extractFrontmatterField(planText, 'title') || safeName.replace(/\.md$/, ''));
  const author = String(extractFrontmatterField(planText, 'author') || 'NetYeti');
  const created = String(extractFrontmatterField(planText, 'created') || completedDate);

  const tagsRaw = extractFrontmatterField(planText, 'tags');
  let tags: string[] = [];
  if (Array.isArray(tagsRaw)) {
    tags = tagsRaw.map((t) => String(t));
  } else if (typeof tagsRaw === 'string' && tagsRaw.trim() !== '') {
    tags = [tagsRaw.trim()];
  }

  // Build an object and let js-yaml quote/escape scalars as needed. sortKeys:false
  // preserves this field order; lineWidth:-1 keeps long titles on one line.
  const frontmatter = yaml
    .dump(
      { title, status: 'completed', completed_date: String(completedDate), author, created, tags },
      { sortKeys: false, lineWidth: -1 },
    )
    .trimEnd();

  return `---
${frontmatter}
---

# ${title}

_Document generated from completed plan: plans/completed/${safeName}_

<!-- Document your implementation here -->
`;
}
