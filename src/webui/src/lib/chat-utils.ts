/** Pure utility functions for chat/session UI — extracted for testability. */

export interface FileItem { name: string; path: string; }
export interface TreeItem { name: string; path: string; type: 'dir' | 'file'; children?: TreeItem[]; }
export interface UsageInfo { inputTokens: number; outputTokens: number; cost: number; }

export function flattenTree(items: TreeItem[], prefix = ''): FileItem[] {
  const result: FileItem[] = [];
  for (const item of items) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.type === 'file') result.push({ name: item.name, path });
    if (item.children) result.push(...flattenTree(item.children, path));
  }
  return result;
}

export function relativeTime(raw?: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function dayGroup(raw?: string): 'today' | 'yesterday' | 'older' {
  if (!raw) return 'older';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return 'older';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const ts = d.getTime();
  if (ts >= today) return 'today';
  if (ts >= yesterday) return 'yesterday';
  return 'older';
}

export function detectMention(text: string, cursorPos: number): number {
  if (cursorPos <= 0) return -1;
  const before = text.slice(0, cursorPos);
  const atIdx = before.lastIndexOf('@');
  if (atIdx < 0) return -1;
  if (atIdx > 0 && before[atIdx - 1] !== ' ' && before[atIdx - 1] !== '\n') return -1;
  const afterAt = before.slice(atIdx + 1);
  if (afterAt.includes(' ')) return -1;
  return atIdx;
}

export function filterMention(term: string, files: FileItem[], max = 50): FileItem[] {
  if (!term) return files.slice(0, max);
  return files.filter(f =>
    f.name.toLowerCase().includes(term.toLowerCase()) ||
    f.path.toLowerCase().includes(term.toLowerCase())
  ).slice(0, max);
}

export function accumulateUsage(
  map: Map<string, UsageInfo>,
  sessionID: string,
  inputTokens: number,
  outputTokens: number,
  cost: number,
): Map<string, UsageInfo> {
  const prev = map.get(sessionID);
  const result = new Map(map);
  result.set(sessionID, {
    inputTokens: (prev?.inputTokens ?? 0) + inputTokens,
    outputTokens: (prev?.outputTokens ?? 0) + outputTokens,
    cost: (prev?.cost ?? 0) + cost,
  });
  return result;
}

export function truncate(title: string | undefined, max = 32): string {
  if (!title) return 'New Chat';
  return title.length > max ? title.slice(0, max) + '…' : title;
}
