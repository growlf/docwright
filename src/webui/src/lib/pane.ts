import { writable } from 'svelte/store';

export const showPropsPane = writable(false);
export const showChatPanel = writable(false);

/** Signal to layout to switch to Related tab (set by page on save-toast "Review" click) */
export const showRelatedTab = writable(false);

/** Shared collation data — written by page or layout's findRelated(), read by CollationPanel */
export const collationMatches = writable<any[]>([]);
export const collationRelationships = writable<any[]>([]);
export const collationLoading = writable(false);

/** Plan review (AI critique) panel state */
export const planReviewFindings = writable('');
export const planReviewLoading  = writable(false);
export const planReviewStatus   = writable('');
/** Plan review — improved body + changelog for accept flow */
export const planReviewImproved = writable('');
export const planReviewChanges  = writable('');

/** Proposal improvement panel state */
export const improveResult  = writable<{ improved: string; critique: string } | null>(null);
export const improveLoading = writable(false);
/** Signal from page's on-save trigger to open the Improve tab */
export const showImproveTab = writable(false);

/** Signal to switch to Review tab (set by PropertiesPane, consumed by layout) */
export const showReviewTab = writable(false);

/** Profile feature flags — gate Plan button, auto-detect, etc. */
export const featureFlags = writable({
  showPlanButton: true,
  autoDetectOnCreate: true,
  autoDetectOnUpdate: true,
  similarityThreshold: 0.35,
});
