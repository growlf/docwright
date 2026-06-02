import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ProjectEntry {
  name: string;
  path: string;
  profile: string;
  last_session?: string;
}

export interface Registry {
  projects: ProjectEntry[];
}

const REGISTRY_FILE = '.docwright/registry.json';

export function loadRegistry(root: string): Registry {
  const filePath = path.resolve(root, REGISTRY_FILE);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as Registry;
  } catch {
    return { projects: [] };
  }
}

export function saveRegistry(root: string, registry: Registry): void {
  const filePath = path.resolve(root, REGISTRY_FILE);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(registry, null, 2), 'utf-8');
}

export function listProjects(root: string): ProjectEntry[] {
  return loadRegistry(root).projects;
}

export function updateLastSession(
  root: string,
  projectName: string,
  sessionNotePath: string
): void {
  const registry = loadRegistry(root);
  const project = registry.projects.find(p => p.name === projectName);
  if (project) {
    project.last_session = sessionNotePath;
    saveRegistry(root, registry);
  }
}

export function addProject(root: string, entry: ProjectEntry): void {
  const registry = loadRegistry(root);
  const existing = registry.projects.findIndex(p => p.name === entry.name);
  if (existing >= 0) {
    registry.projects[existing] = entry;
  } else {
    registry.projects.push(entry);
  }
  saveRegistry(root, registry);
}

export function removeProject(root: string, projectName: string): void {
  const registry = loadRegistry(root);
  registry.projects = registry.projects.filter(p => p.name !== projectName);
  saveRegistry(root, registry);
}
