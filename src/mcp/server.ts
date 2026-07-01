import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config';
import { setRepoRoot } from './lib/paths';
import { allTools } from './tools/index';
import * as http from 'node:http';
import * as path from 'node:path';
import * as fs from 'node:fs';

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
    // Stub for smoke test mode
    console.log('Smoke test mode not yet implemented.');
    process.exit(0);
  }
}

async function main() {
  const config = loadConfig();

  // Root resolution
  let repoRoot: string;
  if (mode === 'upstream') {
    if (!config.docwrightPath) {
      console.error('Error: DOCWRIGHT_PATH (or DOCWRIGHT_ROOT) is required when --mode=upstream');
      process.exit(1);
    }
    repoRoot = config.docwrightPath;
  } else {
    // vault mode: prefer an explicit vault root, but fall back to the DocWright repo
    // itself (dogfooding: the repo IS the vault) when DOCWRIGHT_VAULT_ROOT is unset or
    // was passed unexpanded. Erroring out — or worse, writing into a literal "${...}"
    // directory — is a strictly worse failure than operating on the repo.
    repoRoot = config.vaultRoot || config.docwrightPath;
    if (!repoRoot) {
      console.error('Error: set DOCWRIGHT_VAULT_ROOT (or DOCWRIGHT_PATH) when --mode=vault');
      process.exit(1);
    }
    if (!config.vaultRoot) {
      console.error(`Warning: DOCWRIGHT_VAULT_ROOT unset; using DocWright repo as vault: ${repoRoot}`);
    }
  }

  if (!fs.existsSync(repoRoot) || !fs.statSync(repoRoot).isDirectory()) {
    console.error(`Error: resolved root is not a directory: ${repoRoot}`);
    process.exit(1);
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
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }))
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = allTools.find(t => t.name === request.params.name);
    if (!tool) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    try {
      return await tool.handler(request.params.arguments || {});
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  });
}

// Start
main().catch(err => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
