<script lang="ts">
  import AgentActivityView from './AgentActivityView.svelte';
  import { reduceEvents, textFor } from './agent-activity-model';

  interface Perspective {
    label: string;
    text: string;
  }

  let { responses = [] as Perspective[] } = $props();

  let synthesis = $state('');
  let loading = $state(false);
  let error = $state('');

  // Live synthesis (LIVE_AI_IMPROVE, client opt-in): stream generation in
  // AgentActivityView, then keep the final answer as the synthesis text.
  let isLive = $state(false);
  let liveEvents = $state<any[]>([]);
  let liveES: EventSource | null = null;

  async function runSynthesis() {
    const active = responses.filter(r => r.text && r.text !== '(empty response)');
    if (active.length < 2) { error = 'Need at least 2 completed perspectives to synthesize.'; return; }

    loading = true;
    error = '';
    synthesis = '';
    if (liveES) { liveES.close(); liveES = null; }
    isLive = false;
    liveEvents = [];

    try {
      const res = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: active, live: true }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.live && data.sessionID) { startLiveSynthesis(data.sessionID, active); return; }
      synthesis = data.synthesis || '(empty synthesis)';
    } catch (e: any) {
      error = e.message || 'Synthesis failed';
    }
    loading = false;
  }

  function startLiveSynthesis(sessionID: string, active: Perspective[]) {
    isLive = true;
    liveEvents = [];
    let idleSeen = false;
    const es = new EventSource(`/api/ai/stream?session=${encodeURIComponent(sessionID)}`);
    liveES = es;

    function finish() {
      if (liveES) { liveES.close(); liveES = null; }
      const text = textFor(reduceEvents(liveEvents), 'assistant').trim();
      synthesis = text || '(empty synthesis)';
      isLive = false;
      loading = false;
    }

    es.onopen = async () => {
      try {
        const r = await fetch('/api/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start', sessionID, responses: active }),
        });
        if (!r.ok) { error = 'Failed to start synthesis'; finish(); }
      } catch { error = 'Failed to start synthesis'; finish(); }
    };
    es.onmessage = (e) => {
      let evt: any;
      try { evt = JSON.parse(e.data); } catch { return; }
      liveEvents = [...liveEvents, evt];
      if (evt?.type === 'session.idle') { idleSeen = true; finish(); }
    };
    es.onerror = () => { if (idleSeen) finish(); };
  }

  let sections = $derived.by(() => {
    if (!synthesis) return [];
    const lines = synthesis.split('\n');
    const result: Array<{ heading: string; body: string[] }> = [];
    let current: { heading: string; body: string[] } | null = null;
    for (const line of lines) {
      const heading = line.match(/^\d+\.\s+(.+)/) || line.match(/^\*\*(.+?):\*\*/) || line.match(/^###?\s+(.+)/);
      if (heading) {
        current = { heading: heading[1], body: [] };
        result.push(current);
      } else if (current && line.trim()) {
        current.body.push(line.trim());
      }
    }
    return result;
  });

  let canSynthesize = $derived(responses.filter(r => r.text && r.text !== '(empty response)').length >= 2);
</script>

<div class="synthesis-panel">
  <div class="syn-header">
    <span class="syn-title">Perspective Synthesis</span>
    <span class="syn-badge">AI — one more perspective</span>
  </div>

  {#if error}
    <div class="syn-error">{error}</div>
  {/if}

  {#if !synthesis && !loading}
    <div class="syn-empty">
      <p>Collect at least 2 perspectives, then synthesize to find common ground, disagreements, and flag items needing human judgment.</p>
      <p class="syn-constraint">Synthesis is displayed alongside raw perspectives — never instead of them.</p>
      <button class="syn-btn" onclick={runSynthesis} disabled={!canSynthesize || loading}>
        Synthesize
      </button>
    </div>
  {/if}

  {#if isLive}
    <div class="syn-live" style="height:360px;min-height:0;border:1px solid var(--border,#ddd);border-radius:4px;margin:6px 0;">
      <AgentActivityView events={liveEvents} />
    </div>
  {/if}

  {#if loading && !isLive}
    <div class="syn-loading">
      <span class="spinner"></span>
      <span>Synthesizing {responses.filter(r => r.text && r.text !== '(empty response)').length} perspectives...</span>
    </div>
  {/if}

  {#if synthesis}
    <div class="syn-results">
      {#if sections.length > 0}
        {#each sections as sec}
          <div class="syn-section">
            <h4 class="syn-section-heading">{sec.heading}</h4>
            {#each sec.body as line}
              <p>{line}</p>
            {/each}
          </div>
        {/each}
      {:else}
        <div class="syn-raw">{synthesis}</div>
      {/if}
      <div class="syn-footnote">
        ⚠ This synthesis is an AI-generated reading of the perspectives above.
        It is one more perspective, not a verdict. Always review raw responses.
      </div>
      <button class="syn-btn" onclick={runSynthesis} disabled={loading}>
        Re-synthesize
      </button>
    </div>
  {/if}
</div>

<style>
  .synthesis-panel {
    padding: 8px 12px;
    border-top: 1px solid var(--border-color, #2a2a3e);
    font-size: 13px;
  }

  .syn-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .syn-title {
    font-weight: 600;
    font-size: 14px;
  }

  .syn-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--accent, #4fc3f7);
    color: #000;
    font-weight: 600;
  }

  .syn-empty {
    text-align: center;
    padding: 16px 8px;
    opacity: 0.8;
  }

  .syn-empty p {
    margin: 4px 0;
    font-size: 12px;
  }

  .syn-constraint {
    font-size: 11px;
    opacity: 0.6;
    font-style: italic;
  }

  .syn-btn {
    margin-top: 8px;
    padding: 6px 16px;
    border: 1px solid var(--accent, #4fc3f7);
    background: var(--accent, #4fc3f7);
    color: #000;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
  }

  .syn-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .syn-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 8px;
  }

  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid var(--border-color, #2a2a3e);
    border-top-color: var(--accent, #4fc3f7);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .syn-error {
    padding: 8px;
    background: rgba(229, 57, 53, 0.1);
    border: 1px solid var(--error, #e53935);
    border-radius: 4px;
    color: var(--error, #e53935);
    font-size: 12px;
    margin-bottom: 8px;
  }

  .syn-results {
    margin-top: 4px;
  }

  .syn-section {
    margin-bottom: 12px;
  }

  .syn-section-heading {
    margin: 0 0 4px;
    font-size: 13px;
    font-weight: 600;
    color: var(--accent, #4fc3f7);
  }

  .syn-section p {
    margin: 2px 0;
    font-size: 12px;
    line-height: 1.5;
  }

  .syn-raw {
    white-space: pre-wrap;
    font-size: 12px;
    line-height: 1.5;
    padding: 8px;
    background: rgba(255,255,255,0.03);
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .syn-footnote {
    font-size: 11px;
    opacity: 0.6;
    font-style: italic;
    padding: 6px 0;
    border-top: 1px solid var(--border-color, #2a2a3e);
    margin-top: 8px;
  }
</style>
