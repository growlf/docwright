import { json } from '@sveltejs/kit';

export async function GET() {
  const backends: { id: string; label: string }[] = [];
  if (process.env.OPENCODE_URL) backends.push({ id: 'opencode', label: 'OpenCode' });
  if (process.env.OLLAMA_URL) {
    const model = process.env.OLLAMA_MODEL || 'ollama';
    backends.push({ id: 'ollama', label: `Ollama (${model.split(':')[0]})` });
  }
  return json({ backends });
}
