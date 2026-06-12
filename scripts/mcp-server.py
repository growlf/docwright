#!/usr/bin/env python3
"""Wrapper that runs the DocWright TypeScript MCP server.

This script exists because opencode.json references it. It spawns the
compiled Node.js MCP server at dist/mcp/server.js with the same args.
"""

import subprocess
import sys
import os
import signal

SERVER = os.path.join(os.path.dirname(__file__), '..', 'dist', 'mcp', 'server.js')
NODE = os.environ.get('NODE_PATH', '/usr/bin/env node')

# Try to resolve node
def find_node():
    for p in ['/home/netyeti/.nvm/versions/node/v22.17.1/bin/node',
              '/usr/bin/node', '/usr/local/bin/node']:
        if os.path.exists(p):
            return p
    import shutil
    return shutil.which('node') or 'node'

def main():
    node = find_node()
    if not os.path.exists(SERVER):
        # Fallback to check dist root
        alt = os.path.join(os.path.dirname(__file__), '..', 'dist', 'mcp-server.js')
        if os.path.exists(alt):
            server = alt
        else:
            print(f"Error: MCP server not built. Run 'npm run compile:mcp' first.", file=sys.stderr)
            sys.exit(1)
    else:
        server = SERVER

    # Forward all args
    args = [node, server] + sys.argv[1:]

    # Handle termination gracefully
    try:
        proc = subprocess.Popen(args, cwd=os.path.dirname(server))
        signal.signal(signal.SIGTERM, lambda *a: proc.terminate())
        signal.signal(signal.SIGINT, lambda *a: proc.terminate())
        proc.wait()
        sys.exit(proc.returncode)
    except FileNotFoundError:
        print(f"Error: Node.js not found at {node}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
