<script lang="ts">
  interface Perspective {
    label: string;
    text: string;
  }

  let { responses = [] as Perspective[] } = $props();

  let summary = $state('');
  let loading = $state(false);
  let error = $state('');

  async function runVote() {
    const active = responses.filter(r => r.text && r.text !== '(empty response)');
    if (active.length < 2) { error = 'Need at least 2 responses to aggregate.'; return; }

    loading = true;
    error = '';
    summary = '';

    const prompt = [
      `Read these ${active.length} model responses and produce an aggregated voting summary.`,
      `For each distinct finding or point, show how many models raised it (e.g., "3/3 models flagged X").`,
      `Also note any disagreements where models gave conflicting answers.`,
      `Format as bullet points. Keep each point to 1 sentence.`,
      ``,
      active.map((r, i) => `--- ${r.label || `Model ${i + 1}`} ---\n${r.text.slice(0, 800)}`).join('\n\n'),
    ].join('\n');

    try {
      const res = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses: active,
          voting: true,
          _promptOverride: prompt,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      summary = data.synthesis || '(empty summary)';
    } catch (e: any) {
      error = e.message || 'Vote summary failed';
    }
    loading = false;
  }

  let canVote = $derived(responses.filter(r => r.text && r.text !== '(empty response)').length >= 2);
</script>

<div class="vote-panel">
  <div class="vote-header">
    <span class="vote-title">Model Vote Summary</span>
    <span class="vote-badge">aggregate signal</span>
  </div>

  {#if error}
    <div class="vote-error">{error}</div>
  {/if}

  {#if !summary && !loading}
    <div class="vote-empty">
      <p>Aggregate findings across models: <em>"3/3 models flagged X"</em></p>
      <button class="vote-btn" onclick={runVote} disabled={!canVote || loading}>
        Aggregate
      </button>
    </div>
  {/if}

  {#if loading}
    <div class="vote-loading">
      <span class="spinner"></span>
      <span>Aggregating {responses.filter(r => r.text && r.text !== '(empty response)').length} responses...</span>
    </div>
  {/if}

  {#if summary}
    <div class="vote-results">
      <div class="vote-content">{summary}</div>
      <div class="vote-footnote">
        ⚠ Aggregate signals are derived from model outputs. Always review raw responses.
      </div>
      <button class="vote-btn" onclick={runVote} disabled={loading}>
        Re-aggregate
      </button>
    </div>
  {/if}
</div>

<style>
  .vote-panel {
    padding: 8px 12px;
    border-top: 1px solid var(--border-color, #2a2a3e);
    font-size: 13px;
  }

  .vote-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .vote-title {
    font-weight: 600;
    font-size: 14px;
  }

  .vote-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--success, #66bb6a);
    color: #000;
    font-weight: 600;
  }

  .vote-empty {
    text-align: center;
    padding: 12px 8px;
    opacity: 0.8;
  }

  .vote-empty p {
    margin: 4px 0;
    font-size: 12px;
  }

  .vote-btn {
    margin-top: 6px;
    padding: 6px 16px;
    border: 1px solid var(--success, #66bb6a);
    background: var(--success, #66bb6a);
    color: #000;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
  }

  .vote-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .vote-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 8px;
  }

  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid var(--border-color, #2a2a3e);
    border-top-color: var(--success, #66bb6a);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .vote-error {
    padding: 8px;
    background: rgba(229, 57, 53, 0.1);
    border: 1px solid var(--error, #e53935);
    border-radius: 4px;
    color: var(--error, #e53935);
    font-size: 12px;
    margin-bottom: 8px;
  }

  .vote-results {
    margin-top: 4px;
  }

  .vote-content {
    white-space: pre-wrap;
    font-size: 12px;
    line-height: 1.5;
    padding: 8px;
    background: rgba(255,255,255,0.03);
    border-radius: 4px;
    margin-bottom: 6px;
  }

  .vote-footnote {
    font-size: 11px;
    opacity: 0.6;
    font-style: italic;
    margin-bottom: 6px;
  }
</style>
