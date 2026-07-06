import * as path from 'node:path';
import { createRequire } from 'node:module';

/**
 * Loader shim for unit-testing SvelteKit endpoints outside Vite.
 * '@sveltejs/kit' is ESM-only and '$lib/...' is a SvelteKit alias — neither
 * resolves from the CJS test pipeline. Shim the kit's `json` helper with the
 * equivalent Response constructor and map $lib to src/webui/src/lib while an
 * endpoint module loads.
 */
const shimRequire = createRequire(__filename);
const NodeModule: any = shimRequire('node:module').Module;
const realLoad = NodeModule._load;
const WEBUI_LIB = path.resolve(__dirname, '..', '..', 'src', 'webui', 'src', 'lib');

export function shimSvelteKit() {
  NodeModule._load = function (request: string, ...rest: any[]) {
    if (request === '@sveltejs/kit') {
      return {
        json: (data: any, init?: ResponseInit) =>
          new Response(JSON.stringify(data), {
            ...init,
            headers: { 'content-type': 'application/json' },
          }),
      };
    }
    if (request.startsWith('$lib/')) {
      const mapped = path.join(WEBUI_LIB, request.slice('$lib/'.length).replace(/\.js$/, ''));
      return realLoad.call(this, mapped, ...rest);
    }
    return realLoad.call(this, request, ...rest);
  };
}

export function unshimSvelteKit() {
  NodeModule._load = realLoad;
}

/**
 * Load a webui +server endpoint fresh, with the shim active. Busts the
 * require cache first — endpoints read DOCWRIGHT_ROOT at module load, so
 * each fixture needs its own binding.
 */
export function loadEndpoint(repoRelPath: string): any {
  const abs = path.resolve(__dirname, '..', '..', repoRelPath);
  shimSvelteKit();
  try {
    const resolved = shimRequire.resolve(abs);
    delete shimRequire.cache[resolved];
    return shimRequire(resolved);
  } finally {
    unshimSvelteKit();
  }
}
