import * as fs from 'node:fs';
import * as path from 'node:path';
import { CheckFunction } from '../schema.js';

/**
 * Asserts that a file path referenced in a frontmatter field actually exists
 * on disk relative to the vault root.
 *
 * @param field  Frontmatter field containing the relative file path
 */
export function linkedArtifactExists(field: string): CheckFunction {
  return (ctx) => {
    const ref = ctx.frontmatter[field] as string | undefined;
    if (!ref) {
      return { pass: false, message: `field '${field}' is missing or empty`, atom_id: '' };
    }

    // Strip wikilink syntax if present: [[path]] or [[path|alias]]
    const cleaned = ref.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0].trim();
    // Add .md extension if no extension present
    const withExt = path.extname(cleaned) ? cleaned : `${cleaned}.md`;
    const abs = path.resolve(ctx.vaultRoot, withExt);
    const exists = fs.existsSync(abs);

    return {
      pass: exists,
      message: exists
        ? `linked artifact '${cleaned}' exists`
        : `linked artifact '${cleaned}' not found at ${abs}`,
      atom_id: '',
    };
  };
}
