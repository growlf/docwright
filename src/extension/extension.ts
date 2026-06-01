/**
 * docwright — VSCodium Extension Entry Point
 *
 * This file is the only place where VS Code API imports are permitted
 * at the top level. All business logic lives in src/dispatch/ which
 * must have ZERO VS Code API dependencies.
 *
 * See CONTRIBUTING.md and CLAUDE.md for the architectural invariants.
 */
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  console.log('docwright: activating...');

  // TODO Phase 1: Load profile engine from dispatch module
  // TODO Phase 1: Spawn opencode serve child process
  // TODO Phase 1: Register scaffolding commands
  // TODO Phase 1: Register inbox capture command
  // TODO Phase 1: Launch web UI server

  console.log('docwright: active');
}

export function deactivate(): void {
  // TODO Phase 1: Clean up child processes (opencode serve, web UI server)
}
