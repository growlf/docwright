import * as fs from 'node:fs';
import * as path from 'node:path';

export type Tier = 'observer' | 'contributor' | 'steward' | 'governance';

export interface ACLContext {
  user: string;
  tier: Tier;
}

const CONTRIBUTORS_FILE = '.docwright/contributors.json';

const TIER_RANK: Record<Tier, number> = {
  observer: 0, contributor: 1, steward: 2, governance: 3,
};

// Minimum tier required for each action
const ACTION_TIER: Record<string, Tier> = {
  read:    'observer',
  write:   'contributor',
  create:  'contributor',
  delete:  'steward',
  approve: 'steward',
  govern:  'governance',
};

export function resolveACL(vaultRoot: string, user: string): ACLContext {
  const filePath = path.join(vaultRoot, CONTRIBUTORS_FILE);
  try {
    const contributors: Record<string, Tier> = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const tier: Tier = contributors[user] ?? 'contributor';
    return { user, tier };
  } catch {
    return { user, tier: 'contributor' };
  }
}

export function canPerform(ctx: ACLContext, action: string, _documentPath: string): boolean {
  const required = ACTION_TIER[action];
  if (required === undefined) return false;
  return TIER_RANK[ctx.tier] >= TIER_RANK[required];
}

export function requireTier(ctx: ACLContext, minimum: Tier): boolean {
  return TIER_RANK[ctx.tier] >= TIER_RANK[minimum];
}
