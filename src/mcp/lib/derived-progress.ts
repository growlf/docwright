import { readFile } from './paths';
import { extractFrontmatterField } from './frontmatter';

export interface ProgressCounts {
  total: number;
  completed: number;
  pending: number;
}

function isResolvedStatus(status: string): boolean {
  const resolved = ['resolved', 'completed', 'duplicate', 'deferred'];
  return resolved.includes(status.toLowerCase());
}

export function computeProgressFromIssues(trackedByPaths: string[]): ProgressCounts {
  if (!trackedByPaths || !Array.isArray(trackedByPaths) || trackedByPaths.length === 0) {
    return { total: 0, completed: 0, pending: 0 };
  }

  let completed = 0;
  let pending = 0;

  for (const issuePath of trackedByPaths) {
    try {
      const issueContent = readFile(issuePath);
      const status = extractFrontmatterField(issueContent, 'status');

      if (isResolvedStatus(String(status))) {
        completed++;
      } else {
        pending++;
      }
    } catch {
      // Issue not found or unreadable — count as pending to be conservative
      pending++;
    }
  }

  return {
    total: completed + pending,
    completed,
    pending,
  };
}

export function hasLinkedIssues(planContent: string): boolean {
  const trackedBy = extractFrontmatterField(planContent, 'tracked_by');
  return Array.isArray(trackedBy) && trackedBy.length > 0;
}

export function getProgressCounts(planContent: string): ProgressCounts {
  const trackedBy = extractFrontmatterField(planContent, 'tracked_by');

  if (Array.isArray(trackedBy) && trackedBy.length > 0) {
    return computeProgressFromIssues(trackedBy as string[]);
  }

  return { total: 0, completed: 0, pending: 0 };
}
