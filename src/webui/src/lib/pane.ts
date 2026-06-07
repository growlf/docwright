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

/** Profile feature flags — gate Plan button, auto-detect, etc. */
export const featureFlags = writable({
  showPlanButton: true,
  autoDetectOnCreate: true,
  autoDetectOnUpdate: true,
  similarityThreshold: 0.35,
});
