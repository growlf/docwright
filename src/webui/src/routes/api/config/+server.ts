import { json } from '@sveltejs/kit';

export function GET() {
  return json({
    vaultRoot: process.env.DOCWRIGHT_VAULT_ROOT ?? process.cwd(),
  });
}
