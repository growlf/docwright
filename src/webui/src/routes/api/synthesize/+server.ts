import { opencodeComplete } from '$lib/server/opencode-complete.js';

export async function POST({ request }) {
  const { responses, _promptOverride } = await request.json();
  if (!Array.isArray(responses) || responses.length < 2) {
    return new Response('Need at least 2 perspectives to synthesize', { status: 400 });
  }

  let prompt: string;
  if (_promptOverride) {
    prompt = _promptOverride;
  } else {
    const perspectives = responses
      .map((r: { label?: string; text: string }, i: number) => {
        const label = r.label || `Review ${i + 1}`;
        return `--- ${label} ---\n${r.text.slice(0, 1000)}`;
      })
      .join('\n\n');

    prompt = [
      `You are reading ${responses.length} perspectives on the same question.`,
      `Synthesize them into:`,
      `1. Areas of agreement`,
      `2. Areas of disagreement (with specifics)`,
      `3. Your own recommendation — clearly labeled as one more perspective, not a verdict`,
      `4. Items that need human judgment before proceeding`,
      ``,
      `Keep each section to 2-3 sentences.`,
      ``,
      perspectives,
    ].join('\n');
  }

  try {
    const text = await opencodeComplete(prompt);
    return new Response(JSON.stringify({ synthesis: text }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Synthesis failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
