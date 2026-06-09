/**
 * MCP Server entrypoint
 */

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node server.js [--mode vault|upstream] [--transport stdio|sse]');
  process.exit(0);
}

console.log('MCP server starting...');
