import { json } from '@sveltejs/kit';
import path from 'node:path';

const VAULT_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : process.cwd();

export function GET() {
  return json({
    vaultRoot: VAULT_ROOT,
    aiGateway: {
      url: process.env.OPENCODE_URL ?? 'http://localhost:4096',
      defaultModel: process.env.OPENCODE_DEFAULT_MODEL ?? null,
    },
  });
}
