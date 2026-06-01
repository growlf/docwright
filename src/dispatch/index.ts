/**
 * docwright — Dispatch Module
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  NO IMPORTS FROM 'vscode' ALLOWED IN THIS DIRECTORY         ║
 * ║  This module runs identically in:                           ║
 * ║    1. VSCodium extension host                               ║
 * ║    2. Standalone Node process (CLI / test harness)          ║
 * ║    3. Remote team daemon (Phase B+)                         ║
 * ║  If you need VS Code APIs, do it in src/extension/ only.   ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * The dispatch module is the surface-agnostic governance engine.
 * All state lives in frontmatter and index.json — never in memory
 * between calls.
 */

// Barrel export — add modules here as they are implemented
// export * from './profile';
// export * from './linter';
// export * from './templates';
// export * from './wikilinks';
// export * from './promote';
// export * from './acl';
// export * from './inbox';
// export * from './llmwiki';

export const DISPATCH_VERSION = '0.0.1';
