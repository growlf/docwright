import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT ?? path.resolve(process.cwd(), '../..');
const OPENCODE_JSON = path.join(REPO_ROOT, 'opencode.json');
import { opencodeHeaders } from '../../../../dispatch/opencode-auth';

const OPENCODE_URL = process.env.OPENCODE_URL ?? 'http://localhost:4096';

function readProjectModel(): string {
  try {
    const cfg = JSON.parse(fs.readFileSync(OPENCODE_JSON, 'utf-8'));
    return cfg.model ?? '';
  } catch { return ''; }
}

export async function GET() {
  const projectModel = readProjectModel();
  let models: { id: string; providerID: string; name: string }[] = [];
  try {
    const res = await fetch(`${OPENCODE_URL}/api/model`, { headers: opencodeHeaders() });
    if (res.ok) {
      const data = await res.json();
      models = (data.data ?? []).map((m: any) => ({
        id: m.id,
        providerID: m.providerID,
        name: m.name ?? m.id,
      }));
    }
  } catch { /* OpenCode not available */ }

  return json({ current: projectModel, models });
}

export async function PUT({ request }) {
  const { model } = await request.json();
  if (!model || typeof model !== 'string') return json({ error: 'missing model' }, { status: 400 });

  try {
    const raw = fs.readFileSync(OPENCODE_JSON, 'utf-8');
    const cfg = JSON.parse(raw);
    cfg.model = model;
    fs.writeFileSync(OPENCODE_JSON, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
    return json({ ok: true, model });
  } catch (e: any) {
    return json({ error: String(e) }, { status: 500 });
  }
}
