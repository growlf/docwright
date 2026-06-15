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
    return (yaml.load(match[1]) as Record<string, any>) ?? {};
  } catch {
    return {};
  }
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
