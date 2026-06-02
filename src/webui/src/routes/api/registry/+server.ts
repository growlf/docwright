import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

const REGISTRY_PATH = path.resolve(REPO_ROOT, '.docwright/registry.json');

export function GET() {
  try {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
    return json(JSON.parse(raw));
  } catch {
    return json({ projects: [] });
  }
}
