<script lang="ts">
  let {
    frontmatter = $bindable<Record<string, any>>({}),
    collapsed = $bindable(
      typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem('propsPaneCollapsed') === 'true'
        : false
    ),
    docType = 'page',
    mode = 'read',
    onsave,
    onapprove,
    onfindrelated,
  }: {
    frontmatter: Record<string, any>;
    collapsed?: boolean;
    docType: string;
    mode: 'read' | 'edit' | 'source';
    onsave?: () => void;
    onapprove?: () => void;
    onfindrelated?: () => void;
  } = $props();

  function toggleCollapsed() {
    collapsed = !collapsed;
    if (typeof sessionStorage !== 'undefined')
      sessionStorage.setItem('propsPaneCollapsed', String(collapsed));
  }

  const SIZING = ['', 'XS', 'S', 'M', 'L', 'XL'];
  const SELECT_OPTIONS: Record<string, string[]> = {
    complexity:        SIZING,
    estimated_effort:  SIZING,
    automated:         ['off', 'guided', 'full'],
    priority:          ['', 'low', 'medium', 'high', 'critical'],
    status: {
      proposal: ['pending', 'triaged', 'evaluated', 'accepted', 'rejected'],
      plan:     ['draft', 'approved', 'in-progress', 'completed', 'canceled'],
      doc:      ['draft', 'active', 'archived'],
      page:     [],
    }[docType] ?? [],
  };

  // Keys to hide — internal noise not useful in the pane
  const HIDDEN = new Set([
    'created_by', 'scenario_synthesis', 'deferred_to', 'subsumed_by',
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
    onapprove?.();
  }

  function unapprove() {
    setField('approved', false);
    onsave?.();
  }

  // Plan actions
  function setPlanStatus(status: string) {
    setField('status', status);
    onsave?.();
  }

  // Warn if approved with no assignee
  let approvedWithoutAssignee = $derived(
    docType === 'proposal' && frontmatter.approved === true &&
    (!frontmatter.assigned_to || String(frontmatter.assigned_to).trim() === '')
  );
</script>

<div class="pane" class:collapsed>
  <div class="pane-header">
    <span class="pane-title">{collapsed ? '' : 'Properties'}</span>
    <button class="pane-toggle" onclick={toggleCollapsed} title={collapsed ? 'Show properties' : 'Hide properties'}>
      {collapsed ? '◀' : '▶'}
    </button>
  </div>

  {#if !collapsed}
    <!-- Action buttons -->
    <div class="pane-actions">
      {#if docType === 'proposal'}
        {#if !frontmatter.approved}
          <button class="act approve" onclick={approve}>Approve</button>
        {:else}
          <button class="act unapprove" onclick={unapprove}>Unapprove</button>
        {/if}
        <button class="act related" onclick={() => onfindrelated?.()}>Find Related</button>
      {/if}
      {#if docType === 'plan'}
        {#if frontmatter.status === 'approved'}
          <button class="act start" onclick={() => setPlanStatus('in-progress')}>Start</button>
        {/if}
        {#if frontmatter.status === 'in-progress'}
          <button class="act complete" onclick={() => setPlanStatus('completed')}>Complete</button>
        {/if}
        {#if frontmatter.status !== 'completed' && frontmatter.status !== 'canceled'}
          <button class="act cancel-plan" onclick={() => setPlanStatus('canceled')}>Cancel</button>
        {/if}
      {/if}
      {#if mode === 'edit'}
        <button class="act save" onclick={() => onsave?.()}>Save</button>
      {/if}
    </div>

    {#if approvedWithoutAssignee}
      <div class="warn">Approved but no assignee set</div>
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
                  <div class="chips">
                    {#each (value as string[]) as chip, idx}
                      <span class="chip rm">
                        {chip}
                        <button class="chip-x" onclick={() => removeChip(key, idx)}>×</button>
                      </span>
                    {/each}
                  </div>
                  <input class="chip-input" placeholder="add, Enter…"
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
  .pane {
    position: fixed;
    right: 0;
    top: 0;
    height: 100vh;
    width: 280px;
    background: #111;
    border-left: 1px solid #2a2a2a;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    transition: width 0.15s;
    z-index: 100;
  }
  .pane.collapsed { width: 32px; overflow: hidden; }

  .pane-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 8px 10px 12px;
    border-bottom: 1px solid #222;
    flex-shrink: 0;
  }
  .pane-title { font-size: 11px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
  .pane-toggle {
    background: none;
    border: none;
    color: #555;
    cursor: pointer;
    font-size: 11px;
    padding: 2px 4px;
    border-radius: 3px;
  }
  .pane-toggle:hover { color: #aaa; background: #1a1a1a; }

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
</style>
