<script lang="ts">
  import { showPropsPane } from './pane';

  let {
    frontmatter = $bindable<Record<string, any>>({}),
    body = '',
    docType = 'page',
    mode = 'read',
    onsave,
    onapprove,
    onfindrelated,
  }: {
    frontmatter: Record<string, any>;
    body?: string;
    docType: string;
    mode: 'read' | 'edit' | 'source';
    onsave?: (fm: Record<string, any>) => void;
    onapprove?: (fm: Record<string, any>) => void;
    onfindrelated?: () => void;
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
    tags:     ['ui', 'ux', 'governance', 'engine', 'dispatch', 'ai', 'mcp', 'phase-1', 'phase-2', 'phase-3', 'improvements', 'polish', 'bug'],
  };

  function togglePredefinedChip(key: string, val: string) {
    const current: string[] = Array.isArray(frontmatter[key]) ? frontmatter[key] : [];
    if (current.includes(val)) {
      setField(key, current.filter(v => v !== val));
    } else {
      setField(key, [...current, val]);
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
    const val = input.value.trim();
    if (!val) return;
    setField(key, [...(frontmatter[key] ?? []), val]);
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
  let pendingSteps = $derived(() => {
    if (docType !== 'plan' || !body) return 0;
    // Only count rows inside the Implementation Steps section
    const stepsMatch = body.match(/##\s+Implementation Steps[\s\S]*?(?=\n##\s|\s*$)/);
    const section = stepsMatch ? stepsMatch[0] : body;
    return (section.match(/⏳/g) ?? []).length;
  })();

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

<style>
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
    border-bottom: 1px solid #1e1e1e;
  }
  .act {
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    border: 1px solid #333;
    background: #1a1a1a;
    color: #aaa;
  }
  .act:hover { background: #222; color: #fff; }
  .act.approve  { border-color: #2b5b2b; color: #6d6; }
  .act.approve:hover  { background: #1a3a1a; }
  .act.unapprove { border-color: #5b5b2b; color: #cc6; }
  .act.start    { border-color: #2b5b84; color: #58a6ff; }
  .act.start:hover    { background: #1a3a5a; }
  .act.complete { border-color: #2b5b84; color: #58a6ff; }
  .act.complete:hover { background: #1a3a5a; }
  .act.cancel-plan { border-color: #842b2b; color: #e44; }
  .act.cancel-plan:hover { background: #3a1a1a; }
  .act.save     { border-color: #2b5b84; color: #58a6ff; }
  .act.save:hover     { background: #1a3a5a; }
  .act.related  { border-color: #4a2b84; color: #a78bfa; }
  .act.related:hover  { background: #2a1a5a; }
  .act.estimate { border-color: #2a4a3a; color: #6b9; }
  .act.estimate:hover { background: #1a3a2a; }
  .act:disabled { opacity: 0.5; cursor: default; }

  .estimate-hint {
    margin: 4px 12px 0;
    font-size: 10px;
    color: #6b9;
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
    border: 1px solid #333;
    background: #181818;
    color: #555;
    cursor: pointer;
  }
  .preset-chip:hover { border-color: #555; color: #aaa; }
  .preset-chip.active { border-color: #2b5b84; color: #58a6ff; background: #0d1f2d; }
  .preset-chip.active:hover { background: #1a3a5a; }

  .warn {
    margin: 8px 12px;
    padding: 6px 10px;
    background: #2a2000;
    border: 1px solid #554400;
    border-radius: 4px;
    font-size: 11px;
    color: #cc6;
  }

  .pane-fields { padding: 8px 0; }

  .field { padding: 6px 12px; }
  .field-label {
    font-size: 10px;
    font-weight: 600;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-bottom: 3px;
  }

  .fval { font-size: 12px; color: #aaa; word-break: break-word; }
  .fval.muted { color: #444; }
  .fval.bool { font-size: 12px; }
  .fval.bool.yes { color: #6d6; }

  .finput {
    width: 100%;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 3px;
    color: #e0e0e0;
    font-size: 12px;
    padding: 4px 6px;
    box-sizing: border-box;
  }
  .finput:focus { outline: none; border-color: #2b5b84; }
  select.finput { cursor: pointer; }

  .chips { display: flex; flex-wrap: wrap; gap: 3px; }
  .chip {
    background: #1e2a3a;
    border: 1px solid #2b3a4a;
    border-radius: 10px;
    padding: 1px 7px;
    font-size: 11px;
    color: #7ab;
  }
  .chip.rm { padding-right: 3px; }
  .chip-x {
    background: none;
    border: none;
    color: #556;
    cursor: pointer;
    font-size: 11px;
    padding: 0 2px;
    margin-left: 2px;
  }
  .chip-x:hover { color: #e44; }
  .chips-edit { display: flex; flex-direction: column; gap: 4px; }
  .chip-input {
    width: 100%;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 3px;
    color: #e0e0e0;
    font-size: 11px;
    padding: 3px 6px;
    box-sizing: border-box;
  }
  .chip-input:focus { outline: none; border-color: #2b5b84; }

  /* Panel.svelte handles all responsive sizing and positioning */
</style>
