/**
 * Completion doc generator — the docs/<plan>.md stub written when a plan is
 * archived (#142). Shared by the MCP transition_to_completed tool and the
 * Web UI /api/lifecycle/transition-completed endpoint so both surfaces emit
 * the identical doc: fresh minimal frontmatter built from parsed fields, not
 * a re-serialization of the plan's own frontmatter block.
 */
import { extractFrontmatterField, formatYamlList } from './frontmatter';

export function generateCompletionDoc(
  planText: string,
  safeName: string,
  completedDate: string,
): string {
  const title = extractFrontmatterField(planText, 'title') || safeName.replace(/\.md$/, '');
  const author = extractFrontmatterField(planText, 'author') || 'NetYeti';
  const created = extractFrontmatterField(planText, 'created') || completedDate;
  const tagsStr = extractFrontmatterField(planText, 'tags') || '';
  let tagsBlock = '';
  if (Array.isArray(tagsStr)) {
    tagsBlock = `tags:${formatYamlList(tagsStr)}`;
  } else if (typeof tagsStr === 'string' && tagsStr.trim() !== '') {
    tagsBlock = `tags:\n  - ${tagsStr}`;
  } else {
    tagsBlock = `tags: []`;
  }

  return `---
title: ${title}
status: completed
completed_date: ${completedDate}
author: ${author}
created: ${created}
${tagsBlock}
---

# ${title}

_Document generated from completed plan: plans/completed/${safeName}_

<!-- Document your implementation here -->
`;
}
