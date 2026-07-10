<script lang="ts">
  import { tick } from 'svelte';

  let {
    steps = {} as Record<string, string>,
    sections = {} as Record<string, string>,
    analyses = {} as Record<string, string>,
    overview = '',
    status = '',
    loading = false,
    canRerun = false,
    applying = false,
    stepsPrompts = {} as Record<string, any>,
    stepsThinking = {} as Record<string, string>,
    sectionsPrompts = {} as Record<string, any>,
    sectionsThinking = {} as Record<string, string>,
    analysesPrompts = {} as Record<string, any>,
    analysesThinking = {} as Record<string, string>,
    overviewPrompt = {} as any,
    overviewThinking = '',
    ondismiss,
    onrerun,
    onapply,
  }: {
    steps?: Record<string, string>;
    sections?: Record<string, string>;
    analyses?: Record<string, string>;
    overview?: string;
    status?: string;
    loading?: boolean;
    canRerun?: boolean;
    applying?: boolean;
    stepsPrompts?: Record<string, any>;
    stepsThinking?: Record<string, string>;
    sectionsPrompts?: Record<string, any>;
    sectionsThinking?: Record<string, string>;
    analysesPrompts?: Record<string, any>;
    analysesThinking?: Record<string, string>;
    overviewPrompt?: any;
    overviewThinking?: string;
    ondismiss?: () => void;
    onrerun?: () => void;
    onapply?: () => void;
  } = $props();

  let scrollEl: HTMLDivElement | undefined = $state();

  let elapsed = $state(0);
  let elapsedTimer: ReturnType<typeof setInterval> | undefined = $state();

  $effect(() => {
    if (loading) {
      elapsed = 0;
      elapsedTimer = setInterval(() => elapsed++, 1000);
    } else {
      if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = undefined; }
    }
    return () => { if (elapsedTimer) clearInterval(elapsedTimer); };
  });

  async function scrollToBottom() {
    await tick();
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  $effect(() => {
    if (loading) scrollToBottom();
  });

  const hasResults = $derived(
    Object.keys(steps).length > 0 || Object.keys(sections).length > 0 || Object.keys(analyses).length > 0 || overview.length > 0
  );

  const stepNumbers = $derived(
    Object.keys(steps).sort((a, b) => Number(a) - Number(b))
  );
  const sectionKeys = $derived(Object.keys(sections));
  const analysisKeys = $derived(Object.keys(analyses));

  function groupLabel(key: string): string {
    if (key === 'goal') return 'Core Goal';
    if (key === 'steps') return 'Suggested Steps';
    if (key === 'gaps') return 'Gaps & Observations';
    if (key === 'preconditions') return 'Preconditions';
    return key.charAt(0).toUpperCase() + key.slice(1);
  }
</script>

<div class="panel">
  <div class="panel-header">
    <span class="panel-title">AI Review</span>
    {#if hasResults && canRerun}
      <button class="rerun-btn" onclick={onrerun} title="Plan was edited — re-run critique" disabled={loading || applying}>↺</button>
    {/if}
    <button class="close-btn" onclick={ondismiss} title="Close" disabled={applying}>← Props</button>
  </div>

  <div class="content-scroll" class:streaming={loading} bind:this={scrollEl}>
    {#if loading}
      <div class="status-line">{status || 'Reviewing plan...'} <span class="elapsed">({elapsed}s)</span></div>
    {/if}

    {#if hasResults}
      {#if stepNumbers.length > 0}
        <div class="group">
          <div class="group-header">Steps</div>
          {#each stepNumbers as num (num)}
            <div class="item" class:done={steps[num] && !steps[num].startsWith('Error:')} class:error={steps[num].startsWith('Error:')}>
              {#if stepsPrompts[num]}
                <div class="working-section">
                  {#if stepsPrompts[num].model}
                    <div class="meta-line">📦 <strong>Model:</strong> {stepsPrompts[num].model}</div>
                  {/if}
                  {#if stepsPrompts[num].systemPrompt}
                    <div class="prompt-block">
                      <div class="prompt-label">🔧 System Prompt:</div>
                      <pre class="prompt-text">{stepsPrompts[num].systemPrompt}</pre>
                    </div>
                  {/if}
                  {#if stepsPrompts[num].userPrompt}
                    <div class="prompt-block">
                      <div class="prompt-label">❓ User Prompt:</div>
                      <pre class="prompt-text">{stepsPrompts[num].userPrompt}</pre>
                    </div>
                  {/if}
                </div>
              {/if}
              {#if stepsThinking[num]}
                <div class="thinking-block">
                  <div class="thinking-label">💭 AI Thinking:</div>
                  <pre class="thinking-text">{stepsThinking[num]}</pre>
                </div>
              {/if}
              <div class="answer-block">
                <span class="item-icon">{steps[num].startsWith('Error:') ? '⚠' : '✅'}</span>
                <span class="item-label">Step {num}</span>
                <pre class="item-text">{steps[num]}</pre>
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if analysisKeys.length > 0}
        <div class="group">
          <div class="group-header">Plan Analysis</div>
          {#each analysisKeys as key (key)}
            <div class="item" class:done={analyses[key] && !analyses[key].startsWith('Error:')} class:error={analyses[key].startsWith('Error:')}>
              {#if analysesPrompts[key]}
                <div class="working-section">
                  {#if analysesPrompts[key].model}
                    <div class="meta-line">📦 <strong>Model:</strong> {analysesPrompts[key].model}</div>
                  {/if}
                  {#if analysesPrompts[key].systemPrompt}
                    <div class="prompt-block">
                      <div class="prompt-label">🔧 System Prompt:</div>
                      <pre class="prompt-text">{analysesPrompts[key].systemPrompt}</pre>
                    </div>
                  {/if}
                  {#if analysesPrompts[key].userPrompt}
                    <div class="prompt-block">
                      <div class="prompt-label">❓ User Prompt:</div>
                      <pre class="prompt-text">{analysesPrompts[key].userPrompt}</pre>
                    </div>
                  {/if}
                </div>
              {/if}
              {#if analysesThinking[key]}
                <div class="thinking-block">
                  <div class="thinking-label">💭 AI Thinking:</div>
                  <pre class="thinking-text">{analysesThinking[key]}</pre>
                </div>
              {/if}
              <div class="answer-block">
                <span class="item-icon">{analyses[key].startsWith('Error:') ? '⚠' : '💡'}</span>
                <span class="item-label">{groupLabel(key)}</span>
                <pre class="item-text">{analyses[key]}</pre>
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if sectionKeys.length > 0}
        <div class="group">
          <div class="group-header">Sections</div>
          {#each sectionKeys as key (key)}
            <div class="item" class:done={sections[key] && !sections[key].startsWith('Error:')} class:error={sections[key].startsWith('Error:')}>
              {#if sectionsPrompts[key]}
                <div class="working-section">
                  {#if sectionsPrompts[key].model}
                    <div class="meta-line">📦 <strong>Model:</strong> {sectionsPrompts[key].model}</div>
                  {/if}
                  {#if sectionsPrompts[key].systemPrompt}
                    <div class="prompt-block">
                      <div class="prompt-label">🔧 System Prompt:</div>
                      <pre class="prompt-text">{sectionsPrompts[key].systemPrompt}</pre>
                    </div>
                  {/if}
                  {#if sectionsPrompts[key].userPrompt}
                    <div class="prompt-block">
                      <div class="prompt-label">❓ User Prompt:</div>
                      <pre class="prompt-text">{sectionsPrompts[key].userPrompt}</pre>
                    </div>
                  {/if}
                </div>
              {/if}
              {#if sectionsThinking[key]}
                <div class="thinking-block">
                  <div class="thinking-label">💭 AI Thinking:</div>
                  <pre class="thinking-text">{sectionsThinking[key]}</pre>
                </div>
              {/if}
              <div class="answer-block">
                <span class="item-icon">{sections[key].startsWith('Error:') ? '⚠' : '✅'}</span>
                <span class="item-label">{groupLabel(key)}</span>
                <pre class="item-text">{sections[key]}</pre>
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if overview}
        <div class="group">
          <div class="group-header">Overall Assessment</div>
          {#if overviewPrompt}
            <div class="working-section">
              {#if overviewPrompt.model}
                <div class="meta-line">📦 <strong>Model:</strong> {overviewPrompt.model}</div>
              {/if}
              {#if overviewPrompt.systemPrompt}
                <div class="prompt-block">
                  <div class="prompt-label">🔧 System Prompt:</div>
                  <pre class="prompt-text">{overviewPrompt.systemPrompt}</pre>
                </div>
              {/if}
              {#if overviewPrompt.userPrompt}
                <div class="prompt-block">
                  <div class="prompt-label">❓ User Prompt:</div>
                  <pre class="prompt-text">{overviewPrompt.userPrompt}</pre>
                </div>
              {/if}
            </div>
          {/if}
          {#if overviewThinking}
            <div class="thinking-block">
              <div class="thinking-label">💭 AI Thinking:</div>
              <pre class="thinking-text">{overviewThinking}</pre>
            </div>
          {/if}
          <div class="answer-block">
            <pre class="overview-text" class:error={overview.startsWith('Error:')}>{overview}</pre>
          </div>
        </div>
      {/if}
    {:else if !loading}
      <div class="empty">
        <div>No review yet.</div>
        <button class="run-btn" onclick={onrerun}>Generate Review</button>
      </div>
    {/if}
  </div>

  {#if !loading && hasResults}
    <div class="panel-footer">
      <button class="dismiss-btn" onclick={ondismiss}>Dismiss</button>
      <button class="apply-btn" onclick={() => onapply?.()} title="Apply review findings to the plan" disabled={applying}>{applying ? 'Applying...' : 'Apply Review'}</button>
    </div>
  {/if}
</div>

<style lang="scss">
  @use 'tokens' as *;

  .panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

  .panel-header { display: flex; align-items: center; gap: 6px; padding: 12px 16px; border-bottom: 1px solid $border; flex-shrink: 0; }
  .panel-title  { @include section-header; padding: 0; flex: 1; }
  .rerun-btn    { @include flat-btn; border: 1px solid $border; border-radius: 3px; padding: 1px 6px; font-size: 13px; &:hover:not(:disabled) { color: $blue; border-color: $blue-bdr; } &:disabled { opacity: 0.4; cursor: default; } }
  .close-btn    { @include flat-btn; border: 1px solid $border; border-radius: 3px; font-size: 10px; padding: 1px 6px; white-space: nowrap; &:hover { color: $fg-dim; border-color: $muted; } &:disabled { opacity: 0.4; cursor: default; &:hover { color: inherit; border-color: $border; } } }

  .empty { padding: 24px 16px; color: $muted; font-size: 13px; text-align: center; line-height: 1.6; }
  .run-btn { margin-top: 12px; padding: 8px 20px; border: 1px solid $blue-bdr; border-radius: 6px; background: $blue-bg; color: $blue; font-size: 13px; font-weight: 600; cursor: pointer; &:hover { filter: brightness(1.3); } }

  .content-scroll { flex: 1; overflow-y: auto; padding: 12px 16px; }
  .content-scroll.streaming { font-family: monospace; font-size: 12px; line-height: 1.6; color: $fg; }

  .status-line { color: $blue; font-weight: 600; margin-bottom: 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .status-line .elapsed { font-weight: 400; opacity: 0.7; }

  .group { margin-bottom: 16px; &:last-child { margin-bottom: 0; } }

  .group-header { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: $muted; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid $border; }

  .item { display: flex; flex-direction: column; gap: 8px; padding: 6px 8px; margin-bottom: 4px; border-radius: 4px; background: $bg-2; }
  .item.done { border-left: 2px solid $green; }
  .item.error { border-left: 2px solid $red; }

  .working-section { display: flex; flex-direction: column; gap: 6px; padding: 8px; background: rgba(100, 150, 200, 0.08); border-left: 2px solid $blue; border-radius: 3px; margin-bottom: 8px; }
  .meta-line { font-size: 10px; color: $fg-dim; }

  .prompt-block { display: flex; flex-direction: column; gap: 4px; }
  .prompt-label { font-size: 10px; font-weight: 600; color: $fg-dim; text-transform: uppercase; letter-spacing: 0.5px; }
  .prompt-text { font-family: monospace; font-size: 10px; line-height: 1.4; color: $fg; margin: 0; padding: 6px; background: transparent; border-radius: 3px; overflow-x: auto; max-height: 100px; overflow-y: auto; }

  .thinking-block { display: flex; flex-direction: column; gap: 4px; padding: 8px; background: rgba(200, 150, 100, 0.08); border-left: 2px solid #d4a574; border-radius: 3px; margin-bottom: 8px; }
  .thinking-label { font-size: 10px; font-weight: 600; color: $fg-dim; text-transform: uppercase; letter-spacing: 0.5px; }
  .thinking-text { font-family: monospace; font-size: 10px; line-height: 1.4; color: $fg; margin: 0; padding: 6px; background: transparent; border-radius: 3px; overflow-x: auto; max-height: 150px; overflow-y: auto; }

  .answer-block { display: flex; align-items: flex-start; gap: 8px; }
  .item-icon { flex-shrink: 0; font-size: 12px; line-height: 1.5; }
  .item-label { flex-shrink: 0; font-size: 11px; font-weight: 600; color: $fg-dim; line-height: 1.5; min-width: 48px; }
  .item-text { flex: 1; font-family: inherit; font-size: 12px; line-height: 1.5; color: $fg; white-space: pre-wrap; margin: 0; }

  .overview-text { font-family: inherit; font-size: 12px; line-height: 1.6; color: $fg; white-space: pre-wrap; margin: 0; padding: 8px; background: $bg-2; border-radius: 4px; }
  .overview-text.error { color: $red; }

  .panel-footer { flex-shrink: 0; display: flex; gap: 8px; padding: 10px 16px; border-top: 1px solid $border; justify-content: flex-end; }
  .dismiss-btn { padding: 8px 12px; border: 1px solid $border; border-radius: 6px; background: none; color: $muted; font-size: 12px; cursor: pointer; &:hover { color: $fg; border-color: $muted; } &:disabled { opacity: 0.4; cursor: default; &:hover { color: $muted; border-color: $border; } } }
  .apply-btn   { padding: 8px 12px; border: 1px solid $green-bdr; border-radius: 6px; background: $green-bg; color: $green; font-size: 12px; font-weight: 600; cursor: pointer; &:hover { filter: brightness(1.3); } &:disabled { opacity: 0.4; cursor: default; filter: none; } }
</style>
