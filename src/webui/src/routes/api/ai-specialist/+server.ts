import { json } from '@sveltejs/kit';
import { opencodeComplete } from '$lib/server/opencode-complete.js';
import { AI_ROLES, type RoleId } from '$lib/ai-roles.js';

/**
 * POST /api/ai-specialist
 * Body: { role: RoleId; prompt: string }
 * Returns: { text: string }
 *
 * Single-turn specialist AI call. Used by window.__docwright.bridge.aiSpecialist()
 * so plugins can access typed specialist roles without managing OpenCode directly.
 */
export async function POST({ request }) {
  const { role, prompt } = await request.json() as { role: string; prompt: string };

  if (!role || !prompt) {
    return json({ error: 'role and prompt are required' }, { status: 400 });
  }

  const roleConfig = AI_ROLES[role as RoleId];
  if (!roleConfig) {
    return json(
      { error: `Unknown role "${role}". Available: ${Object.keys(AI_ROLES).join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const text = await opencodeComplete(prompt, undefined, roleConfig.systemPrompt);
    return json({ text, role, streaming: roleConfig.streaming });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

/**
 * GET /api/ai-specialist
 * Returns the list of available role IDs and descriptions.
 */
export async function GET() {
  return json(
    Object.values(AI_ROLES).map(r => ({
      id: r.id,
      description: r.description,
      streaming: r.streaming,
    })),
  );
}
