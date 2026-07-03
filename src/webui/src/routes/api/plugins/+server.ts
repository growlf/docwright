import { scanPlugins } from '$lib/server/plugins.js';

export function GET() {
  const plugins = scanPlugins().map(({ manifest }) => ({
    name: manifest.name,
    displayName: manifest.displayName,
    version: manifest.version,
    icon: manifest.icon,
    description: manifest.description,
    defaultRoute: manifest.defaultRoute,
    hasSearch: manifest.hasSearch,
    order: manifest.order,
    searchable: manifest.searchable,
  }));
  return Response.json(plugins);
}
