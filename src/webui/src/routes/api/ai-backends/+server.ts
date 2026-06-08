import { json } from '@sveltejs/kit';

// Model selection is handled by OpenCode's own /model selector.
// DocWright always routes AI calls through OpenCode — switch models there.
export async function GET() {
  return json({ backends: [{ id: 'opencode', label: 'OpenCode' }] });
}
