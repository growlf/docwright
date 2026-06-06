import * as fs from 'node:fs';
import * as path from 'node:path';

export interface RelationshipEngineProfileConfig {
  auto_detect_on_create: boolean;
  auto_detect_on_update: boolean;
  auto_detect_on_approval: boolean;
  similarity_threshold: number;
  show_plan_button: boolean;
}

export interface ProfileConfig {
  docwrightProfileVersion: string;
  name: string;
  displayName: string;
  description: string;
  principles?: string[];
  proposalCategories?: string[];
  effortSizes?: Record<string, string>;
  sidebarExcludePatterns?: string[];
  hiddenDirectories?: string[];
  version: string;
  documentTypes: string[];
  states: Record<string, string[]>;
  requiredFrontmatter: string[];
  optionalFrontmatter: string[];
  features: Record<string, boolean>;
  relationshipEngine?: RelationshipEngineProfileConfig;
}

const DEFAULT_PROFILE: ProfileConfig = {
  docwrightProfileVersion: '1',
  name: 'org-operations',
  displayName: 'Org Operations',
  description: 'Organizational operating system. Policy as the foundation of all work.',
  principles: ['Security first', 'Policy driven', 'Test verified at every stage'],
  proposalCategories: ['UI', 'UX', 'ENGINE', 'DATA'],
  sidebarExcludePatterns: ['AGENTS.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'LICENSE', 'NOTICE.md', 'SECURITY.md'],
  hiddenDirectories: ['proposals/approved', 'plans/completed'],
  version: '0.1.0',
  documentTypes: ['inbox', 'issue', 'proposal', 'plan', 'policy', 'decision', 'work-item'],
  states: {
    policy:    ['draft', 'active', 'superseded', 'archived'],
    proposal:  ['inbox', 'triaged', 'evaluated', 'accepted', 'rejected'],
    plan:      ['draft', 'active', 'completed', 'canceled'],
    issue:     ['inbox', 'triaged', 'resolved', 'declined'],
    decision:  ['draft', 'final'],
    'work-item': ['backlog', 'active', 'done', 'canceled'],
    inbox:     ['new', 'triaged'],
  },
  requiredFrontmatter: ['type', 'status', 'created', 'author', 'author-role'],
  optionalFrontmatter: ['parent', 'policy-area', 'tags', 'origin', 'ai-last-action',
    'category', 'complexity', 'estimated_effort', 'depends_on', 'due_date', 'subsumed_by'],
  features: { wikilinks: true, graph: true, naming: true, llmWiki: false },
};

export function loadProfile(vaultRoot: string): ProfileConfig | null {
  const profilePath = path.join(vaultRoot, 'profile.json');
  try {
    return JSON.parse(fs.readFileSync(profilePath, 'utf-8')) as ProfileConfig;
  } catch { return null; }
}

export function getActiveProfile(vaultRoot: string): ProfileConfig {
  const custom = loadProfile(vaultRoot);
  if (custom) return custom;

  // Try bundled org-operations profile relative to this file
  const bundledPath = path.resolve(__dirname, '../../src/profiles/org-operations/profile.json');
  try {
    return JSON.parse(fs.readFileSync(bundledPath, 'utf-8')) as ProfileConfig;
  } catch { return DEFAULT_PROFILE; }
}
