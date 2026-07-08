import { writable } from 'svelte/store';

export const showPropsPane = writable(false);
export const showChatPanel = writable(false);

/** Signal to layout to switch to Related tab (set by page on save-toast "Review" click) */
export const showRelatedTab = writable(false);

/** Shared collation data — written by page or layout's findRelated(), read by CollationPanel */
export const collationMatches = writable<any[]>([]);
export const collationRelationships = writable<any[]>([]);
export const collationLoading = writable(false);

/** Plan review (AI critique) panel state — structured micro-calls */
export const planReviewSteps    = writable<Record<string, string>>({});
export const planReviewSections = writable<Record<string, string>>({});
export const planReviewOverview = writable('');
export const planReviewAnalyses = writable<Record<string, string>>({}); // goal, steps, gaps, preconditions
export const planReviewLoading  = writable(false);
export const planReviewStatus   = writable('');

/** Plan review working data (prompts, thinking) — for AI transparency */
export const planReviewStepsWorking    = writable<Record<string, any>>({});
export const planReviewSectionsWorking = writable<Record<string, any>>({});
export const planReviewOverviewWorking = writable<any>({});
export const planReviewAnalysesWorking = writable<Record<string, any>>({});

/** Proposal improvement panel state */
export const improveResult  = writable<{ improved: string; critique: string } | null>(null);
export const improveLoading = writable(false);
/** Tracks the current streaming phase */
export type ImprovePhase = 'improve-thinking' | 'improve-streaming' | 'critique-thinking' | 'critique-streaming' | 'done';
export const improvePhase  = writable<ImprovePhase>('improve-thinking');
/** Status message from SSE (e.g. "Creating session…", "Generating critique…") */
export const improveStatus = writable('');
/** Signal from page's on-save trigger to open the Improve tab */
export const showImproveTab = writable(false);
/** Signal from page to layout: fire handleImprove() now (used by auto-improve on new plan load) */
export const triggerImprovePending = writable(false);

/** Signal to switch to Review tab (set by PropertiesPane, consumed by layout) */
export const showReviewTab = writable(false);

/** Fingerprint of plan body at time of last review — used to detect edits since review */
export const planReviewBodyFingerprint = writable('');

/** Plan execution panel state */
export const showExecutionPanel = writable(false);
export const executingPlanName  = writable('');
/** Executor running signal — true while executor is actively executing steps */
export const executorActive  = writable(false);
/** Executor waiting signal — true when executor is blocked waiting for human input */
export const executorWaiting = writable(false);
/** Executor done signal — true briefly after execution completes (auto-clears after 6s) */
export const executorDone    = writable(false);

/** Toggle to Multi-Review panel instead of ChatPanel */
export const showMultiReview = writable(false);

/** Collected multi-review responses — populated by MultiReviewPanel, consumed by SynthesisPanel */
export const multiReviewResponses = writable<Array<{ label: string; text: string }>>([]);

/** Profile feature flags — gate Plan button, auto-detect, etc. */
export const featureFlags = writable({
  showPlanButton: true,
  autoDetectOnCreate: true,
  autoDetectOnUpdate: true,
  similarityThreshold: 0.35,
});
