/**
 * Canonical frontmatter module — single source of truth for all YAML
 * frontmatter operations across dispatch, MCP, and webui surfaces.
 *
 * Uses js-yaml for parsing (handles all YAML types correctly).
 * All other modules MUST import from here; no local implementations.
 */
import * as yaml from 'js-yaml';

export function parseFrontmatter(raw: string): Record<string, any> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  try {
    // JSON_SCHEMA: unquoted dates stay strings ("2026-07-05", not a Date
    // object) — frontmatter dates are compared and rendered as strings
    // everywhere. Booleans, numbers, lists, and maps still parse.
    return (yaml.load(match[1], { schema: yaml.JSON_SCHEMA }) as Record<string, any>) ?? {};
  } catch {
    // Real vault docs exist with YAML js-yaml rejects (unquoted colons in
    // titles, generator-malformed tags) — degrade to a tolerant line parser
    // instead of dropping the whole document's frontmatter.
    return tolerantParse(match[1]);
  }
}

/**
 * Line-oriented fallback for frontmatter blocks strict YAML rejects.
 * Handles `key: value` (quotes stripped, true/false coerced) and block lists.
 * Later keys win; unparseable lines are skipped.
 */
function tolerantParse(block: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = block.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
    const colonIdx = line.indexOf(':');
    if (colonIdx <= 0 || /^\s/.test(line)) { i++; continue; }
    const key = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trim();
    if (rest === '' || rest === '[]') {
      i++;
      const arr: string[] = [];
      if (rest !== '[]') {
        while (i < lines.length && /^\s+-\s/.test(lines[i])) {
          arr.push(lines[i].replace(/^\s+-\s*/, '').trim());
          i++;
        }
      }
      result[key] = arr;
      continue;
    }
    let val: any = rest.replace(/^["']|["']$/g, '');
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    result[key] = val;
    i++;
  }
  return result;
}

export function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\n[\s\S]*?\n---\n?/, '');
}

export function getFrontmatterTitle(raw: string): string {
  const fm = parseFrontmatter(raw);
  if (typeof fm.title === 'string') return fm.title.trim();
  const m = raw.match(/^title:\s*["']?([^\n"']+)/m);
  return m ? m[1].trim() : '';
}

export function extractFrontmatterField(text: string, field: string): any {
  return parseFrontmatter(text)[field];
}

export function setFrontmatterField(text: string, field: string, value: any): string {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return text;
  const fmBlock = match[1];
  const regex = new RegExp(`^${field}:.*$`, 'm');
  let valStr: string;
  if (typeof value === 'boolean') {
    valStr = value ? 'true' : 'false';
  } else if (typeof value === 'number') {
    valStr = String(value);
  } else if (
    typeof value === 'string' &&
    (value.includes(':') || value.includes('\n') || value.includes('"'))
  ) {
    valStr = `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  } else {
    valStr = String(value);
  }
  const newFmBlock = regex.test(fmBlock)
    ? fmBlock.replace(regex, `${field}: ${valStr}`)
    : fmBlock.trimEnd() + `\n${field}: ${valStr}`;
  return text.replace(match[0], `---\n${newFmBlock}\n---`);
}

export function formatYamlList(items: string[]): string {
  if (!items || items.length === 0) return ' []';
  return '\n' + items.map(t => `  - ${t}`).join('\n');
}
