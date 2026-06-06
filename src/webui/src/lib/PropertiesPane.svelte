<script lang="ts">
  import { showPropsPane, featureFlags } from './pane';

  let {
    frontmatter = $bindable<Record<string, any>>({}),
    body = '',
    docType = 'page',
    mode = 'read',
    onsave,
    onapprove,
    onfindrelated,
    onplan,
  }: {
    frontmatter: Record<string, any>;
    body?: string;
    docType: string;
    mode: 'read' | 'edit' | 'source';
    onsave?: (fm: Record<string, any>) => void;
    onapprove?: (fm: Record<string, any>) => void;
    onfindrelated?: () => void;
    onplan?: () => void;
  } = $props();

  const SELECT_OPTIONS: Record<string, string[]> = {
    complexity:        ['', 'low', 'medium', 'high'],
    estimated_effort:  ['', 'XS', 'S', 'M', 'L', 'XL'],
    automated:         ['off', 'guided', 'full'],
    priority:          ['', 'low', 'medium', 'high', 'critical'],
    status: {
      proposal: ['pending', 'triaged', 'evaluated', 'accepted', 'rejected'],
      plan:     ['draft', 'approved', 'in-progress', 'completed', 'canceled'],
      doc:      ['draft', 'active', 'archived'],
      page:     [],
    }[docType] ?? [],
  };

  const PREDEFINED_CHIPS: Record<string, string[]> = {
    category: ['ui', 'ux', 'governance', 'engine', 'dispatch', 'ai', 'mcp', 'infrastructure', 'profiles', 'security', 'testing', 'documentation'],
    tags:     [], // populated dynamically from vault
  };

  // Load vault tags for autocomplete
  let vaultTags = $state<string[]>([]);
  fetch('/api/tags').then(r => r.json()).then(d => {
    vaultTags = (d.tags ?? []).map((t: { tag: string }) => t.tag);
    PREDEFINED_CHIPS.tags = vaultTags.slice(0, 24);
  }).catch(() => {});

  function normalizeTag(raw: string): string {
    return raw.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  function togglePredefinedChip(key: string, val: string) {
    const normalized = key === 'tags' ? normalizeTag(val) : val;
    const current: string[] = Array.isArray(frontmatter[key]) ? frontmatter[key] : [];
    if (current.includes(normalized)) {
      setField(key, current.filter(v => v !== normalized));
    } else {
      setField(key, [...current, normalized]);
    }
  }

  // Keys to hide — internal noise not useful in the pane
  const HIDDEN = new Set([
    '_path', 'created_by', 'scenario_synthesis', 'deferred_to', 'subsumed_by',
    'docwrightProfileVersion',
  ]);

  function fieldType(key: string, val: any): 'hidden' | 'checkbox' | 'date' | 'chips' | 'select' | 'text' {
    if (HIDDEN.has(key))                                              return 'hidden';
    if (typeof val === 'boolean')                                     return 'checkbox';
    if (['created', 'due_date', 'completed_date', 'canceled_date'].includes(key)) return 'date';
    if (Array.isArray(val))                                           return 'chips';
    if (key in SELECT_OPTIONS && SELECT_OPTIONS[key].length > 0)     return 'select';
    return 'text';
  }

  function setField(key: string, val: any) {
    frontmatter = { ...frontmatter, [key]: val };
  }

  function addChip(key: string, e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    const input = e.target as HTMLInputElement;
    const raw = input.value.trim();
    if (!raw) return;
    const val = key === 'tags' ? normalizeTag(raw) : raw;
    if (!val) return;
    const current: string[] = frontmatter[key] ?? [];
    if (!current.includes(val)) setField(key, [...current, val]);
    input.value = '';
    e.preventDefault();
  }

  function removeChip(key: string, idx: number) {
    const arr = [...(frontmatter[key] ?? [])];
    arr.splice(idx, 1);
    setField(key, arr);
  }

  // Proposal actions
  function approve() {
    setField('approved', true);
    onapprove?.(frontmatter);
  }

  function unapprove() {
    setField('approved', false);
    onsave?.(frontmatter);
  }

  // Plan actions
  function setPlanStatus(status: string) {
    setField('status', status);
    onsave?.(frontmatter);
  }

  let estimating = $state(false);
  let estimateHint = $state('');

  async function estimateComplexity() {
    const path = frontmatter._path ?? '';
    if (!path) return;
    estimating = true;
    estimateHint = '';
    try {
      const res = await fetch('/api/estimate-complexity?path=' + encodeURIComponent(path));
      if (res.ok) {
        const { complexity, reason } = await res.json();
        setField('complexity', complexity);
        estimateHint = reason;
        setTimeout(() => estimateHint = '', 6000);
      }
    } finally {
      estimating = false;
    }
  }

  // Count ⏳ Pending step rows — blocks Complete button
  let pendingSteps = $derived.by(() => {
    if (docType !== 'plan' || !body) return 0;
    // Only count rows inside the Implementation Steps section
    const stepsMatch = body.match(/##\s+Implementation Steps[\s\S]*?(?=\n##\s|\s*$)/);
    const section = stepsMatch ? stepsMatch[0] : body;
    return (section.match(/⏳/g) ?? []).length;
  });

  // Warn if approved with no assignee
  let approvedWithoutAssignee = $derived(
    docType === 'proposal' && frontmatter.approved === true &&
    (!frontmatter.assigned_to || String(frontmatter.assigned_to).trim() === '')
  );
</script>

<div class="pane-inner">
  {#if true}
    <!-- Action buttons -->
    <div class="pane-actions">
      {#if docType === 'proposal'}
        {#if !frontmatter.approved}
          <button class="act approve" onclick={approve}
            title="Set approved: true and save — marks this proposal as approved for planning">Approve</button>
        {:else}
          <button class="act unapprove" onclick={unapprove}
            title="Revoke approval — sets approved: false">Unapprove</button>
        {/if}
        {#if frontmatter.approved && $featureFlags.showPlanButton}
          <button class="act plan" onclick={() => onplan?.()}
            title="Scan related proposals and scaffold a plan — bundles this proposal with linked items">Plan →</button>
        {/if}
        <button class="act related" onclick={() => onfindrelated?.()}
          title="Scan vault for proposals with similar content using keyword matching">Find Related</button>
        <button class="act estimate" onclick={estimateComplexity} disabled={estimating}
          title="Estimate complexity based on proposal scope, dependencies, and length">
          {estimating ? '…' : '⟳ Complexity'}
        </button>
      {/if}
      {#if docType === 'plan'}
        {#if frontmatter.status === 'approved'}
          <button class="act start" onclick={() => setPlanStatus('in-progress')}
            title="Set status: in-progress — marks this plan as actively being worked">Start</button>
        {/if}
        {#if frontmatter.status === 'in-progress'}
          <button class="act complete" onclick={() => setPlanStatus('completed')}
            disabled={pendingSteps > 0}
            title={pendingSteps > 0
              ? `${pendingSteps} step${pendingSteps === 1 ? '' : 's'} still ⏳ Pending — update the step table first`
              : 'Set status: completed and move plan to plans/completed/'}>
            Complete{pendingSteps > 0 ? ` (${pendingSteps} pending)` : ''}
          </button>
        {/if}
        {#if frontmatter.status !== 'completed' && frontmatter.status !== 'canceled'}
          <button class="act cancel-plan" onclick={() => setPlanStatus('canceled')}
            title="Set status: canceled — plan will no longer appear as active">Cancel</button>
        {/if}
      {/if}
      {#if mode === 'edit'}
        <button class="act save" onclick={() => onsave?.(frontmatter)}
          title="Save changes to disk and commit frontmatter">Save</button>
      {/if}
    </div>

    {#if approvedWithoutAssignee}
      <div class="warn">Approved but no assignee set</div>
    {/if}
    {#if estimateHint}
      <div class="estimate-hint">{estimateHint}</div>
    {/if}

    <!-- Fields -->
    <div class="pane-fields">
      {#each Object.entries(frontmatter) as [key, value]}
        {@const ftype = fieldType(key, value)}
        {#if ftype !== 'hidden'}
          <div class="field">
            <div class="field-label">{key.replace(/_/g, ' ')}</div>
            {#if mode === 'read'}
              <!-- Display only -->
              {#if ftype === 'checkbox'}
                <span class="fval bool" class:yes={value === true}>{value === true ? '✓ yes' : '✗ no'}</span>
              {:else if ftype === 'chips'}
                <div class="chips">
                  {#each (value as string[]) as chip}
                    <span class="chip">{chip}</span>
                  {:else}
                    <span class="fval muted">—</span>
                  {/each}
                </div>
              {:else}
                <span class="fval">{value !== '' && value != null ? value : '—'}</span>
              {/if}
            {:else}
              <!-- Editable -->
              {#if ftype === 'checkbox'}
                <input type="checkbox" checked={value === true}
                  onchange={(e) => setField(key, (e.target as HTMLInputElement).checked)} />
              {:else if ftype === 'chips'}
                <div class="chips-edit">
                  {#if PREDEFINED_CHIPS[key]}
                    <div class="chip-presets">
                      {#each PREDEFINED_CHIPS[key] as preset}
                        {@const active = (value as string[]).includes(preset)}
                        <button class="preset-chip" class:active
                          onclick={() => togglePredefinedChip(key, preset)}
                          title={active ? `Remove "${preset}"` : `Add "${preset}"`}>
                          {preset}
                        </button>
                      {/each}
                    </div>
                  {/if}
                  <div class="chips">
                    {#each (value as string[]) as chip, idx}
                      <span class="chip rm">
                        {chip}
                        <button class="chip-x" onclick={() => removeChip(key, idx)}>×</button>
                      </span>
                    {/each}
                  </div>
                  <input class="chip-input" placeholder="custom value, Enter…"
                    onkeydown={(e) => addChip(key, e)} />
                </div>
              {:else if ftype === 'select'}
                <select class="finput"
                  onchange={(e) => setField(key, (e.target as HTMLSelectElement).value)}>
                  {#each SELECT_OPTIONS[key] as opt}
                    <option value={opt} selected={opt === String(value)}>{opt || '—'}</option>
                  {/each}
                </select>
              {:else if ftype === 'date'}
                <input class="finput" type="date" value={String(value).slice(0, 10)}
                  onchange={(e) => setField(key, (e.target as HTMLInputElement).value)} />
              {:else}
                <input class="finput" type="text" value={String(value ?? '')}
                  oninput={(e) => setField(key, (e.target as HTMLInputElement).value)} />
              {/if}
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style lang="scss">
  @use 'tokens' as *;

  /* Panel.svelte provides the outer container — pane-inner fills it */
  .pane-inner {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .pane-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 10px 12px;
    border-bottom: 1px solid $border;
  }

  .act {
    @include act-base;
    &.approve    { @include act-variant($green,   $green-bg,   $green-bdr); }
    &.plan       { @include act-variant($magenta,  $magenta-bg, $magenta-bdr); }
    &.unapprove  { border-color: $amber-bdr; color: $amber; }
    &.start,
    &.complete,
    &.save       { @include act-variant($blue,    $blue-bg,    $blue-bdr); }
    &.cancel-plan{ @include act-variant($red,     $red-bg,     $red-bdr); }
    &.related    { @include act-variant($purple,  $purple-bg,  $purple-bdr); }
    &.estimate   { @include act-variant($teal,    $teal-bg,    $teal-bdr); }
  }

  .estimate-hint {
    margin: 4px 12px 0;
    font-size: 10px;
    color: $teal;
    font-style: italic;
  }

  .chip-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-bottom: 5px;
  }

  .preset-chip {
    font-size: 10px;
    padding: 1px 7px;
    border-radius: 8px;
    border: 1px solid $border;
    background: $bg;
    color: $muted;
    cursor: pointer;
    &:hover { border-color: $muted; color: $fg-dim; }
    &.active {
      border-color: $blue-bdr;
      color: $blue;
      background: $blue-bg;
      &:hover { background: mix(white, #1a3a5a, 15%); }
    }
  }

  .warn {
    margin: 8px 12px;
    padding: 6px 10px;
    background: #2a2000;
    border: 1px solid #554400;
    border-radius: 4px;
    font-size: 11px;
    color: $amber;
  }

  :global(html[data-theme="light"]) {
    .preset-chip.active { background: #ddeeff; border-color: $blue-bdr; color: $blue; }
    .warn { background: #fff8cc; border-color: #e8d400; color: #7a6000; }
  }

  .pane-fields { padding: 8px 0; }

  .field {
    padding: 6px 12px;
  }

  .field-label {
    @include section-header;
    padding: 0;
    margin-bottom: 3px;
  }

  .fval {
    font-size: 12px;
    color: $fg-dim;
    word-break: break-word;
    &.muted { color: $muted; }
    &.bool { font-size: 12px; &.yes { color: $green; } }
  }

  .finput {
    width: 100%;
    background: $bg-2;
    border: 1px solid $border;
    border-radius: 3px;
    color: $fg;
    font-size: 12px;
    padding: 4px 6px;
    box-sizing: border-box;
    &:focus { outline: none; border-color: $blue-bdr; }
  }
  select.finput { cursor: pointer; }

  .chips { display: flex; flex-wrap: wrap; gap: 3px; }

  .chip {
    background: $tag-bg;
    border: 1px solid $tag-bdr;
    border-radius: 10px;
    padding: 1px 7px;
    font-size: 11px;
    color: $tag;
    &.rm { padding-right: 3px; }
  }

  .chip-x {
    background: none;
    border: none;
    color: $muted;
    cursor: pointer;
    font-size: 11px;
    padding: 0 2px;
    margin-left: 2px;
    &:hover { color: $red; }
  }

  .chips-edit { display: flex; flex-direction: column; gap: 4px; }

  .chip-input {
    @include inline-input;
    font-size: 11px;
    padding: 3px 6px;
    &:focus { border-color: $blue-bdr; }
  }

  /* Panel.svelte handles all responsive sizing and positioning */
</style>
