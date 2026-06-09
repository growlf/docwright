import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { loadConfig } from './config';
import { setRepoRoot } from './lib/paths';
import { allTools } from './tools/index';
import * as http from 'node:http';
import * as path from 'node:path';

// Define expected args
const args = process.argv.slice(2);
let mode: 'vault' | 'upstream' = 'vault';
let transportType: 'stdio' | 'sse' = 'stdio';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help' || args[i] === '-h') {
    console.error('Usage: node server.js [--mode vault|upstream] [--transport stdio|sse]');
    process.exit(0);
  } else if (args[i] === '--mode') {
    const val = args[++i];
    if (val === 'vault' || val === 'upstream') mode = val;
    else {
      console.error(`Invalid --mode: ${val}. Expected vault or upstream.`);
      process.exit(1);
    }
  } else if (args[i] === '--transport') {
    const val = args[++i];
    if (val === 'stdio' || val === 'sse') transportType = val;
    else {
      console.error(`Invalid --transport: ${val}. Expected stdio or sse.`);
      process.exit(1);
    }
  } else if (args[i] === '--test') {
    // Stub for smoke test mode (used later in parity suite)
    console.log('Smoke test mode not yet implemented.');
    process.exit(0);
  }
}

async function main() {
  const config = loadConfig();

  // Root resolution
  let repoRoot: string;
  if (mode === 'upstream') {
    const rootEnv = process.env.DOCWRIGHT_ROOT;
    if (!rootEnv) {
      console.error('Error: DOCWRIGHT_ROOT is required when --mode=upstream');
      process.exit(1);
    }
    repoRoot = path.resolve(rootEnv);
  } else {
    // vault mode
    if (!config.vaultRoot) {
      console.error('Error: DOCWRIGHT_VAULT_ROOT is required when --mode=vault');
      process.exit(1);
    }
    repoRoot = config.vaultRoot;
  }

  setRepoRoot(repoRoot);

  // Create MCP Server
  const server = new Server({
    name: 'docwright-mcp',
    version: '0.3.0',
  }, {
    capabilities: {
      tools: {}
    }
  });

  setupTools(server);

  if (transportType === 'stdio') {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`DocWright MCP server running in ${mode} mode via stdio`);
  } else {
    // SSE
    let sseTransport: SSEServerTransport | null = null;
    
    // Create an HTTP server to handle the SSE connections
    const httpServer = http.createServer((req, res) => {
      if (req.url === '/sse') {
        sseTransport = new SSEServerTransport('/message', res);
        server.connect(sseTransport).catch(console.error);
      } else if (req.url === '/message' && req.method === 'POST') {
        if (sseTransport) {
          sseTransport.handlePostMessage(req, res).catch(console.error);
        } else {
          res.statusCode = 404;
          res.end();
        }
      } else {
        res.statusCode = 404;
        res.end();
      }
    });

    const port = config.mcpPort;
    httpServer.listen(port, () => {
      console.error(`DocWright MCP server running in ${mode} mode via SSE on port ${port}`);
    });
  }
}

export function setupTools(server: Server) {
  for (const tool of allTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema.properties,
      tool.handler as any
    );
  }
}

// Start
main().catch(err => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
