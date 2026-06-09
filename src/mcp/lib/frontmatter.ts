import * as yaml from 'js-yaml';

export function parseFrontmatter(text: string): Record<string, any> {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  try {
    return yaml.load(match[1]) as Record<string, any>;
  } catch {
    return {};
  }
}

export function extractFrontmatterField(text: string, field: string): any {
  return parseFrontmatter(text)[field];
}

export function setFrontmatterField(text: string, field: string, value: any): string {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return text;
  
  const fmBlock = match[1];
  const regex = new RegExp(`^${field}:.*$`, 'm');
  
  let newFmBlock = fmBlock;
  if (regex.test(fmBlock)) {
    // If setting string, try to keep it clean, or use JSON.stringify for safety if complex
    let valStr = String(value);
    if (typeof value === 'boolean') valStr = value ? 'true' : 'false';
    else if (typeof value === 'string' && (value.includes(':') || value.includes('\n'))) valStr = `"${value.replace(/"/g, '\\"')}"`;
    
    newFmBlock = fmBlock.replace(regex, `${field}: ${valStr}`);
  } else {
    // append
    let valStr = String(value);
    if (typeof value === 'boolean') valStr = value ? 'true' : 'false';
    else if (typeof value === 'string' && (value.includes(':') || value.includes('\n'))) valStr = `"${value.replace(/"/g, '\\"')}"`;
    newFmBlock = fmBlock.trimEnd() + `\n${field}: ${valStr}`;
  }
  
  return text.replace(match[0], `---\n${newFmBlock}\n---`);
}

export function formatYamlList(items: string[]): string {
  if (!items || items.length === 0) return ' []';
  return '\n' + items.map(t => `  - ${t}`).join('\n');
}
