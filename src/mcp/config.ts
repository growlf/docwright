import * as path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Config {
  docwrightPath: string;
  vaultRoot: string;
  mcpPort: number;
  profile?: string;
  logLevel: LogLevel;
}

export function loadConfig(): Config {
  const docwrightPath = process.env.DOCWRIGHT_PATH
    ? path.resolve(process.env.DOCWRIGHT_PATH)
    : process.env.DOCWRIGHT_ROOT
      ? path.resolve(process.env.DOCWRIGHT_ROOT)
      : '';

  const vaultRootEnv = process.env.DOCWRIGHT_VAULT_ROOT || process.env.DOCWRIGHT_ROOT;
  
  // The plan allows it to throw or return an error if missing when mode=vault,
  // but for pure config parsing, we can just resolve it or throw if entirely absent.
  // "Missing DOCWRIGHT_VAULT_ROOT -> graceful error message (not crash)"
  // Wait, if it doesn't crash, we just return the config and let the caller handle it.
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
