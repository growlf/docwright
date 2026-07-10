<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { rightPanelClaim, type RightPanelClaim, vcRegistryVersion } from '$lib/pluginPanel.js';
  import ViewContainerMount from '$lib/ViewContainerMount.svelte';
  import { searchFocusTrigger } from '$lib/searchFocus.js';
  import { filesSearchQuery } from '$lib/filesVc.js';
  import { govSearchQuery } from '$lib/govVc.js';
  import { gitSearchQuery } from '$lib/gitVc.js';
  import { setupCoreVCs } from '$lib/coreVCs.js';
  import { page } from '$app/stores';
  import { fileChanged } from '$lib/fileChanges';
  import { toasts, dismissToast, showToast } from '$lib/toast';
  import { notifications, notificationCounts } from '$lib/notifications';
import type { ImprovePhase } from '$lib/pane';
import {
  showPropsPane, showChatPanel, showMultiReview, showRelatedTab, collationMatches, collationRelationships, collationLoading, featureFlags, planReviewSteps, planReviewSections, planReviewAnalyses, planReviewOverview, planReviewLoading, planReviewStatus, planReviewBodyFingerprint, improveResult, improveLoading, improvePhase, improveStatus, showImproveTab, showReviewTab, triggerImprovePending,
  showExecutionPanel, executingPlanName, executorActive, executorWaiting, executorDone
} from '$lib/pane';
  import ChatPanel from '$lib/ChatPanel.svelte';
  import MultiReviewPanel from '$lib/MultiReviewPanel.svelte';
  import Panel from '$lib/Panel.svelte';
  import PropertiesPane from '$lib/PropertiesPane.svelte';
  import CollationPanel from '$lib/CollationPanel.svelte';
  import PlanReviewPanel from '$lib/PlanReviewPanel.svelte';
  import AgentActivityView from '$lib/AgentActivityView.svelte';
  import { reduceEvents, assistantMessageTexts } from '$lib/agent-activity-model';
  import { stripAIWrapper } from '$lib/ai-text';
  import PlanExecutePanel from '$lib/PlanExecutePanel.svelte';
  import ImprovementPanel from '$lib/ImprovementPanel.svelte';
  import UserBadge from '$lib/UserBadge.svelte';
  import { currentDoc } from '$lib/currentDoc';
  import type { LayoutData } from './$types.js';

  let { data }: { data: LayoutData } = $props();

  // If on login page, render without app chrome (reactive)
  const isLoginPage = $derived($page.url.pathname === '/login');

  let vaultVersion = $state<string>('');
  onMount(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const statusData = await res.json();
        vaultVersion = statusData.version ?? '';
      }
    } catch {
      // fail silently
    }
  });

  interface BrandConfig { name: string; logoPath: string | null; }

  let brand = $state<BrandConfig>({ name: 'DocWright', logoPath: null });
  let activePlugins = $state<{ name: string; displayName: string; icon: string; order: number; searchable: boolean; defaultRoute: string }[]>([]);

  // AI model picker
  let aiModels    = $state<{ id: string; providerID: string; name: string }[]>([]);
  let aiModel     = $state('');
  let aiModelSaving = $state(false);
  async function loadAiModels() {
    if (aiModels.length) return;
    const res = await fetch('/api/opencode-model');
    if (res.ok) { const d = await res.json(); aiModels = d.models ?? []; aiModel = d.current ?? ''; }
  }
  async function setAiModel(m: string) {
    aiModel = m;
    aiModelSaving = true;
    await fetch('/api/opencode-model', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: m }) });
    aiModelSaving = false;
    showToast(`Model set to ${m} — takes effect on next AI call`, 4000);
  }
  let showNewMenu  = $state(false);
  let showNewProposalDialog = $state(false);
  let newProposalDesc     = $state('');
  let newProposalCategory = $state('feature');
  let newProposalPriority = $state('medium');
  let newProposalTitle    = $state('');
  let newProposalTitleGenerated = $state(false);
  const PRIORITY_LABELS: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
  const CATEGORY_LABELS: Record<string, string> = { feature: '✨ Feature', bug: '🐛 Bug', thought: '💭 Thought' };
  type ProposalDialogStep = 'form' | 'checking' | 'matches' | 'confirm-title';
  let newProposalStep = $state<ProposalDialogStep>('form');
  let newProposalMatches = $state<Array<{path:string;title:string;score:number;type:string;reason:string}>>([]);
  let improveIsCritiqueOnly = $state(false);
  let critiqueBodyFingerprint = $state('');
  const mobile = () => typeof window !== 'undefined' && window.innerWidth <= 768;
  let showSidebar    = $state(!mobile());
  let leftView       = $state<string>(
    typeof localStorage !== 'undefined' ? (localStorage.getItem('dw-left-view') ?? 'governance') : 'governance'
  );

  // Core VC registry — insertion order = activity bar order.
  // External plugins use leftView === 'plugin-<name>'; core VCs use their plain name.
  const CORE_VCS = new Map([
    ['governance', { order: 10, icon: '🏛', label: 'Governance Engine', searchable: true,  defaultRoute: '/status' }],
    ['files',      { order: 20, icon: '📄', label: 'Files',             searchable: true,  defaultRoute: '/docs/roadmap' }],
    ['search',     { order: 25, icon: '🔍', label: 'Search (Ctrl+K)',   searchable: false, defaultRoute: '/search' }],
    ['git',        { order: 40, icon: '⎇', label: 'Git',               searchable: true,  defaultRoute: '/git' }],
  ]);
  $effect(() => { if (typeof localStorage !== 'undefined') localStorage.setItem('dw-left-view', leftView); });
  type Theme = 'dark' | 'light' | 'system';
  const THEMES: Theme[] = ['dark', 'light', 'system'];
  const THEME_ICONS: Record<Theme, string> = { dark: '🌙', light: '☀️', system: '💻' };
  let theme = $state<Theme>('dark');

  function applyTheme(t: Theme) {
    theme = t;
    if (typeof localStorage !== 'undefined') localStorage.setItem('dw-theme', t);
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', t);
  }
  function cycleTheme() { applyTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]); }
  let showRightPanel = $state(!mobile());
  let rightTab     = $state<'properties' | 'related' | 'review' | 'improve' | 'execute'>('properties');

  // Live plan-review (LIVE_AI_REVIEW): when the server returns a live session, the
  // review renders in AgentActivityView fed by /api/ai/stream instead of PlanReviewPanel.
  let reviewIsLive = $state(false);
  let liveReviewEvents = $state<any[]>([]);
  let liveReviewES: EventSource | null = null;

  // Live Improve (LIVE_AI_IMPROVE): stream generation in AgentActivityView, then
  // hand the extracted {improved, critique} to ImprovementPanel for the Apply step.
  let improveIsLive = $state(false);
  let liveImproveEvents = $state<any[]>([]);
  let liveImproveES: EventSource | null = null;

  // Live-AI presence chip (3.6): busy when any of the current user's owned
  // sessions is generating (fed by /api/ai/presence, a bus-wide session.status tap).
  let aiBusy = $state(false);
  let aiBusyCount = $state(0);
  $effect(() => {
    const es = new EventSource('/api/ai/presence');
    es.onmessage = (e) => {
      try { const p = JSON.parse(e.data); aiBusy = !!p.busy; aiBusyCount = p.count ?? 0; } catch { /* ignore */ }
    };
    return () => es.close();
  });

  // Right panel priority model — null = no VC claim, show standard tabs
  let rpc = $state<RightPanelClaim | null>(null);
  $effect(() => { const u = rightPanelClaim.subscribe(v => { rpc = v; if (v) showRightPanel = true; }); return u; });

  // Unified bridge — window.__docwright is the single entry point for all plugins.
  // registerView() stores VCs in the __dw_plugins Map; ViewContainerMount activates them.
  onMount(() => {
    if (!(window as any).__dw_plugins) (window as any).__dw_plugins = new Map<string, any>();
    const bridge = {
      toast: (msg: string, dur?: number) => showToast(msg, dur ?? 4000),
      notify: (opts: { type: string; title: string; message: string; persistent?: boolean }) => {
        notifications.add({ type: opts.type as any, title: opts.title, message: opts.message, persistent: opts.persistent ?? false });
      },
      claimRightPanel: (html: string, label?: string) => {
        rightPanelClaim.set({ html, label: label ?? 'Info' });
      },
      releaseRightPanel: () => rightPanelClaim.set(null),
      navigate: (path: string) => goto(path),
      openDocument: (vaultPath: string) => goto('/' + vaultPath.replace(/\.md$/, '')),
      apiBase: '/api',
      vaultRoot: '',
      apiVersion: '1',
      // ── Specialist AI roles ───────────────────────────────────────────────
      // Single-turn specialist call. Returns the AI response as a string.
      aiSpecialist: async (role: string, prompt: string): Promise<string> => {
        const res = await fetch('/api/ai-specialist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, prompt }),
        });
        if (!res.ok) throw new Error(`aiSpecialist(${role}) failed: ${res.status}`);
        const data = await res.json() as { text?: string; error?: string };
        if (data.error) throw new Error(data.error);
        return data.text ?? '';
      },
      // Streaming-style interface backed by aiSpecialist (single emission).
      // Real token-by-token streaming (for plan-executor) is a future enhancement.
      aiSpecialistStream: (role: string, prompt: string) => {
        type Handler = (data: unknown) => void;
        const handlers: Record<string, Handler[]> = {};
        const ee = {
          on(event: string, fn: Handler) { handlers[event] = [...(handlers[event] ?? []), fn]; return ee; },
        };
        (async () => {
          try {
            const res = await fetch('/api/ai-specialist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role, prompt }),
            });
            if (!res.ok) throw new Error(`aiSpecialistStream(${role}) failed: ${res.status}`);
            const data = await res.json() as { text?: string; error?: string };
            if (data.error) throw new Error(data.error);
            const text = data.text ?? '';
            (handlers['token'] ?? []).forEach(fn => fn(text));
            (handlers['done']  ?? []).forEach(fn => fn({ text }));
          } catch (err) {
            (handlers['error'] ?? []).forEach(fn => fn(err));
          }
        })();
        return ee;
      },
      // List of available specialist role IDs — for plugin discovery.
      aiRoles: ['doc-reviewer', 'doc-improver', 'plan-executor', 'doc-assistant'] as string[],
    };
    (window as any).__docwright = {
      bridge,
      registerView: (name: string, vc: any) => {
        if (!vc || typeof vc.mount !== 'function' || typeof vc.unmount !== 'function') {
          const errorMsg = `Plugin "${name}" does not comply with the DWViewContainer specification (missing mount/unmount functions).`;
          console.error(`[DocWright] ${errorMsg}`);
          showToast(errorMsg, 4000);
          return;
        }
        (window as any).__dw_plugins.set(name, vc);
        vcRegistryVersion.update(n => n + 1); // signals ViewContainerMount to retry
      },
    };
    // Register all core View Containers (Governance, Search, Tags, Git, Files).
    // All view-specific imports live in coreVCs.ts — layout stays view-agnostic.
    setupCoreVCs({
      onNewMenu:        () => { showNewMenu = !showNewMenu; },
      filesSearchQuery,
      govSearchQuery,
      gitSearchQuery,
    });
  });

  let applyingReview = $state(false);

  // Subscribe to shared collation stores
  let cm = $state<any[]>([]); $effect(() => { const u = collationMatches.subscribe(v => cm = v); return u; });
  let cr = $state<any[]>([]); $effect(() => { const u = collationRelationships.subscribe(v => cr = v); return u; });
  let cl = $state(false);     $effect(() => { const u = collationLoading.subscribe(v => cl = v); return u; });
  let prSteps    = $state<Record<string, string>>({}); $effect(() => { const u = planReviewSteps.subscribe(v => prSteps = v); return u; });
  let prSections = $state<Record<string, string>>({}); $effect(() => { const u = planReviewSections.subscribe(v => prSections = v); return u; });
  let prAnalyses = $state<Record<string, string>>({}); $effect(() => { const u = planReviewAnalyses.subscribe(v => prAnalyses = v); return u; });
  let prOverview = $state(''); $effect(() => { const u = planReviewOverview.subscribe(v => prOverview = v); return u; });
  let prl = $state(false);    $effect(() => { const u = planReviewLoading.subscribe(v => prl = v); return u; });
  let prs = $state('');       $effect(() => { const u = planReviewStatus.subscribe(v => prs = v); return u; });
  let prFingerprint = $state(''); $effect(() => { const u = planReviewBodyFingerprint.subscribe(v => prFingerprint = v); return u; });
  let prStepsPrompts = $state<Record<string, any>>({});
  let prStepsThinking = $state<Record<string, string>>({});
  let prSectionsPrompts = $state<Record<string, any>>({});
  let prSectionsThinking = $state<Record<string, string>>({});
  let prAnalysesPrompts = $state<Record<string, any>>({});
  let prAnalysesThinking = $state<Record<string, string>>({});
  let prOverviewPrompt = $state<any>({});
  let prOverviewThinking = $state('');
  let ir  = $state<{ improved: string; critique: string } | null>(null);
                              $effect(() => { const u = improveResult.subscribe(v => ir = v); return u; });
  let il  = $state(false);    $effect(() => { const u = improveLoading.subscribe(v => il = v); return u; });
  let ip  = $state<ImprovePhase>('improve-thinking');
                              $effect(() => { const u = improvePhase.subscribe(v => ip = v); return u; });
  let ist = $state('');       $effect(() => { const u = improveStatus.subscribe(v => ist = v); return u; });
  // Auto-improve signal from page (e.g. ?from=proposal on new plan load)
  $effect(() => {
    const u = triggerImprovePending.subscribe(v => {
      if (v) { triggerImprovePending.set(false); handleImprove(); }
    });
    return u;
  });

  // Fetch profile feature flags on mount
  onMount(async () => {
    try {
      const res = await fetch('/api/profile-config');
      if (res.ok) {
        const cfg = await res.json();
        const rel = cfg.relationshipEngine ?? {};
        featureFlags.set({
          showPlanButton: rel.show_plan_button !== false,
          autoDetectOnCreate: rel.auto_detect_on_create !== false,
          autoDetectOnUpdate: rel.auto_detect_on_update !== false,
          similarityThreshold: rel.similarity_threshold ?? 0.35,
        });
      }
    } catch { /* use defaults */ }
  });

  // On nav: clear stale collation data; honour active tab.
  // GUARD: only clear on an ACTUAL file change. $currentDoc also updates on
  // same-file SSE watch-reloads; without this guard those reloads wiped in-progress
  // or finished Improve/Review results (and switched the tab away) with no Apply
  // decision — the "results vanish" bug (issues/bug-improve-flow-discards-*).
  let lastNavPath: string | null = null;
  $effect(() => {
    const fp = $currentDoc.filePath;
    if (fp === lastNavPath) return; // same-doc reload — keep AI panels intact
    lastNavPath = fp;
    collationMatches.set([]);
    collationRelationships.set([]);
    collationLoading.set(false);
    planReviewSteps.set({});
    planReviewSections.set({});
    planReviewOverview.set('');
    planReviewLoading.set(false);
    planReviewStatus.set('');
    planReviewBodyFingerprint.set('');
    improveResult.set(null);
    improveLoading.set(false);
    improvePhase.set('improve-thinking');
    improveStatus.set('');
    improveIsCritiqueOnly = false;
    if (liveImproveES) { liveImproveES.close(); liveImproveES = null; }
    improveIsLive = false;
    liveImproveEvents = [];
    // untrack: rightTab reads/writes must not become effect dependencies —
    // otherwise setting rightTab='review' in handleReview() would re-trigger
    // this effect and immediately reset it back to 'properties'.
    untrack(() => {
      const fromProposal = $page.url.searchParams.get('from') === 'proposal';
      if (fromProposal) {
        rightTab = 'properties';
      } else {
        if (rightTab === 'related' && fp) findRelated(fp);
        if (rightTab === 'review') rightTab = 'properties';
        if (rightTab === 'improve') rightTab = 'properties';
      }
    });
  });

  // React to page's signal to switch to Related tab
  $effect(() => {
    const trigger = $showRelatedTab;
    if (trigger) {
      rightTab = 'related';
      showRightPanel = true;
      showRelatedTab.set(false);
      if ($currentDoc.filePath) findRelated($currentDoc.filePath);
    }
  });

  async function findRelated(filePath: string) {
    if (!filePath) return;
    rightTab = 'related';
    showRightPanel = true;
    collationLoading.set(true);
    collationMatches.set([]);
    collationRelationships.set([]);
    const res = await fetch('/api/overlap?path=' + encodeURIComponent(filePath));
    collationLoading.set(false);
    if (res.ok) {
      const data = await res.json();
      collationMatches.set(data.matches || []);
      collationRelationships.set(data.relationships || []);
    }
  }

  async function handleCreatePlan() {
    const fp = $currentDoc.filePath;
    if (!fp) return;
    const fm = $currentDoc.frontmatter;
    if (!fm) return;
    const res = await fetch('/api/create-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Plan: ' + (fm.title || fp),
        candidates: [fp.replace(/\.md$/, '')],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      goto('/' + data.path.replace(/\.md$/, '') + '?from=proposal');
      collationMatches.set([]);
      collationRelationships.set([]);
    } else if (res.status === 409) {
      const data = await res.json();
      if (data.path) {
        showToast('Plan already exists — opening it', 3000);
        goto('/' + data.path.replace(/\.md$/, ''));
        collationMatches.set([]);
        collationRelationships.set([]);
      }
    }
  }

  async function handleReview() {
    const fp = $currentDoc.filePath;
    if (!fp) return;
    rightTab = 'review';
    showRightPanel = true;
    planReviewSteps.set({});
    planReviewSections.set({});
    planReviewAnalyses.set({});
    planReviewOverview.set('');
    planReviewStatus.set('');
    prStepsPrompts = {};
    prStepsThinking = {};
    prSectionsPrompts = {};
    prSectionsThinking = {};
    prAnalysesPrompts = {};
    prAnalysesThinking = {};
    prOverviewPrompt = {};
    prOverviewThinking = '';
    // reset any prior live-review stream
    if (liveReviewES) { liveReviewES.close(); liveReviewES = null; }
    reviewIsLive = false;
    liveReviewEvents = [];
    planReviewLoading.set(true);
    try {
      const res = await fetch('/api/plan-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fp }),
      });
      // Live path: server created an owned session → render AgentActivityView from /api/ai/stream.
      if (res.headers.get('content-type')?.includes('application/json')) {
        const info = await res.json().catch(() => ({}));
        if (info?.live && info?.sessionID) {
          startLiveReview(info.sessionID, fp);
          return;
        }
      }
      const reader = res.body?.getReader();
      if (!reader) { planReviewStatus.set('No response stream'); return; }
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          const lines = part.split('\n');
          const eventLine = lines.find(l => l.startsWith('event: '));
          const dataLine = lines.find(l => l.startsWith('data: '));
          if (!dataLine) continue;
          const event = eventLine ? eventLine.slice(7).trim() : '';
          try {
            const data = JSON.parse(dataLine.slice(6));
            if (event === 'working-prompt') {
              if (data.aspect) {
                prAnalysesPrompts[data.aspect] = data;
              } else if (data.type === 'step') {
                prStepsPrompts[data.key] = data;
              } else if (data.type === 'section') {
                prSectionsPrompts[data.key] = data;
              } else if (data.type === 'overview') {
                prOverviewPrompt = data;
              }
            } else if (event === 'working-thinking') {
              if (data.aspect) {
                prAnalysesThinking[data.aspect] = data.thinking;
              } else if (data.type === 'step') {
                prStepsThinking[data.key] = data.thinking;
              } else if (data.type === 'section') {
                prSectionsThinking[data.key] = data.thinking;
              } else if (data.type === 'overview') {
                prOverviewThinking = data.thinking;
              }
            } else if (event === 'step-review') {
              planReviewSteps.update(s => { s[data.number] = data.text; return s; });
            } else if (event === 'section-review') {
              planReviewSections.update(s => { s[data.name] = data.text; return s; });
            } else if (event === 'analysis') {
              planReviewAnalyses.update(a => { a[data.aspect] = data.text; return a; });
            } else if (event === 'overview') {
              planReviewOverview.set(data.text);
            } else if (event === 'status') {
              planReviewStatus.set(data.message);
            } else if (event === 'done') {
              if (data.error) planReviewOverview.set(`Error: ${data.error}`);
            }
          } catch { /* skip malformed JSON */ }
        }
      }
    } catch (e: any) {
      planReviewOverview.set(`Error: ${e}`);
    } finally {
      planReviewLoading.set(false);
      planReviewStatus.set('');
      // Store body fingerprint so we can detect edits since last review
      const body = $currentDoc?.body;
      if (body) planReviewBodyFingerprint.set(body.length + ':' + body.slice(0, 100));
    }
  }

  // Live review: subscribe to the per-session event stream, then tell the server
  // to drive the prompts. Progress renders in AgentActivityView; completion is
  // detected by counting session.idle events (one per prompt turn).
  function startLiveReview(sessionID: string, planPath: string) {
    reviewIsLive = true;
    liveReviewEvents = [];
    planReviewStatus.set('');
    let expected = Infinity;
    let idleCount = 0;

    const es = new EventSource(`/api/ai/stream?session=${encodeURIComponent(sessionID)}`);
    liveReviewES = es;

    function finishLive() {
      planReviewLoading.set(false);
      if (liveReviewES) { liveReviewES.close(); liveReviewES = null; }
      const body = $currentDoc?.body;
      if (body) planReviewBodyFingerprint.set(body.length + ':' + body.slice(0, 100));
    }

    es.onopen = async () => {
      try {
        const r = await fetch('/api/plan-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start', sessionID, path: planPath }),
        });
        const info = await r.json().catch(() => ({}));
        if (typeof info?.prompts === 'number') expected = info.prompts;
        if (!r.ok) { planReviewStatus.set('Failed to start review'); finishLive(); }
      } catch {
        planReviewStatus.set('Failed to start review');
        finishLive();
      }
    };

    es.onmessage = (e) => {
      let evt: any;
      try { evt = JSON.parse(e.data); } catch { return; }
      liveReviewEvents = [...liveReviewEvents, evt];
      if (evt?.type === 'session.idle') {
        idleCount++;
        if (idleCount >= expected) finishLive();
      }
    };

    es.onerror = () => { if (idleCount >= expected) finishLive(); };
  }

  // Live Improve/Critique: subscribe to the session stream, tell the server to run
  // the improve+critique turns, then extract the structured result for Apply.
  function startLiveImprove(sessionID: string, docPath: string, mode: 'full' | 'critique') {
    improveIsLive = true;
    liveImproveEvents = [];
    rightTab = 'improve';
    showRightPanel = true;
    improveResult.set(null);
    improvePhase.set(mode === 'critique' ? 'critique-thinking' : 'improve-thinking');
    let expected = Infinity;
    let idleCount = 0;

    const es = new EventSource(`/api/ai/stream?session=${encodeURIComponent(sessionID)}`);
    liveImproveES = es;

    function finishImprove() {
      if (liveImproveES) { liveImproveES.close(); liveImproveES = null; }
      const state = reduceEvents(liveImproveEvents);
      const msgs = assistantMessageTexts(state); // one per turn (improve, critique)
      let improved = '';
      let critique = '';
      if (mode === 'critique') {
        critique = (msgs[0] ?? '').trim();
      } else {
        improved = stripAIWrapper(msgs[0] ?? '');
        critique = (msgs[1] ?? '').trim();
      }
      improveResult.set({ improved, critique });
      improvePhase.set('done');
      improveLoading.set(false);
      improveIsLive = false; // hand off to ImprovementPanel for the Apply decision
    }

    es.onopen = async () => {
      try {
        const r = await fetch('/api/improve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start', sessionID, path: docPath, mode }),
        });
        const info = await r.json().catch(() => ({}));
        if (typeof info?.prompts === 'number') expected = info.prompts;
        if (!r.ok) { showToast('Failed to start improve', 4000); finishImprove(); }
      } catch {
        showToast('Failed to start improve', 4000);
        finishImprove();
      }
    };

    es.onmessage = (e) => {
      let evt: any;
      try { evt = JSON.parse(e.data); } catch { return; }
      liveImproveEvents = [...liveImproveEvents, evt];
      if (evt?.type === 'session.idle') {
        idleCount++;
        if (idleCount >= expected) finishImprove();
      }
    };

    es.onerror = () => { if (idleCount >= expected) finishImprove(); };
  }

  // React to signal to switch to Review tab (just show tab, don't auto-run)
  $effect(() => {
    if ($showReviewTab) {
      rightTab = 'review';
      showRightPanel = true;
      showReviewTab.set(false);
    }
  });

  // React to signal to switch to Execute tab
  $effect(() => {
    if ($showExecutionPanel) {
      rightTab = 'execute';
      showRightPanel = true;
      showExecutionPanel.set(false);
    }
  });

  // React to on-save trigger from page signalling to open Improve tab
  $effect(() => {
    if ($showImproveTab) {
      rightTab = 'improve';
      showRightPanel = true;
      showImproveTab.set(false);
    }
  });

  async function handleCritique() {
    const fp = $currentDoc.filePath;
    if (!fp) return;
    improveIsCritiqueOnly = true;
    critiqueBodyFingerprint = $currentDoc.body
      ? $currentDoc.body.length + ':' + $currentDoc.body.slice(0, 100) : '';
    rightTab = 'improve';
    showRightPanel = true;
    improveResult.set(null);
    improveLoading.set(true);
    improvePhase.set('critique-thinking');
    improveStatus.set('');
    showToast('Reviewing proposal — AI may take a moment…', 6000);
    try {
      const res = await fetch('/api/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fp, mode: 'critique' }),
      });
      if (res.headers.get('content-type')?.includes('application/json')) {
        const info = await res.json().catch(() => ({}));
        if (info?.live && info?.sessionID) { startLiveImprove(info.sessionID, fp, 'critique'); return; }
      }
      const reader = res.body?.getReader();
      if (!reader) { showToast('No response stream', 4000); return; }
      const decoder = new TextDecoder();
      let buffer = '';
      let critiqueAccum = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          const lines = part.split('\n');
          const eventLine = lines.find(l => l.startsWith('event: '));
          const dataLine = lines.find(l => l.startsWith('data: '));
          if (!dataLine) continue;
          const event = eventLine ? eventLine.slice(7).trim() : '';
          try {
            const data = JSON.parse(dataLine.slice(6));
            if (event === 'token' && data.phase === 'critique') {
              critiqueAccum += data.text;
              improveResult.set({ improved: '', critique: critiqueAccum });
            } else if (event === 'stage') {
              improvePhase.set(data.phase);
              improveStatus.set('');
            } else if (event === 'status') {
              improveStatus.set(data.message);
            } else if (event === 'done') {
              improveResult.set({ improved: '', critique: data.critique || critiqueAccum });
              improvePhase.set('done');
            }
          } catch { /* skip */ }
        }
      }
    } catch (e: any) {
      showToast(`Review error: ${e}`, 4000);
      rightTab = 'properties';
    } finally {
      improveLoading.set(false);
    }
  }

  async function handleImprove() {
    const fp = $currentDoc.filePath;
    if (!fp) return;
    improveIsCritiqueOnly = false;
    rightTab = 'improve';
    showRightPanel = true;
    improveResult.set(null);
    improveLoading.set(true);
    improvePhase.set('improve-thinking');
    improveStatus.set('');
    showToast('Improving proposal — AI may take up to a minute…', 8000);
    try {
      const res = await fetch('/api/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fp }),
      });
      if (res.headers.get('content-type')?.includes('application/json')) {
        const info = await res.json().catch(() => ({}));
        if (info?.live && info?.sessionID) { startLiveImprove(info.sessionID, fp, 'full'); return; }
      }
      const reader = res.body?.getReader();
      if (!reader) { showToast('No response stream', 4000); return; }
      const decoder = new TextDecoder();
      let buffer = '';
      let improvedAccum = '';
      let critiqueAccum = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          const lines = part.split('\n');
          const eventLine = lines.find(l => l.startsWith('event: '));
          const dataLine = lines.find(l => l.startsWith('data: '));
          if (!dataLine) continue;
          const event = eventLine ? eventLine.slice(7).trim() : '';
          try {
            const data = JSON.parse(dataLine.slice(6));
            if (event === 'token') {
              if (data.phase === 'critique') {
                critiqueAccum += data.text;
              } else {
                improvedAccum += data.text;
              }
              improveResult.set({ improved: improvedAccum, critique: critiqueAccum });
            } else if (event === 'stage') {
              improvePhase.set(data.phase);
              improveStatus.set('');
            } else if (event === 'status') {
              improveStatus.set(data.message);
            } else if (event === 'done') {
              improveResult.set({
                improved: data.improved || improvedAccum,
                critique: data.critique || critiqueAccum,
              });
              improvePhase.set('done');
            }
          } catch { /* skip malformed JSON */ }
        }
      }
    } catch (e: any) {
      showToast(`Improve error: ${e}`, 4000);
      rightTab = 'properties';
    } finally {
      improveLoading.set(false);
    }
  }

  /** Append a "## Document History" entry to a markdown body. */
  function appendDocHistory(body: string, change: string, author: string): string {
    const now = new Date().toISOString().slice(0, 10);
    const row = `| ${now} | ${change} | ${author} |\n`;
    const histMatch = body.match(/^## Document History\s*$/m);
    if (histMatch) {
      // Table exists — find the separator line and insert after it
      const before = body.slice(0, histMatch.index!);
      const after = body.slice(histMatch.index!);
      const sepMatch = after.match(/^\|[-| ]+\|\n/m);
      if (sepMatch) {
        const insertAt = histMatch.index! + sepMatch.index! + sepMatch[0].length;
        return body.slice(0, insertAt) + row + body.slice(insertAt);
      }
      // No separator found — append table after heading
      return body + `\n| Date | Change | Author |\n|------|--------|--------|\n${row}`;
    }
    // No Document History at all — append section
    return `${body}\n\n## Document History\n\n| Date | Change | Author |\n|------|--------|--------|\n${row}`;
  }

  async function handleAcceptImprove(improved: string) {
    const fp = $currentDoc.filePath;
    if (!fp || !improved) return;
    // Resolve author for Document History
    let author = 'DocWright Improve';
    try {
      const idRes = await fetch('/api/git/config?key=user.name');
      if (idRes.ok) { const v = await idRes.json(); if (v.value) author = v.value; }
    } catch {}
    // Append Document History entry
    const bodyWithHistory = appendDocHistory(improved, 'AI-improved via Improve', author);
    // Rebuild file: original frontmatter + improved body (with history)
    const fm = $currentDoc.frontmatter ?? {};
    const fmLines = Object.entries(fm)
      .filter(([k]) => k !== '_path')
      .map(([k, v]) => {
        if (Array.isArray(v)) return v.length ? `${k}:\n${v.map(i => `  - ${i}`).join('\n')}` : `${k}: []`;
        if (typeof v === 'boolean') return `${k}: ${v}`;
        if (v === null || v === undefined || v === '') return `${k}:`;
        return `${k}: ${v}`;
      }).join('\n');
    const newRaw = `---\n${fmLines}\n---\n${bodyWithHistory}`;
    const res = await fetch('/api/write?path=' + encodeURIComponent(fp), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newRaw }),
    });
    if (res.ok) {
      showToast('Proposal updated with AI suggestions', 3000);
      rightTab = 'properties';
      improveResult.set(null);
    }
  }

  async function handleApplyReview() {
    const fp = $currentDoc.filePath;
    if (!fp || applyingReview) return;
    applyingReview = true;
    planReviewLoading.set(true);
    planReviewStatus.set('Applying review...');
    try {
      const res = await fetch('/api/apply-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: fp,
          steps: prSteps,
          sections: prSections,
          overview: prOverview,
        }),
      });
      if (!res.ok) { showToast('Apply review failed', 3000); return; }
      const data = await res.json();
      if (data.error) { showToast(data.error, 3000); return; }

      // If the server returned structural notes but no improved body, show them in the panel
      if (!data.improved) {
        if (data.structuralNotes) {
          planReviewOverview.set('**Structural notes (not applied):**\n\n' + data.structuralNotes);
          showToast('Step text already optimal — structural notes updated in review panel', 4000);
        } else {
          showToast('No text improvements generated', 3000);
        }
        return;
      }

      let author = 'DocWright Review';
      try {
        const idRes = await fetch('/api/git/config?key=user.name');
        if (idRes.ok) { const v = await idRes.json(); if (v.value) author = v.value; }
      } catch {}
      const bodyWithHistory = appendDocHistory(data.improved, 'AI-improved via Review', author);
      const fm = { ...($currentDoc.frontmatter ?? {}) };
      // Bug 1 fix: only demote to draft if plan was in-progress; approved/draft stay as-is
      if (fm.status === 'in-progress') fm.status = 'draft';
      // Bug 2 fix: preserve _path (recalculate from the file path, don't drop it)
      fm._path = fp;
      const fmLines = Object.entries(fm)
        .map(([k, v]) => {
          if (Array.isArray(v)) return v.length ? `${k}:\n${v.map(i => `  - ${i}`).join('\n')}` : `${k}: []`;
          if (typeof v === 'boolean') return `${k}: ${v}`;
          if (v === null || v === undefined || v === '') return `${k}:`;
          // Bug 3 fix: quote strings that contain YAML-special sequences
          const s = String(v);
          const needsQuotes = /[:#\[\]{},&*?|<>=!%@`]/.test(s) || /^[\s\-"'`]/.test(s) || s.includes('\n');
          return needsQuotes ? `${k}: "${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : `${k}: ${s}`;
        }).join('\n');
      const newRaw = `---\n${fmLines}\n---\n${bodyWithHistory}`;
      const writeRes = await fetch('/api/write?path=' + encodeURIComponent(fp), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newRaw }),
      });
      if (writeRes.ok) {
        const wasStepGeneration = data.generatedSteps === true;
        showToast(wasStepGeneration ? 'Implementation steps generated from analysis' : 'Plan updated with review suggestions', 3000);
        if (!wasStepGeneration) rightTab = 'properties';
        planReviewSteps.set({});
        planReviewSections.set({});
        // Bug 4 fix: show structural notes in the review panel instead of writing them to the file
        if (data.structuralNotes) {
          planReviewOverview.set('**Structural notes:**\n\n' + data.structuralNotes);
        } else {
          planReviewOverview.set('');
        }
      } else {
        showToast('Failed to save plan improvements', 3000);
      }
    } finally {
      applyingReview = false;
      planReviewLoading.set(false);
      planReviewStatus.set('');
    }
  }

  let canRerun = $derived(
    !!($currentDoc.body) && !!prFingerprint &&
    ($currentDoc.body.length + ':' + $currentDoc.body.slice(0, 100)) !== prFingerprint
  );

  // Close sidebar on navigation (mobile only)
  $effect(() => {
    $page.url;
    if (mobile()) { showSidebar = false; showRightPanel = false; }
  });

  function toggleSidebar() { showSidebar = !showSidebar; }
  function closeMenus() { showNewMenu = false; }

  function newFile() {
    showNewMenu = false;
    let name = prompt('New file path (e.g. docs/my-doc.md):');
    if (!name) return;
    if (!name.endsWith('.md')) name += '.md';
    fetch('/api/write?path=' + encodeURIComponent(name), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '# ' + name.replace(/\.md$/, '') + '\n\n' }),
    }).then(r => {
      if (r.ok) goto('/' + name.replace(/\.md$/, ''));
    });
  }

  function newProposal() {
    showNewMenu = false;
    newProposalDesc = '';
    newProposalCategory = 'feature';
    newProposalPriority = 'medium';
    newProposalTitle = '';
    newProposalTitleGenerated = false;
    newProposalStep = 'form';
    newProposalMatches = [];
    showNewProposalDialog = true;
  }

  async function checkAndSubmitProposal() {
    const desc = newProposalDesc.trim();
    if (!desc) return;
    newProposalStep = 'checking';

    // Run overlap check and title generation in parallel
    const [overlapRes, titleRes] = await Promise.allSettled([
      fetch('/api/overlap/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc }),
      }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc, category: newProposalCategory }),
      }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]);

    const overlapData = overlapRes.status === 'fulfilled' ? overlapRes.value : null;
    const titleData   = titleRes.status  === 'fulfilled' ? titleRes.value  : null;

    newProposalTitle = titleData?.title ?? desc.split(/[.\n]/)[0].slice(0, 80);
    newProposalTitleGenerated = titleData?.generated ?? false;

    if (overlapData?.matches?.length > 0) {
      newProposalMatches = overlapData.matches;
      newProposalStep = 'matches';
      return;
    }

    newProposalStep = 'confirm-title';
  }

  async function submitNewProposal() {
    const desc  = newProposalDesc.trim();
    const title = newProposalTitle.trim() || desc.split(/[.\n]/)[0].slice(0, 80);
    if (!desc) return;
    showNewProposalDialog = false;
    const slug = title.split(/\s+/).slice(0, 8).join('-').toLowerCase().replace(/[^\w-]+/g, '').replace(/^-+|-+$/g, '') + '.md';
    const date = new Date().toISOString().slice(0, 10);
    const user = 'NetYeti';
    const host = 'phoenix';

    const defaultPriority = newProposalCategory === 'bug' ? 'high' : newProposalPriority;

    const bodyByCategory: Record<string, string> = {
      feature: '## Problem\n\n' + desc + '\n\n## Proposed Solution\n\n\n\n## Out of Scope\n\n',
      bug:     '## Problem\n\n' + desc + '\n\n## Steps to Reproduce\n\n1. \n\n## Expected vs Actual\n\n**Expected:** \n\n**Actual:** \n\n## Proposed Fix\n\n',
      thought: '## Research Question\n\n' + desc + '\n\n## Initial Hypotheses\n\n\n\n## What Would Change Our Mind\n\n',
    };

    const content =
      '---\n' +
      `title: "${title.replace(/"/g, '\\"')}"\n` +
      `author: ${user}\n` +
      `author-role: contributor\n` +
      `created: ${date}\n` +
      `category: ${newProposalCategory}\n` +
      `priority: ${defaultPriority}\n` +
      'tags: []\n' +
      `approved: false\n` +
      `created_by: "${user}@${host}"\n` +
      'assigned_to: ""\n' +
      '---\n\n' +
      (bodyByCategory[newProposalCategory] ?? bodyByCategory.feature);

    const r = await fetch('/api/write?path=proposals/' + slug, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (r.ok) goto('/proposals/' + slug.replace(/\.md$/, '') + '?new=1');
  }

  function newResearch() {
    showNewMenu = false;
    let title = prompt('Research title:');
    if (!title) return;
    let question = prompt('Research question (one sentence):');
    if (!question) return;
    const slug = title.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') + '.md';
    const date = new Date().toISOString().slice(0, 10);
    const content =
      '---\n' +
      `title: "${title}"\n` +
      'status: active\n' +
      `question: "${question}"\n` +
      'conclusion: open\n' +
      'author: NetYeti\n' +
      `created: ${date}\n` +
      'author-role: contributor\n' +
      'tags: []\n' +
      'linked_proposals: []\n' +
      'related_research: []\n' +
      '---\n\n' +
      `# ${title}\n\n` +
      '## Questions Explored\n\n' +
      `- ${question}\n\n` +
      '## Approaches Compared\n\n' +
      '| Approach | Pros | Cons |\n' +
      '|----------|------|------|\n' +
      '| Option A | | |\n' +
      '| Option B | | |\n\n' +
      '## Findings\n\n\n\n' +
      '## Sources\n\n- \n\n' +
      '## Conclusion\n\n' +
      '> Update `status: concluded` and set `conclusion:` when done.\n';
    fetch('/api/write?path=research/' + slug, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }).then(r => {
      if (r.ok) goto('/research/' + slug.replace(/\.md$/, '') + '?new=1');
    });
  }

  function loadBrand() {
    fetch('/api/brand')
      .then(r => r.json())
      .then(data => { brand = data; })
      .catch(() => {});
  }

  onMount(() => {
    loadBrand();
    // Plugin bundles are now lazy-loaded on first activation (Step 15).
    // ViewContainerMount handles loading when the VC isn't yet in __dw_plugins.
    fetch('/api/plugins').then(r => r.ok ? r.json() : []).then(plugins => {
      activePlugins = plugins;
    }).catch(() => {});
    let es = new EventSource('/api/watch');
    const attachWatch = (source: EventSource) => {
      source.addEventListener('filechange', (e: MessageEvent) => {
        fileChanged.set(JSON.parse(e.data));
      });
      source.addEventListener('error', () => {
        source.close();
        setTimeout(() => { es = new EventSource('/api/watch'); attachWatch(es); }, 2000);
      });
    };
    attachWatch(es);

    function handleGlobalKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const editing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        leftView = 'search';
        showSidebar = true;
        searchFocusTrigger.update(n => n + 1);
      } else if (e.ctrlKey && !e.shiftKey && e.key === '\\') {
        e.preventDefault();
        showSidebar = !showSidebar;
      } else if (e.ctrlKey && e.shiftKey && e.key === '\\') {
        e.preventDefault();
        showRightPanel = !showRightPanel;
      } else if (e.key === 'Escape' && !editing) {
        if (leftView === 'search') { leftView = 'files'; }
      }
    }
    document.addEventListener('keydown', handleGlobalKey);

    // Restore persisted theme
    const saved = localStorage.getItem('dw-theme') as Theme | null;
    if (saved && THEMES.includes(saved)) applyTheme(saved);

    return () => document.removeEventListener('keydown', handleGlobalKey);
  });
