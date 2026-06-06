<script lang="ts">
  import { goto } from '$app/navigation';

  interface DocEntry {
    path: string; title: string; created: string;
    tags: string[]; category: string[]; complexity: string;
    status: string; priority: string; assigned_to: string;
  }

  let {
    deferred = [] as DocEntry[],
    open     = [] as DocEntry[],
    approved = [] as DocEntry[],
    active   = [] as DocEntry[],
    completedCount = 0,
  }: {
    deferred?: DocEntry[];
    open?: DocEntry[];
    approved?: DocEntry[];
    active?: DocEntry[];
    completedCount?: number;
  } = $props();

  const STAGES = [
    { id: 'deferred',   label: 'Deferred Ideas',  items: () => deferred },
    { id: 'open',       label: 'Open Proposals',  items: () => open },
    { id: 'approved',   label: 'Approved',        items: () => approved },
    { id: 'active',     label: 'Active Plans',    items: () => active },
    { id: 'completed',  label: 'Completed',       items: () => [] },
  ];

  function navTo(entry: DocEntry) {
    goto('/' + entry.path.replace(/\.md$/, ''));
  }

  function complexityDot(c: string) {
    if (c === 'high')   return '🔴';
    if (c === 'medium') return '🟡';
    if (c === 'low')    return '🟢';
    return '';
  }

  function priorityClass(p: string) {
    if (p === 'high' || p === 'critical') return 'pri-high';
    if (p === 'medium') return 'pri-med';
    return '';
  }
</script>

<div class="funnel">
  {#each STAGES as stage, i}
    {@const items = stage.items()}
    {@const count = stage.id === 'completed' ? completedCount : items.length}

    <div class="stage">
      <div class="stage-header stage-{stage.id}">
        <span class="stage-label">{stage.label}</span>
        <span class="stage-count">{count}</span>
      </div>

      <div class="cards">
        {#if stage.id === 'completed'}
          <div class="completed-pill stage-{stage.id}">
            {completedCount} plan{completedCount === 1 ? '' : 's'} shipped
          </div>
        {:else if items.length === 0}
          <div class="empty-lane">—</div>
        {:else}
          {#each items as item}
            <button class="card stage-card-{stage.id}" onclick={() => navTo(item)}
              title="{item.title}">
              <div class="card-title">{item.title}</div>
              <div class="card-meta">
                {#if item.complexity}<span class="complexity">{complexityDot(item.complexity)}</span>{/if}
                {#if item.priority}<span class="priority {priorityClass(item.priority)}">{item.priority}</span>{/if}
                {#if item.assigned_to && item.assigned_to !== 'undefined'}<span class="assignee">{item.assigned_to}</span>{/if}
              </div>
            </button>
          {/each}
        {/if}
      </div>
    </div>

    <!-- Arrow between stages -->
    {#if i < STAGES.length - 1}
      <div class="arrow">›</div>
    {/if}
  {/each}
</div>

<style lang="scss">
  @use 'tokens' as *;

  .funnel { display: flex; align-items: flex-start; gap: 0; padding: 16px; overflow-x: auto; min-height: 300px; }

  .stage { flex: 1; min-width: 160px; max-width: 220px; display: flex; flex-direction: column; gap: 6px; }
  .stage-header { display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; border-radius: 6px 6px 0 0; border: 1px solid transparent; border-bottom: none; flex-shrink: 0; }
  .stage-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .stage-count { font-size: 13px; font-weight: 700; }

  // Stage header colours — dark mode defaults
  .stage-deferred  { background: $bg-3;      color: $muted;   border-color: $border; }
  .stage-open      { background: #1a2f4a;    color: #58a6ff;  border-color: #2b5b84; }
  .stage-approved  { background: #1a3a2a;    color: #6d6;     border-color: #2b5b2b; }
  .stage-active    { background: #2a1a4a;    color: #a78bfa;  border-color: #4a2b84; }
  .stage-completed { background: #1a2a1a;    color: #4a8;     border-color: #2a4a2a; }

  // Light theme — readable pastels
  :global(html[data-theme="light"]) {
    .stage-deferred  { background: #e8e8e8; color: #666;    border-color: #ccc; }
    .stage-open      { background: #ddeeff; color: #2a6090; border-color: #aaccee; }
    .stage-approved  { background: #ddffdd; color: #2a6a2a; border-color: #aaddaa; }
    .stage-active    { background: #eeddff; color: #5a2a8a; border-color: #ccaaee; }
    .stage-completed { background: #e8f5e8; color: #2a5a2a; border-color: #aaccaa; }
    .card { background: #fff; border-color: #ddd; }
    .card:hover { background: #f5f5f5; }
    .card-title { color: #1a1a1a; }
  }

  .cards { display: flex; flex-direction: column; gap: 4px; flex: 1; background: $bg; border: 1px solid $border; border-radius: 0 0 6px 6px; padding: 6px; min-height: 120px; }

  .card {
    background: $bg-2; border: 1px solid $border; border-radius: 4px;
    padding: 6px 8px; text-align: left; cursor: pointer; font: inherit; width: 100%;
    transition: background 0.1s, border-color 0.1s;
    &:hover { background: $bg-hover; }
  }

  .card-title { font-size: 11px; color: $fg; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 4px; }
  .card-meta  { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
  .complexity { font-size: 9px; }
  .priority   { font-size: 9px; color: $muted; }
  .pri-high   { color: #e87; }
  .pri-med    { color: $amber; }
  .assignee   { font-size: 9px; color: $muted; }

  .empty-lane { font-size: 11px; color: $border; text-align: center; padding: 12px 0; }

  .completed-pill { border: 1px solid; border-radius: 6px; padding: 10px 8px; font-size: 12px; text-align: center; font-weight: 600; margin-top: 4px; }

  .arrow { font-size: 20px; color: $border; padding: 0 2px; margin-top: 32px; flex-shrink: 0; align-self: flex-start; user-select: none; }

  @media (max-width: 768px) {
    .funnel { flex-direction: column; overflow-x: visible; }
    .stage { min-width: unset; max-width: unset; width: 100%; }
    .arrow { transform: rotate(90deg); align-self: center; margin: 0; }
  }
</style>
