// Priority ranks
const PRIORITY_RANK: Record<string, number> = {
  highest: -1, critical: 0, high: 1, medium: 2, low: 3,
};

function priorityRank(p: string): number {
  const s = String(p ?? '').trim().toLowerCase();
  if (s === '') return 99;
  if (s in PRIORITY_RANK) return PRIORITY_RANK[s];
  const n = Number(s);
  if (Number.isFinite(n)) return n;
  return 99;
}

export function byPriority(
  a: { priority: string; title?: string },
  b: { priority: string; title?: string },
): number {
  const d = priorityRank(a.priority) - priorityRank(b.priority);
  return d !== 0 ? d : (a.title ?? '').localeCompare(b.title ?? '');
}

export function parseVersion(v: string): { nums: number[]; rest: string } {
  const clean = v.replace(/^v/i, '').trim();
  const parts = clean.split('.');
  const nums: number[] = [];
  const restParts: string[] = [];
  for (const p of parts) {
    const n = parseInt(p, 10);
    if (!isNaN(n)) {
      nums.push(n);
    } else {
      restParts.push(p);
    }
  }
  return { nums, rest: restParts.join('.') };
}

export function compareMilestones(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  if (aLower === 'current') return -1;
  if (bLower === 'current') return 1;
  if (aLower === 'next') {
    if (bLower === 'current') return 1;
    return -1;
  }
  if (bLower === 'next') {
    if (aLower === 'current') return -1;
    return 1;
  }

  const va = parseVersion(a);
  const vb = parseVersion(b);
  const minLen = Math.min(va.nums.length, vb.nums.length);
  for (let i = 0; i < minLen; i++) {
    if (va.nums[i] !== vb.nums[i]) {
      return va.nums[i] - vb.nums[i];
    }
  }
  if (va.nums.length !== vb.nums.length) {
    return va.nums.length - vb.nums.length;
  }
  return va.rest.localeCompare(vb.rest);
}

export function buildRoadplan(plans: any[], issues: any[], proposals: any[] = []): { current: { name: string; items: any[] }; next: { name: string; items: any[] }; future: { name: string; items: any[] } } {
  // Combine all open plans, open issues, and pending proposals, excluding phase overview plans
  const roadplanPlans = plans.filter(p => {
    const filename = p.path ? p.path.split('/').pop() : '';
    return !/^phase-/.test(filename || '');
  });
  const allItems = [
    ...roadplanPlans.map(p => ({ ...p, itemType: 'plan' })),
    ...issues.map(i => ({ ...i, itemType: 'issue' })),
    ...proposals.map(p => ({ ...p, itemType: 'proposal' })),
  ];

  // Find all unique milestone names (except the 'backlog'/'future' sentinel and empty strings).
  // The two lowest-sorting version milestones become the Current + Next buckets; everything
  // else (later versions, backlog) falls into the Backlog pool.
  const milestoneSet = new Set<string>();
  for (const item of allItems) {
    const m = String(item.milestone ?? '').trim();
    if (m && !['future', 'backlog'].includes(m.toLowerCase())) {
      milestoneSet.add(m);
    }
  }

  const sortedMilestones = [...milestoneSet].sort(compareMilestones);

  const currentName = sortedMilestones[0] || 'Current';
  const nextName = sortedMilestones[1] || 'Next';

  const currentItems: any[] = [];
  const nextItems: any[] = [];
  const futureItems: any[] = [];

  for (const item of allItems) {
    const m = String(item.milestone ?? '').trim();
    const mLower = m.toLowerCase();
    if (m === currentName || mLower === 'current') {
      currentItems.push(item);
    } else if (m === nextName || mLower === 'next') {
      nextItems.push(item);
    } else {
      futureItems.push(item);
    }
  }

  const sortBucket = (bucket: any[]) => bucket.sort((a, b) => byPriority(a, b));

  return {
    current: { name: currentName, items: sortBucket(currentItems) },
    next: { name: nextName, items: sortBucket(nextItems) },
    future: { name: 'backlog', items: sortBucket(futureItems) },
  };
}