</script>

{#if !isLoginPage}
<!-- Always-visible toolbar — all viewports -->
<div class="app-toolbar">
  <!-- Left: sidebar toggle -->
  <div class="toolbar-left">
    <button class="hamburger" onclick={toggleSidebar} aria-label="Toggle sidebar" title="Toggle sidebar">☰</button>
  </div>

  <!-- Center: brand — acts as home button -->
  <a href="/status" class="toolbar-brand" title="Home — {brand.name} status">
    {#if brand.logoPath}
      <img class="brand-logo" src="/api/brand/logo" alt={brand.name}
        onerror={(e) => { (e.target as HTMLImageElement).style.display='none'; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('hidden'); }} />
      <span class="brand-name" hidden>{brand.name}</span>
    {:else}
      <span class="brand-name">{brand.name}</span>
    {/if}
  </a>

  <!-- Right: new + properties toggle -->
  <div class="toolbar-right">
    <div class="new-group">
      <button class="new-btn" onclick={(e) => { e.stopPropagation(); showNewMenu = !showNewMenu; }}>+ New</button>
      {#if showNewMenu}
        <div class="new-menu" onclick={(e) => e.stopPropagation()}>
          <button class="new-menu-item" onclick={newFile}>New File</button>
          <button class="new-menu-item" onclick={newProposal}>New Proposal</button>
          <button class="new-menu-item" onclick={newResearch}>New Research</button>
        </div>
      {/if}
    </div>
    <!-- AI model picker -->
    {#if $executorWaiting}
      <button class="exec-pill exec-pill-waiting" onclick={() => { showExecutionPanel.set(true); rightTab = 'execute'; showRightPanel = true; }}
        title="Executor waiting for your input — click to open">
        ⚠ Input required: {$executingPlanName}
      </button>
    {:else if $executorActive}
      <button class="exec-pill exec-pill-running" onclick={() => { showExecutionPanel.set(true); rightTab = 'execute'; showRightPanel = true; }}
        title="Executor running — click to open">
        <span class="exec-pulse"></span>⚡ Running: {$executingPlanName}
      </button>
    {:else if $executorDone}
      <span class="exec-pill exec-pill-done">✓ Done: {$executingPlanName}</span>
    {/if}
    <div class="model-picker-wrap" onclick={loadAiModels}>
      {#if aiModels.length === 0}
        <button class="model-btn" title="Select AI model" onclick={loadAiModels}>⚙ AI</button>
      {:else}
        <select class="model-select" title="Active AI model — changes apply to next Review/Improve call"
          onchange={(e) => setAiModel((e.target as HTMLSelectElement).value)}
          disabled={aiModelSaving}>
          {#if !aiModel}
            <option value="">— default —</option>
          {/if}
          {#each aiModels as m}
            <option value="{m.providerID}/{m.id}" selected={aiModel === `${m.providerID}/${m.id}`}>
              {m.name}
            </option>
          {/each}
        </select>
      {/if}
    </div>
    <UserBadge user={data.user} sessionExpiresAt={data.sessionExpiresAt} />
    <button class="gear-btn" onclick={() => { showRightPanel = !showRightPanel; }} aria-label="Toggle properties panel" title="Toggle properties">⊞</button>
  </div>
</div>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div id="app" onclick={closeMenus}>

  <!-- Activity bar — rendered from CORE_VCS registry + external plugins (Step 14) -->
  <div class="activity-bar">
    {#each [...CORE_VCS.entries()] as [vcId, meta]}
      <button class="act-btn" class:active={leftView === vcId}
        onclick={() => {
          const changed = leftView !== vcId;
          leftView = vcId; showSidebar = true;
          if (vcId === 'search') searchFocusTrigger.update(n => n + 1);
          if (changed && meta.defaultRoute) goto(meta.defaultRoute);
        }}
        title={meta.label}>{meta.icon}</button>
    {/each}
    {#if activePlugins.length > 0}
      <div class="act-divider"></div>
      {#each activePlugins as plugin}
        <button class="act-btn"
          class:active={leftView === `plugin-${plugin.name}`}
          onclick={() => {
            const pluginId = `plugin-${plugin.name}`;
            const changed = leftView !== pluginId;
            leftView = pluginId;
            showSidebar = true;
            if (changed && plugin.defaultRoute) goto(plugin.defaultRoute);
          }}
          title={plugin.displayName}>{plugin.icon}</button>
      {/each}
    {/if}
  </div>

  <Panel side="left" bind:open={showSidebar}>
    <!-- Mobile activity bar strip — registry-driven (Step 14), hidden on desktop -->
    <div class="mobile-vc-strip">
      {#each [...CORE_VCS.entries()] as [vcId, meta]}
        <button class="mobile-act-btn" class:active={leftView === vcId}
          onclick={() => {
            const changed = leftView !== vcId;
            leftView = vcId;
            if (vcId === 'search') searchFocusTrigger.update(n => n + 1);
            if (changed && meta.defaultRoute) goto(meta.defaultRoute);
          }}
          title={meta.label}>{meta.icon}</button>
      {/each}
      {#each activePlugins as plugin}
        <button class="mobile-act-btn" class:active={leftView === `plugin-${plugin.name}`}
          onclick={() => {
            const pluginId = `plugin-${plugin.name}`;
            const changed = leftView !== pluginId;
            leftView = pluginId;
            if (changed && plugin.defaultRoute) goto(plugin.defaultRoute);
          }} title={plugin.displayName}>{plugin.icon}</button>
      {/each}
    </div>

    {@const vcName = leftView.startsWith('plugin-') ? leftView.slice(7) : leftView}
    {@const searchable = CORE_VCS.get(leftView)?.searchable
      ?? activePlugins.find(p => p.name === vcName)?.searchable
      ?? false}
    {#if searchable}
      <div class="vc-search-bar">
        <input class="vc-search-input" type="search" placeholder="Search…"
          oninput={(e) => {
            const q = (e.target as HTMLInputElement).value;
            (window as any).__dw_plugins?.get(vcName)?.onSearch?.(q);
          }} />
      </div>
    {/if}
    <ViewContainerMount vcName={vcName} lazy={leftView.startsWith('plugin-')} />
  </Panel>
  <!-- Main content + chat at bottom -->
  <main id="content">
    <div id="page-slot">
      {#if $notifications.length > 0}
        <div class="notification-area">
          {#each $notifications as n (n.id)}
            <div class="notification notification-{n.type}">
              <div class="notification-content">
                <span class="notification-title">{n.title}</span>
                <span class="notification-message">{n.message}</span>
              </div>
              <div class="notification-actions">
                {#if n.action}
                  <button class="notification-btn" onclick={n.action.onclick}>{n.action.label}</button>
                {/if}
                <button class="notification-close" onclick={() => notifications.dismiss(n.id)}>✕</button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
      <slot />
    </div>
    <!-- AI chat — springs up from bottom of main pane -->
    {#if $showChatPanel}
      <div id="chat-bottom" class:expanded={$showChatPanel}>
        {#if $showMultiReview}
          <MultiReviewPanel />
        {:else}
          <ChatPanel
            currentDocPath={$currentDoc.filePath}
          />
        {/if}
      </div>
    {/if}
  </main>

  <!-- Right sidebar — VC claim takes priority over standard tabs -->
  <Panel side="right" bind:open={showRightPanel}>
    {#if rpc}
      <div class="plugin-right-header">{rpc.label}</div>
      <div style="flex:1;overflow-y:auto;min-height:0;">{@html rpc.html}</div>
    {:else}
    <div class="right-tab-bar">
      <button class="right-tab" class:active={rightTab === 'properties'}
        onclick={() => { if (!applyingReview) rightTab = 'properties'; }}>Properties</button>
      <button class="right-tab" class:active={rightTab === 'related'}
        onclick={() => { if (!applyingReview) { rightTab = 'related'; if (!cm.length && $currentDoc.filePath) findRelated($currentDoc.filePath); } }}>
        Related{cm.length > 0 ? ` (${cm.length})` : ''}
      </button>
      {#if $currentDoc.docType === 'plan'}
        <button class="right-tab" class:active={rightTab === 'review'}
          onclick={() => { if (!applyingReview) showReviewTab.set(true); }}>
          Review{prl ? ' ⏳' : ''}
        </button>
        {#if rightTab === 'execute'}
          <button class="right-tab" class:active={true}>Execute ⚡</button>
        {/if}
      {/if}
      {#if $currentDoc.docType === 'proposal'}
        <button class="right-tab" class:active={rightTab === 'improve'}
          onclick={() => { if (!applyingReview) handleImprove(); }}>
          Improve{il ? ' ⏳' : ir ? ' ✓' : ''}
        </button>
      {/if}
    </div>

    {#if rightTab === 'properties'}
      {#key $currentDoc.filePath}
        {#if $currentDoc.frontmatter}
          <PropertiesPane
            bind:frontmatter={$currentDoc.frontmatter}
            body={$currentDoc.body}
            docType={$currentDoc.docType}
            mode={$currentDoc.mode}
            onsave={$currentDoc.onSave}
            onapprove={$currentDoc.onApprove}
            onfindrelated={() => { rightTab = 'related'; findRelated($currentDoc.filePath); }}
            onplan={() => { showToast('Scanning for related proposals…', 3000); rightTab = 'related'; findRelated($currentDoc.filePath); }}
            onimprove={handleImprove}
            onreview={handleCritique}
            canReview={!critiqueBodyFingerprint || critiqueBodyFingerprint !== ($currentDoc.body ? $currentDoc.body.length + ':' + $currentDoc.body.slice(0, 100) : '')}
          />
        {:else}
          <div class="right-empty">Open a document to see its properties</div>
        {/if}
      {/key}
    {:else if rightTab === 'improve' && improveIsLive}
      <div style="display:flex;flex-direction:column;height:100%;min-height:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.3rem 0.55rem;border-bottom:1px solid var(--border,#ddd);font-size:0.8rem;color:var(--muted,#666);">
          <span>Live {improveIsCritiqueOnly ? 'critique' : 'improve'}</span>
          <button class="right-tab" title="Close" onclick={() => { if (liveImproveES) { liveImproveES.close(); liveImproveES = null; } improveIsLive = false; rightTab = 'properties'; }}>✕</button>
        </div>
        <AgentActivityView events={liveImproveEvents} />
      </div>
    {:else if rightTab === 'improve'}
      <ImprovementPanel
        improved={ir?.improved ?? ''}
        critique={ir?.critique ?? ''}
        loading={il}
        phase={ip}
        status={ist}
        critiqueOnly={improveIsCritiqueOnly}
        onaccept={handleAcceptImprove}
        ondismiss={() => { rightTab = 'properties'; improveResult.set(null); improveIsCritiqueOnly = false; }}
        onrerun={improveIsCritiqueOnly ? handleCritique : handleImprove}
      />
    {:else if rightTab === 'review' && reviewIsLive}
      <div style="display:flex;flex-direction:column;height:100%;min-height:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.3rem 0.55rem;border-bottom:1px solid var(--border,#ddd);font-size:0.8rem;color:var(--muted,#666);">
          <span>Live review</span>
          <button class="right-tab" title="Close" onclick={() => { if (liveReviewES) { liveReviewES.close(); liveReviewES = null; } reviewIsLive = false; rightTab = 'properties'; }}>✕</button>
        </div>
        <AgentActivityView events={liveReviewEvents} />
      </div>
    {:else if rightTab === 'review'}
      <PlanReviewPanel
        steps={prSteps}
        sections={prSections}
        analyses={prAnalyses}
        overview={prOverview}
        status={prs}
        loading={prl}
        canRerun={canRerun}
        applying={applyingReview}
        stepsPrompts={prStepsPrompts}
        stepsThinking={prStepsThinking}
        sectionsPrompts={prSectionsPrompts}
        sectionsThinking={prSectionsThinking}
        analysesPrompts={prAnalysesPrompts}
        analysesThinking={prAnalysesThinking}
        overviewPrompt={prOverviewPrompt}
        overviewThinking={prOverviewThinking}
        ondismiss={() => { rightTab = 'properties'; }}
        onrerun={handleReview}
        onapply={handleApplyReview}
      />
    {:else if rightTab === 'execute'}
      <PlanExecutePanel />
    {:else}
      <CollationPanel
        matches={cm}
        relationships={cr}
        loading={cl}
        planMode={$currentDoc.docType === 'proposal' && $currentDoc.frontmatter?.approved === true && !$currentDoc.frontmatter?.consumed_by}
        alreadyRelated={Array.isArray($currentDoc.frontmatter?.related_to) ? $currentDoc.frontmatter.related_to : []}
        onaddrelated={(path) => $currentDoc.onAddRelated?.(path)}
        onadddepends={(path) => $currentDoc.onAddDepends?.(path)}
        onaddblocks={(path) => $currentDoc.onAddBlocks?.(path)}
        onsubsume={(path) => $currentDoc.onSubsume?.(path)}
        oncreateplan={() => handleCreatePlan()}
        onrecheck={() => { if ($currentDoc.filePath) findRelated($currentDoc.filePath); }}
        onclose={() => { rightTab = 'properties'; collationMatches.set([]); collationRelationships.set([]); }}
      />
    {/if}
    {/if}
  </Panel>

  <div class="toast-container">
    {#each $toasts as toast (toast.id)}
      <div class="toast">
        <span class="toast-msg">{toast.message}</span>
        {#if toast.action}
          <button class="toast-action" onclick={() => { toast.action!.onclick(); dismissToast(toast.id); }}>{toast.action.label}</button>
        {/if}
        <button class="toast-close" onclick={() => dismissToast(toast.id)}>✕</button>
      </div>
    {/each}
  </div>
</div>
{:else}
<!-- Login page: render only the slot (login form) -->
<slot />
{/if}

<!-- Chat toggle button — bottom of viewport, above footer -->
<button
  class="chat-toggle"
  class:active={$showChatPanel}
  onclick={() => showChatPanel.update(v => !v)}
  title={$showChatPanel ? 'Close AI chat' : 'Open AI chat (⚡)'}
>
  {$showChatPanel ? '✕ Chat' : '⚡ Chat'}
</button>

{#if showNewProposalDialog}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="dialog-overlay" role="dialog" aria-modal="true"
       onkeydown={(e) => { if (e.key === 'Escape' && newProposalStep !== 'checking') showNewProposalDialog = false; }}>
    <div class="dialog-box" onclick={(e) => e.stopPropagation()}>

      {#if newProposalStep === 'form'}
        <div class="dialog-header">New Proposal</div>
        <div class="dialog-category-row">
          {#each Object.entries(CATEGORY_LABELS) as [val, label]}
            <button class="category-chip" class:active={newProposalCategory === val}
              onclick={() => newProposalCategory = val}>{label}</button>
          {/each}
        </div>
        <label class="dialog-label" for="new-proposal-desc">
          {newProposalCategory === 'bug' ? 'Describe the bug' : newProposalCategory === 'thought' ? 'What are you exploring?' : 'Describe the problem or idea'}
        </label>
        <textarea
          id="new-proposal-desc"
          class="dialog-textarea"
          placeholder={newProposalCategory === 'bug'
            ? "What breaks, when, and what's the impact?"
            : newProposalCategory === 'thought'
            ? 'A question or hypothesis worth exploring…'
            : "1–3 sentences: what's the problem, and roughly what would fix it?"}
          rows="4"
          bind:value={newProposalDesc}
          onkeydown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) checkAndSubmitProposal(); }}
        ></textarea>
        {#if newProposalCategory !== 'bug'}
          <label class="dialog-label" for="new-proposal-priority">Priority</label>
          <select id="new-proposal-priority" class="dialog-select" bind:value={newProposalPriority}>
            {#each Object.entries(PRIORITY_LABELS) as [val, label]}
              <option value={val}>{label}</option>
            {/each}
          </select>
        {/if}
        <div class="dialog-actions">
          <button class="dialog-cancel" onclick={() => showNewProposalDialog = false}>Cancel</button>
          <button class="dialog-submit" onclick={checkAndSubmitProposal} disabled={!newProposalDesc.trim()}>
            Continue →
          </button>
        </div>

      {:else if newProposalStep === 'checking'}
        <div class="dialog-header">New Proposal</div>
        <div class="dialog-checking">
          <span class="dialog-spinner">⟳</span>
          Checking for duplicates and generating title…
        </div>

      {:else if newProposalStep === 'confirm-title'}
        <div class="dialog-header">Confirm title</div>
        <div class="dialog-matches-hint">
          {newProposalTitleGenerated ? 'AI-generated title — edit if needed.' : 'Title from your description — edit if needed.'}
        </div>
        <input class="dialog-title-input" type="text" bind:value={newProposalTitle}
          placeholder="Proposal title…" maxlength="120" />
        <div class="dialog-actions">
          <button class="dialog-cancel" onclick={() => { newProposalStep = 'form'; }}>← Back</button>
          <button class="dialog-submit" onclick={submitNewProposal} disabled={!newProposalTitle.trim()}>
            Create Proposal
          </button>
        </div>

      {:else if newProposalStep === 'matches'}
        <div class="dialog-header">Similar proposals found</div>
        <div class="dialog-matches-hint">
          These existing documents may cover the same ground. Review before creating.
        </div>
        <div class="dialog-matches">
          {#each newProposalMatches as m}
            <a class="dialog-match" href="/{m.path.replace(/\.md$/, '')}" target="_blank" rel="noopener"
               onclick={() => { showNewProposalDialog = false; }}>
              <span class="dialog-match-body">
                <span class="dialog-match-title">{m.title}</span>
                {#if m.reason}<span class="dialog-match-reason">{m.reason}</span>{/if}
              </span>
              <span class="dialog-match-score">{Math.round(m.score * 100)}%</span>
              <span class="dialog-match-type">{m.type}</span>
            </a>
          {/each}
        </div>
        <div class="dialog-actions">
          <button class="dialog-cancel" onclick={() => { newProposalStep = 'form'; }}>← Edit description</button>
          <button class="dialog-submit" onclick={() => { newProposalStep = 'confirm-title'; }}>Create Anyway →</button>
        </div>
      {/if}

    </div>
  </div>
{/if}

<footer class="app-footer">
  <a href="https://github.com/growlf/docwright" target="_blank" rel="noopener" class="footer-link">
    DocWright
  </a>
  <span class="footer-sep">·</span>
  <span>MIT License</span>
  <span class="footer-sep">·</span>
  <a href="https://github.com/growlf/docwright" target="_blank" rel="noopener" class="footer-link">
    github.com/growlf/docwright
  </a>
  <span class="footer-sep">·</span>
  <span class="version-badge" title="DocWright release version">{vaultVersion ? `v${vaultVersion}` : 'version unknown'}</span>
  <span class="footer-sep">·</span>
  <span class="ai-presence" class:busy={aiBusy} title={aiBusy ? `AI working — ${aiBusyCount} active session${aiBusyCount === 1 ? '' : 's'}` : 'AI idle'}>
    <span class="ai-dot"></span>{aiBusy ? `AI working…${aiBusyCount > 1 ? ` (${aiBusyCount})` : ''}` : 'AI idle'}
  </span>
  <span class="footer-spacer"></span>
  <a href="/settings" class="footer-link footer-settings" title="Settings">⚙ Settings</a>
  <span class="footer-sep">·</span>
  <button class="theme-btn" onclick={cycleTheme}
    title="Theme: {theme} · Click to cycle (dark → light → system)">
    {THEME_ICONS[theme]} {theme}
  </button>
</footer>

<style>
  /* old mobile-topbar removed — replaced by app-toolbar (always visible) */
  /* ── Always-visible toolbar ─────────────────────────────────────────────── */
  .app-toolbar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    height: 44px;
    padding: 0 10px;
    background: #0f0f12;
    border-bottom: 1px solid #1e2030;
    flex-shrink: 0;
    z-index: 100;
  }
  .toolbar-left  { display: flex; align-items: center; gap: 4px; justify-content: flex-start; }
  .toolbar-right { display: flex; align-items: center; gap: 4px; justify-content: flex-end; }
  .toolbar-brand {
    display: flex; align-items: center; justify-content: center;
    text-decoration: none; padding: 4px 8px; border-radius: 4px;
  }
  .toolbar-brand:hover { background: #1a1a2a; }
  .hamburger { background: none; border: none; color: #666; cursor: pointer; font-size: 16px; padding: 4px 6px; border-radius: 3px; }
  .hamburger:hover { color: #aaa; background: #1a1a1a; }
  .home-btn { color: #666; font-size: 16px; text-decoration: none; padding: 4px 6px; border-radius: 3px; }
  .home-btn:hover { color: #aaa; background: #1a1a1a; }
  .gear-btn { background: none; border: none; color: #666; cursor: pointer; font-size: 16px; padding: 4px 6px; border-radius: 3px; }
  .gear-btn:hover { color: #aaa; background: #1a1a1a; }
  .model-picker-wrap { flex-shrink: 0; }
  .model-btn { background: none; border: 1px solid #444; color: #888; padding: 2px 7px; border-radius: 4px; cursor: pointer; font-size: 11px; white-space: nowrap; }
  .model-btn:hover { color: #aaa; border-color: #666; }
  .model-select { background: #1a1a1a; border: 1px solid #444; color: #aaa; padding: 2px 4px; border-radius: 4px; font-size: 11px; cursor: pointer; max-width: 180px; }
  .model-select:focus { outline: none; border-color: #5588cc; }

  /* ── Activity bar ────────────────────────────────────────────────────────── */
  .activity-bar {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 40px;
    background: #0a0a0d;
    border-right: 1px solid #1e2030;
    flex-shrink: 0;
    padding-top: 4px;
    gap: 2px;
  }
  .act-btn {
    width: 36px; height: 36px;
    background: none; border: none;
    color: #444; cursor: pointer;
    font-size: 16px; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
  }
  .act-btn:hover  { color: #aaa; background: #1a1a1a; }
  .act-btn.active { color: #ccc; background: #1a1a2a; border-left: 2px solid #58a6ff; border-radius: 0 4px 4px 0; }
  .act-divider { width: 70%; height: 1px; background: #2a2a2a; margin: 4px auto; }

  /* ── Core layout ────────────────────────────────────────────────────────── */
  #app { display: flex; flex: 1; min-height: 0; font-family: system-ui, -apple-system, sans-serif; }

  /* ── Settings view ───────────────────────────────────────────────────────── */

  .brand-name { font-size: 13px; font-weight: 600; color: #58a6ff; white-space: nowrap; letter-spacing: 0.02em; }
  .toolbar-brand:hover .brand-name { color: #88c4ff; }
  .brand-logo { height: 22px; width: auto; max-width: 140px; display: block; }
  .toolbar-brand:hover .brand-logo { opacity: 0.8; }

  .app-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 16px;
    font-size: 10px;
    color: #333;
    border-top: 1px solid #1a1a1a;
    background: #0d0d0d;
    flex-shrink: 0;   /* never compress — always full height */
    z-index: 50;
  }
  .footer-link { color: #333; text-decoration: none; }
  .footer-link:hover { color: #666; }
  .footer-sep { color: #222; }
  .version-badge { color: #666; font-family: monospace; font-size: 9px; font-weight: 600; letter-spacing: 0.5px; }
  .ai-presence { display: inline-flex; align-items: center; gap: 5px; color: #666; font-size: 10px; }
  .ai-presence .ai-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; }
  .ai-presence.busy { color: #3b82f6; }
  .ai-presence.busy .ai-dot { background: #3b82f6; animation: ai-pulse 1.2s ease-in-out infinite; }
  @keyframes ai-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }

  /* chat-fab replaced by chat-toggle (see above) */
  /* sidebar-toggle removed — Panel.svelte provides the edge toggle */
  .new-group { position: relative; flex-shrink: 0; }
  .new-btn { background: none; border: 1px solid #444; color: #aaa; padding: 2px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
  .new-btn:hover { background: #222; color: #fff; }
  .new-menu { position: absolute; top: 100%; right: 0; margin-top: 4px; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; z-index: 1000; min-width: 140px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
  .new-menu-item { display: block; width: 100%; background: none; border: none; color: #ccc; padding: 6px 16px; font-size: 13px; text-align: left; cursor: pointer; }
  .new-menu-item:hover { background: #2b5b84; color: #fff; }
  #content { flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--bg, #1a1a1a); color: var(--fg, #e0e0e0); overflow: hidden; }
  #page-slot { flex: 1; overflow-y: auto; scroll-behavior: smooth; }

  /* Notification area in page-slot */
  .notification-area { display: flex; flex-direction: column; gap: 1px; border-bottom: 1px solid #2a2a2a; }
  .notification { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; font-size: 13px; gap: 8px; }
  .notification-content { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .notification-title { font-weight: 600; margin-bottom: 2px; }
  .notification-message { font-size: 12px; opacity: 0.8; }
  .notification-actions { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }
  .notification-btn { background: #2b5b84; color: #fff; border: none; border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: pointer; }
  .notification-btn:hover { background: #3b7bb4; }
  .notification-close { background: none; border: none; color: #666; cursor: pointer; font-size: 14px; padding: 2px; line-height: 1; }
  .notification-close:hover { color: #ccc; }
  .notification-info    { background: rgba(88, 166, 255, 0.08); border-left: 3px solid #58a6ff; }
  .notification-warning { background: rgba(210, 153, 34, 0.08); border-left: 3px solid #d29922; }
  .notification-error   { background: rgba(218, 54, 51, 0.08); border-left: 3px solid #da3633; }
  .notification-success { background: rgba(63, 185, 80, 0.08); border-left: 3px solid #3fb950; }
  .notification-drift   { background: rgba(210, 153, 34, 0.12); border-left: 3px solid #d29922; }
  .notification-drift .notification-title::before { content: "⚠ "; }
  #chat-bottom { flex-shrink: 0; height: 420px; border-top: 1px solid #2a2a2a; position: relative; }
  #chat-bottom :global(.chat-panel) { position: absolute; inset: 0; height: 100% !important; bottom: 0 !important; }

  /* Right sidebar tab bar */
  .right-tab-bar { display: flex; border-bottom: 1px solid #1e1e1e; flex-shrink: 0; }
  .right-tab { flex: 1; background: none; border: none; border-bottom: 2px solid transparent; color: #555; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; padding: 8px 4px 6px; cursor: pointer; }
  .right-tab:hover  { color: #aaa; }
  .right-tab.active { color: #ccc; border-bottom-color: #58a6ff; }
  .right-empty { padding: 16px; font-size: 12px; color: #444; text-align: center; margin-top: 32px; }
  .plugin-right-header { padding: 8px 12px 7px; font-size: 11px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 1px solid #1e1e1e; flex-shrink: 0; }

  /* Chat toggle — replaces FAB, sits at bottom of viewport above footer */
  .chat-toggle {
    position: fixed;
    bottom: 44px;
    left: 50%;
    transform: translateX(-50%);
    padding: 5px 18px;
    background: #1a2f4a;
    border: 1px solid #2b5b84;
    border-radius: 16px;
    color: #58a6ff;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    z-index: 350;
    box-shadow: 0 2px 10px rgba(0,0,0,0.4);
    transition: background 0.15s;
  }
  .chat-toggle:hover  { background: #1e4a70; }
  .chat-toggle.active { background: #2b5b84; }
  .toast-container { position: fixed; bottom: 16px; right: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 10000; }
  .toast { display: flex; align-items: center; gap: 8px; background: var(--bg-2, #222); border: 1px solid var(--border, #444); border-radius: 6px; padding: 10px 14px; font-size: 13px; color: var(--fg, #e0e0e0); box-shadow: 0 4px 12px rgba(0,0,0,0.4); min-width: 260px; }
  .toast-msg { flex: 1; }
  .toast-action { background: none; border: 1px solid #2b5b84; color: #58a6ff; padding: 2px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
  .toast-action:hover { background: #1a3a5a; }
  .toast-close { background: none; border: none; color: #666; cursor: pointer; font-size: 14px; padding: 0 2px; }
  .project-name { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .project-profile { font-size: 11px; color: #555; white-space: nowrap; overflow: hidden; }

  /* ── Per-VC search bar (shown when active plugin VC has searchable: true) ── */
  .vc-search-bar { padding: 6px 8px; flex-shrink: 0; }
  .vc-search-input {
    width: 100%;
    box-sizing: border-box;
    background: var(--bg, #111);
    border: 1px solid var(--border, #2a2a2a);
    border-radius: 4px;
    color: var(--fg, #ddd);
    font-size: 12px;
    padding: 5px 8px;
    outline: none;
  }
  .vc-search-input:focus { border-color: var(--accent, #7c9ef7); }

  /* ── Mobile VC strip (inside left panel, mirrors activity bar on mobile) ── */
  .mobile-vc-strip {
    display: none;
    flex-direction: row;
    flex-wrap: nowrap;
    overflow-x: auto;
    gap: 2px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border, #1e2030);
    flex-shrink: 0;
    scrollbar-width: none;
  }
  .mobile-vc-strip::-webkit-scrollbar { display: none; }
  .mobile-act-btn {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--muted, #666);
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s, color 0.1s;
  }
  .mobile-act-btn:hover { background: var(--bg-hover, #1a1a1a); color: var(--fg, #ccc); }
  .mobile-act-btn.active { background: var(--accent-muted, #1e2a4a); color: var(--accent, #5e81f4); }

  /* ── Mobile (≤ 768px) ────────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    #content { padding-top: 0; } /* toolbar is in flow, no fixed offset needed */
    .toast-container { bottom: 80px; }
    .activity-bar { display: none; } /* activity bar hidden on mobile — mobile-vc-strip takes over */
    .mobile-vc-strip { display: flex; }
  }

  /* ── Theme picker button ─────────────────────────────────────────────────── */
  .footer-spacer { flex: 1; }
  .theme-btn {
    background: none; border: 1px solid var(--border, #2a2a2a);
    color: var(--muted, #666); border-radius: 4px;
    padding: 1px 8px; font-size: 11px; cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .theme-btn:hover { color: var(--fg, #ccc); border-color: var(--muted, #666); }

  /* ── Light theme overrides for this component's own scoped elements ─────── */
  /* :global(A) .B compiles to A .B.s-hash — beats the base .B.s-hash rule   */
  :global(html[data-theme="light"]) {
    .app-toolbar  { background: #fff; border-bottom-color: #d0d0d0; }
    .app-footer   { background: #fff; border-top-color: #d0d0d0; color: #555; }
    .footer-link  { color: #555; }    .footer-link:hover { color: #222; }
    .footer-sep   { color: #bbb; }
    .activity-bar { background: #e8e8e8; border-right-color: #d0d0d0; }
    .act-btn      { color: #888; }
    .act-btn:hover  { background: #ddd; color: #333; }
    .act-btn.active { color: #333; background: #dce8ff; border-left-color: #4a6cf7; }
    .hamburger, .home-btn, .gear-btn { color: #666; }
    .hamburger:hover, .home-btn:hover, .gear-btn:hover { color: #222; background: #e4e4e4; }
    .brand-name   { color: #4a6cf7; }
    .new-btn { border-color: #bbb; color: #555; }
    .new-btn:hover { background: #e4e4e4; color: #111; }
    .new-menu { background: #fff; border-color: #d0d0d0; box-shadow: 0 4px 12px rgba(0,0,0,.12); }
    .new-menu-item { color: #333; }
    .new-menu-item:hover { background: #e0e8ff; color: #111; }
    .right-tab        { color: #888; }
    .right-tab.active { color: #333; border-bottom-color: #4a6cf7; }
    .toast { background: #fff; border-color: #d0d0d0; color: #333; }
    .chat-toggle { background: #ddeeff; border-color: #aaccee; color: #2a6090; }
    .chat-toggle:hover  { background: #cce0ff; }
    .chat-toggle.active { background: #aaccee; }
    .toast-action { background: none; border-color: #aaccee; color: #2a6090; }
    .toast-action:hover { background: #ddeeff; }
    .toast-close { color: #888; }
    #content { background: #f5f5f5; color: #1a1a1a; }
  }

  /* Executor presence indicator — global toolbar pill */
  .exec-pill {
    display: flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 600; padding: 3px 10px;
    border-radius: 10px; white-space: nowrap; max-width: 240px;
    overflow: hidden; text-overflow: ellipsis; cursor: default;
    border: 1px solid transparent;
  }
  .exec-pill-running {
    background: #0d2040; border-color: #2b5b84; color: #58a6ff; cursor: pointer;
  }
  .exec-pill-running:hover { background: #1a3a5a; }
  .exec-pill-waiting {
    background: #2a1800; border-color: #b87800; color: #f59e0b; cursor: pointer;
    animation: pill-pulse-amber 1.2s ease-in-out infinite;
  }
  .exec-pill-waiting:hover { background: #3a2200; }
  .exec-pill-done { background: #0a2010; border-color: #2a6a3a; color: #4caf50; }

  .exec-pulse {
    display: inline-block; width: 6px; height: 6px; border-radius: 50%;
    background: #58a6ff; flex-shrink: 0;
    animation: pill-pulse-blue 1.4s ease-in-out infinite;
  }

  @keyframes pill-pulse-blue {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.4; transform: scale(0.7); }
  }
  @keyframes pill-pulse-amber {
    0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.4); }
    50%       { box-shadow: 0 0 0 4px rgba(245,158,11,0); }
  }

  :global(html[data-theme="light"]) {
    .exec-pill-running { background: #ddeeff; border-color: #aaccee; color: #2a6090; }
    .exec-pill-running:hover { background: #cce0ff; }
    .exec-pill-waiting { background: #fff8e0; border-color: #e8c060; color: #7a5000; }
    .exec-pill-waiting:hover { background: #fff0c0; }
    .exec-pill-done { background: #e8f5e8; border-color: #8ac88a; color: #2a6a2a; }
    .exec-pulse { background: #2a6090; }
  }

  /* New proposal dialog */
  .dialog-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.6);
    display: flex; align-items: center; justify-content: center;
  }
  .dialog-box {
    background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 10px;
    padding: 24px; width: min(480px, 92vw); display: flex; flex-direction: column; gap: 10px;
  }
  .dialog-header { font-size: 15px; font-weight: 700; color: #e0e0f0; margin-bottom: 4px; }
  .dialog-label  { font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .dialog-textarea {
    background: #111128; border: 1px solid #2a2a4a; border-radius: 6px;
    color: #e0e0f0; font-size: 13px; padding: 10px 12px; resize: vertical;
    font-family: inherit; line-height: 1.5;
    &:focus { outline: none; border-color: #4a6aba; }
  }
  .dialog-select {
    background: #111128; border: 1px solid #2a2a4a; border-radius: 6px;
    color: #e0e0f0; font-size: 13px; padding: 6px 10px;
    &:focus { outline: none; border-color: #4a6aba; }
  }
  .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
  .dialog-cancel  {
    background: none; border: 1px solid #2a2a4a; border-radius: 6px;
    color: #888; font-size: 13px; padding: 7px 16px; cursor: pointer;
    &:hover { border-color: #4a4a6a; color: #aaa; }
  }
  .dialog-submit  {
    background: #1e3a6e; border: 1px solid #2a5aba; border-radius: 6px;
    color: #7ab0ff; font-size: 13px; font-weight: 600; padding: 7px 18px; cursor: pointer;
    &:hover:not(:disabled) { background: #253e7e; }
    &:disabled { opacity: 0.4; cursor: default; }
  }
  .dialog-checking {
    padding: 20px 0 12px; color: #888; font-size: 13px; text-align: center;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .dialog-spinner { animation: spin 1s linear infinite; display: inline-block; font-size: 16px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .dialog-matches-hint { font-size: 11px; color: #666; margin-bottom: 8px; }
  .dialog-matches { display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow-y: auto; margin-bottom: 4px; }
  .dialog-match {
    display: flex; align-items: center; gap: 8px; padding: 7px 10px;
    background: #0d0d1e; border: 1px solid #2a2a4a; border-radius: 5px;
    text-decoration: none; color: inherit;
    &:hover { border-color: #4a6aba; background: #111128; }
  }
  .dialog-match-body  { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .dialog-match-title { font-size: 12px; color: #d0d0e8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dialog-match-reason { font-size: 10px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dialog-match-score { font-size: 10px; font-weight: 700; color: #f39c12; background: #2a1a00; border: 1px solid #7a5000; border-radius: 8px; padding: 1px 6px; flex-shrink: 0; }
  .dialog-match-type  { font-size: 9px; color: #666; background: #111128; border: 1px solid #2a2a4a; border-radius: 8px; padding: 1px 6px; flex-shrink: 0; }

  .dialog-category-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
  .category-chip {
    background: #111128; border: 1px solid #2a2a4a; border-radius: 20px;
    color: #888; font-size: 12px; padding: 4px 12px; cursor: pointer;
    &:hover { border-color: #4a4a6a; color: #aaa; }
    &.active { background: #1e3a6e; border-color: #2a5aba; color: #7ab0ff; font-weight: 600; }
  }
  .dialog-title-input {
    background: #111128; border: 1px solid #2a2a4a; border-radius: 6px;
    color: #e0e0f0; font-size: 14px; font-weight: 500; padding: 10px 12px; width: 100%; box-sizing: border-box;
    &:focus { outline: none; border-color: #4a6aba; }
  }

  :global(html[data-theme="light"]) {
    .dialog-box { background: #fff; border-color: #d0d0e8; }
    .dialog-header { color: #1a1a2e; }
    .dialog-textarea { background: #f5f5ff; border-color: #c0c0e0; color: #1a1a2e; }
    .dialog-select   { background: #f5f5ff; border-color: #c0c0e0; color: #1a1a2e; }
    .dialog-cancel   { border-color: #c0c0e0; color: #555; &:hover { border-color: #8888aa; } }
    .dialog-submit   { background: #ddeeff; border-color: #6699cc; color: #1a4080; }
    .category-chip { background: #f0f0f8; border-color: #c0c0e0; color: #555;
      &:hover { border-color: #8888aa; } &.active { background: #ddeeff; border-color: #6699cc; color: #1a4080; } }
    .dialog-title-input { background: #f5f5ff; border-color: #c0c0e0; color: #1a1a2e; }
  }
</style>
