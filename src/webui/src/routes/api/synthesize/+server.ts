const AI_TIMEOUT = 60_000;
const OLLA_BASE = process.env.OLLA_BASE || 'http://localhost:11434/v1';
const OLLA_MODEL = process.env.OLLA_MODEL || 'llama3.1:8b';
const OLLA_API_KEY = process.env.OLLA_API_KEY ?? '';

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
    const res = await fetch(`${OLLA_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(OLLA_API_KEY ? { 'Authorization': `Bearer ${OLLA_API_KEY}` } : {}) },
      body: JSON.stringify({
        model: OLLA_MODEL,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT),
    });
    if (!res.ok) throw new Error(`Olla: ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || '';
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
