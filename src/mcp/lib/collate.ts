const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'not',
  'no', 'nor', 'so', 'if', 'then', 'than', 'that', 'this', 'these',
  'those', 'it', 'its', 'they', 'them', 'their', 'we', 'you', 'our',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'only', 'own', 'same', 'too', 'very', 'just',
  'about', 'above', 'after', 'again', 'against', 'because', 'before',
  'between', 'under', 'over', 'up', 'down', 'out', 'off', 'into',
]);

export function tokenize(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-zA-Z][a-zA-Z0-9]{2,}/g) || [];
  return new Set(words.filter(w => !STOP_WORDS.has(w)));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0.0;
  
  let intersectionCount = 0;
  for (const item of a) {
    if (b.has(item)) {
      intersectionCount++;
    }
  }
  
  const unionCount = a.size + b.size - intersectionCount;
  return intersectionCount / unionCount;
}
