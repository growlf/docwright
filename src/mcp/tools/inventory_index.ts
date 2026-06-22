import { McpTool } from '../types';
import { syncDeviceInventory, scaffoldDeviceInventory, listDeviceInventories } from './inventory';

export const inventoryTools: McpTool[] = [
  {
    name: 'list_device_inventories',
    description:
      'List all device inventory folders in docs/reference/, showing note count, ' +
      'config presence, and index.base status for each environment.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => ({
      content: [{ type: 'text', text: listDeviceInventories() }],
    }),
  },

  {
    name: 'sync_device_inventory',
    description: `Generate or refresh Obsidian base view device notes for a network environment.

Sources:
  yaml       Read from inventory/datasets/{env}/devices/*.yml  (default, no network needed)
  technitium Pull live DHCP leases from Technitium DNS (requires TECHNITIUM_*_PASS in .env)
  all        Run yaml first, then technitium (YAML provides rich detail; DHCP refreshes ip/mac/arp)

Modes:
  diff   — preview what would change without writing anything (always start here)
  update — patch fields from source; manually-set fields are preserved
  create — write notes only for devices with no existing note

Technitium adds discovery notes for devices seen on the network but not yet in YAML.
Run diff first, then update once satisfied.`,
    inputSchema: {
      type: 'object',
      properties: {
        environment: {
          type: 'string',
          description:
            'Environment to sync: bms | yeticraft | cascadesteam, or any env_id ' +
            'that has a base-view.yml in docs/reference/{env}-devices/',
        },
        mode: {
          type: 'string',
          enum: ['diff', 'update', 'create'],
          description: 'Sync mode — default: diff',
        },
        source: {
          type: 'string',
          enum: ['yaml', 'technitium', 'all'],
          description: 'Data source — default: yaml',
        },
      },
      required: ['environment'],
    },
    handler: async (args) => ({
      content: [{
        type: 'text',
        text: syncDeviceInventory(
          String(args.environment ?? ''),
          String(args.mode ?? 'diff'),
          String(args.source ?? 'yaml'),
        ),
      }],
    }),
  },

  {
    name: 'scaffold_device_inventory',
    description: `Bootstrap a new environment's device inventory — creates the base-view.yml
config template and the YAML device source directory.

After scaffolding:
  1. Edit docs/reference/{env_id}-devices/base-view.yml to tune views
  2. Add *.yml device files to inventory/datasets/{env_id}/devices/
  3. Call sync_device_inventory with mode=create`,
    inputSchema: {
      type: 'object',
      properties: {
        env_id:  { type: 'string', description: 'Short identifier — e.g. mynet' },
        name:    { type: 'string', description: 'Human-readable name — e.g. "My Network"' },
        subnet:  { type: 'string', description: 'Network CIDR — e.g. 10.20.0.0/24 (optional)' },
        gateway: { type: 'string', description: 'Gateway IP — e.g. 10.20.0.1 (optional)' },
      },
      required: ['env_id', 'name'],
    },
    handler: async (args) => ({
      content: [{
        type: 'text',
        text: scaffoldDeviceInventory(
          String(args.env_id ?? ''),
          String(args.name ?? ''),
          args.subnet  ? String(args.subnet)  : undefined,
          args.gateway ? String(args.gateway) : undefined,
        ),
      }],
    }),
  },
];
