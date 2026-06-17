/**
 * policy-atoms-core — Minimal YAML parser for atom.yaml files.
 *
 * Handles the flat-key-value format used in atom frontmatter. Supports:
 *   - scalar values (string, number, boolean)
 *   - inline arrays: key: [a, b, c]
 *   - block arrays:
 *       key:
 *         - a
 *         - b
 *   - quoted strings (single or double)
 *   - comment lines (#)
 *
 * Does NOT support nested objects, multi-line strings, or anchors.
 * ISOLATION INVARIANT: import only from node: builtins and src/policy-atoms-core/.
 */

export function parseAtomYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) { i++; continue; }

    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) { i++; continue; }

    const key = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trim();

    if (rest === '') {
      // Block array on following lines
      const arr: string[] = [];
      i++;
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        arr.push(lines[i].replace(/^\s*-\s+/, '').trim().replace(/^['"]|['"]$/g, ''));
        i++;
      }
      result[key] = arr;
      continue;
    }

    // Inline array: [a, b, c]
    if (rest.startsWith('[')) {
      const inner = rest.replace(/^\[|\]$/g, '');
      result[key] = inner
        .split(',')
        .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else if (rest === 'true') {
      result[key] = true;
    } else if (rest === 'false') {
      result[key] = false;
    } else if (/^\d+$/.test(rest)) {
      result[key] = parseInt(rest, 10);
    } else {
      result[key] = rest.replace(/^['"]|['"]$/g, '');
    }
    i++;
  }

  return result;
}
