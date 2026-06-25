import { scanPlugins } from '$lib/server/plugins.js';

export function GET() {
  const plugins = scanPlugins().map(({ manifest }) => ({
    name: manifest.name,
    displayName: manifest.displayName,
    version: manifest.version,
    icon: manifest.icon,
    description: manifest.description,
  }));
  return Response.json(plugins);
}
