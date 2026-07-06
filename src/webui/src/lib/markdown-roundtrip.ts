/**
 * WYSIWYG round-trip kit (#149) — the single source for the editor's
 * markdown⇄HTML conversion and frontmatter handling.
 *
 * Safety model:
 * - Frontmatter is NEVER re-serialized on save. splitFrontmatter keeps the
 *   original text block; buildRawFromText reattaches it verbatim. Property
 *   edits go through applyFrontmatterEdits, which applies per-field,
 *   byte-preserving edits via the canonical dispatch editor.
 * - turndown is configured for GFM round-trip: `-` bullets, task-list
 *   checkboxes survive, literal underscores are not escaped.
 */
import TurndownService from 'turndown';
import { tables, strikethrough, taskListItems } from 'turndown-plugin-gfm';
import markdownit from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import { parseFrontmatter, setFrontmatterField } from '../../../dispatch/frontmatter';

export function createTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });
  td.use(tables);
  td.use(strikethrough);
  td.use(taskListItems);
  // Tight list items: `- item` / `1. item`, not turndown's default
  // `-   item` — vault markdown uses single-space markers throughout.
  td.addRule('tightListItem', {
    filter: 'li',
    replacement: (content: string, node: any, options: any) => {
      content = content
        .replace(/^\n+/, '')
        .replace(/\n+$/, '\n')
        .replace(/\n/gm, '\n  ');
      let prefix = options.bulletListMarker + ' ';
      const parent = node.parentNode;
      if (parent && parent.nodeName === 'OL') {
        const start = parent.getAttribute('start');
        const index = Array.prototype.indexOf.call(parent.children, node);
        prefix = (start ? Number(start) + index : index + 1) + '. ';
      }
      return prefix + content + (node.nextSibling && !/\n$/.test(content) ? '\n' : '');
    },
  });
  // Task checkboxes emit exactly `[x]`/`[ ]` — the renderer's own text node
  // supplies the following space, so the GFM rule's trailing space would
  // double it.
  td.addRule('taskCheckbox', {
    filter: (node: any) =>
      node.nodeName === 'INPUT' &&
      node.getAttribute('type') === 'checkbox' &&
      node.parentNode &&
      node.parentNode.nodeName === 'LI',
    replacement: (_content: string, node: any) => (node.checked ? '[x]' : '[ ]'),
  });
  // Literal underscores (snake_case identifiers, file_names) must survive the
  // round-trip unescaped. Intra-word underscores don't create emphasis in
  // markdown-it, and real <em> nodes emit their own delimiters, so unescaping
  // is safe.
  const origEscape = td.escape.bind(td);
  td.escape = (s: string) => origEscape(s).replace(/\\_/g, '_');
  return td;
}

export function createMarkdownIt() {
  return markdownit({ html: true, linkify: false }).use(taskLists, { enabled: true });
}

export interface SplitDoc {
  /** Original frontmatter text block (between the --- fences), or null. */
  fmText: string | null;
  /** Parsed view of the frontmatter — for display/logic only, never re-serialized. */
  frontmatter: Record<string, any> | null;
  body: string;
}

export function splitFrontmatter(raw: string): SplitDoc {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { fmText: null, frontmatter: null, body: raw };
  return { fmText: match[1], frontmatter: parseFrontmatter(raw), body: match[2] };
}

/** Reattach the ORIGINAL frontmatter block — byte-identical — to a new body. */
export function buildRawFromText(fmText: string | null, body: string): string {
  if (fmText === null) return body;
  return '---\n' + fmText + '\n---\n' + body;
}

/**
 * Apply property-pane edits as per-field text edits on the original block.
 * Only fields whose value actually changed (vs oldFm) are touched; everything
 * else in the block — ordering, quoting, comments — is preserved.
 */
export function applyFrontmatterEdits(
  fmText: string,
  oldFm: Record<string, any>,
  newFm: Record<string, any>,
): string {
  let doc = '---\n' + fmText + '\n---';
  for (const [key, value] of Object.entries(newFm)) {
    // Underscore-prefixed keys (_path etc.) are client-injected view state,
    // never written to disk.
    if (key.startsWith('_')) continue;
    const before = oldFm?.[key];
    const same = Array.isArray(value) && Array.isArray(before)
      ? JSON.stringify(value) === JSON.stringify(before)
      : value === before;
    if (!same) doc = setFrontmatterField(doc, key, value);
  }
  const m = doc.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : fmText;
}
