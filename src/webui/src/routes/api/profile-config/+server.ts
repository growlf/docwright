import path from 'node:path';
import { json } from '@sveltejs/kit';
import { getActiveProfile } from '../../../../../dispatch/profile';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

export async function GET() {
  try {
    const profile = getActiveProfile(REPO_ROOT);
    return json({
      name: profile.name,
      version: profile.version,
      documentTypes: profile.documentTypes ?? [],
      features: profile.features ?? {},
      relationshipEngine: profile.relationshipEngine ?? {
        auto_detect_on_create: true,
        auto_detect_on_update: true,
        auto_detect_on_approval: true,
        similarity_threshold: 0.35,
        show_plan_button: true,
      },
    });
  } catch (err: any) {
    return json({ error: err.message }, { status: 400 });
  }
}
