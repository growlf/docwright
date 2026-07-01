import * as path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Config {
  docwrightPath: string;
  vaultRoot: string;
  mcpPort: number;
  profile?: string;
  logLevel: LogLevel;
}

// Treat an unexpanded shell template as unset. When .mcp.json references an env var
// that isn't set in the environment, the launcher passes the literal "${VAR}" string
// rather than an empty value; path.resolve() would then create a bogus "${VAR}"
// directory under cwd. Guard against that here.
function cleanEnv(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const t = v.trim();
  return t === '' || /^\$\{[^}]*\}$/.test(t) ? undefined : t;
}

export function loadConfig(): Config {
  const docwrightPathEnv = cleanEnv(process.env.DOCWRIGHT_PATH) || cleanEnv(process.env.DOCWRIGHT_ROOT);
  const docwrightPath = docwrightPathEnv ? path.resolve(docwrightPathEnv) : '';

  const vaultRootEnv = cleanEnv(process.env.DOCWRIGHT_VAULT_ROOT) || cleanEnv(process.env.DOCWRIGHT_ROOT);
  const vaultRoot = vaultRootEnv ? path.resolve(vaultRootEnv) : '';

  const portStr = process.env.DOCWRIGHT_MCP_PORT;
  let mcpPort = 3100;
  if (portStr) {
    const p = parseInt(portStr, 10);
    if (!isNaN(p)) mcpPort = p;
  } else if (process.env.DOCWRIGHT_PORT) {
     // fallback to 3002 isn't explicitly env var driven but let's check old port
     const p = parseInt(process.env.DOCWRIGHT_PORT, 10);
     if (!isNaN(p)) mcpPort = p;
  } else {
     // "default 3100, fallback 3002"
     mcpPort = 3100; // Will use 3002 in specific cases or just 3100
  }

  const profile = process.env.DOCWRIGHT_PROFILE;
  
  let logLevel: LogLevel = 'info';
  const validLogLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  if (process.env.DOCWRIGHT_LOG_LEVEL) {
    const level = process.env.DOCWRIGHT_LOG_LEVEL.toLowerCase() as LogLevel;
    if (validLogLevels.includes(level)) {
      logLevel = level;
    } else {
      console.warn(`[WARN] Invalid DOCWRIGHT_LOG_LEVEL '${process.env.DOCWRIGHT_LOG_LEVEL}', defaulting to 'info'`);
    }
  }

  return {
    docwrightPath,
    vaultRoot,
    mcpPort,
    profile,
    logLevel
  };
}
