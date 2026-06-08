import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { json } from '@sveltejs/kit';

const REPO = process.env.DOCWRIGHT_ROOT ?? resolve(process.cwd(), '../..');

export async function GET({ url }) {
  const key = url.searchParams.get('key');
  if (!key) return json({ error: 'missing key' }, { status: 400 });
  if (!/^[\w.-]+$/.test(key)) return json({ error: 'invalid key' }, { status: 400 });
  try {
    const value = execSync(`git config ${key}`, { cwd: REPO, encoding: 'utf-8' }).trim();
    return json({ value });
  } catch {
    return json({ value: null });
  }
}
