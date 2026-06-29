<script lang="ts">
  import {
    forkSession,
    summariseSession,
    shareSession,
    deleteSession,
  } from './opencode-bridge';
  import { relativeTime, dayGroup, truncate } from './chat-utils';

  interface Session {
    id: string;
    title?: string;
    time?: string;
    tokenCount?: number;
  }

  let {
    sessions = [],
    currentID = $bindable<string | null>(null),
    baseUrl = 'http://localhost:4096',
    vaultPath = '',
    showAll = false,
    onselect,
    onnew,
    onrefresh,
    ontoggleall,
  }: {
    sessions: Session[];
    currentID?: string | null;
    baseUrl?: string;
    vaultPath?: string;
    showAll?: boolean;
    onselect?: (id: string) => void;
    onnew?: () => void;
    onrefresh?: () => void;
    ontoggleall?: () => void;
    onreviewdiff?: (id: string) => void;
  } = $props();

  let collapsed = $state(false);
  let menuTarget = $state<string | null>(null);
  let actionMsg = $state('');

  const GROUP_ORDER: Array<{ key: string; label: string }> = [
    { key: 'today',     label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'older',     label: 'Older' },
  ];

  let grouped = $derived.by(() => {
    const groups: Record<string, Session[]> = { today: [], yesterday: [], older: [] };
    for (const s of sessions) {
      const g = dayGroup(s.time);
      groups[g].push(s);
    }
    return groups;
  });

  function closeMenu() { menuTarget = null; }

  function toggleMenu(id: string, e: Event) {
    e.stopPropagation();
    menuTarget = menuTarget === id ? null : id;
  }

  async function handleFork(session: Session) {
    closeMenu();
    try {
      const s = await forkSession(baseUrl, session.id, vaultPath);
      actionMsg = 'Forked';
      setTimeout(() => {
        onselect?.(s.id);
        onrefresh?.();
      }, 100);
    } catch {
      actionMsg = 'Fork failed';
    }
    setTimeout(() => actionMsg = '', 2000);
  }

  async function handleSummarise(session: Session) {
    closeMenu();
    try {
      await summariseSession(baseUrl, session.id, vaultPath);
      actionMsg = 'Summarised';
      onrefresh?.();
    } catch {
      actionMsg = 'Summarise failed';
    }
    setTimeout(() => actionMsg = '', 2000);
  }

  async function handleShare(session: Session) {
    closeMenu();
    try {
      const url = await shareSession(baseUrl, session.id, vaultPath);
      if (url) {
        await navigator.clipboard.writeText(url);
        actionMsg = 'URL copied';
      } else {
        actionMsg = 'No share URL';
      }
    } catch {
      actionMsg = 'Share failed';
    }
    setTimeout(() => actionMsg = '', 2000);
  }

  async function handleDelete(session: Session) {
    closeMenu();
    if (!confirm(`Delete session "${truncate(session.title, 48)}"?`)) return;
    try {
      await deleteSession(baseUrl, session.id, vaultPath);
      if (currentID === session.id) currentID = null;
      actionMsg = 'Deleted';
      onrefresh?.();
    } catch {
      actionMsg = 'Delete failed';
    }
    setTimeout(() => actionMsg = '', 2000);
  }
  function handleReviewDiff(session: Session) {
    closeMenu();
    onreviewdiff?.(session.id);
  }
</script>

<div class="session-sidebar" class:collapsed>
  <div class="sidebar-header">
    <button class="collapse-btn" onclick={() => collapsed = !collapsed} title={collapsed ? 'Expand session list' : 'Collapse session list'}>
      {collapsed ? '▶' : '▼'}
    </button>
    <span class="header-title">Sessions</span>
    {#if actionMsg}
      <span class="action-msg">{actionMsg}</span>
    {/if}
    <button class="new-btn" onclick={onnew} title="New session">＋</button>
    {#if ontoggleall}
      <button class="toggle-btn" class:active={showAll} onclick={ontoggleall} title={showAll ? 'Filter to vault sessions' : 'Show all sessions'}>
        {showAll ? '⊜' : '⊛'}
      </button>
    {/if}
  </div>

  {#if !collapsed}
    <div class="session-list">
      {#each GROUP_ORDER as group}
        {@const items = grouped[group.key]}
        {#if items.length > 0}
          <div class="group-label">{group.label}</div>
          {#each items as session (session.id)}
            <div
              class="session-row"
              class:active={session.id === currentID}
              onclick={() => { closeMenu(); onselect?.(session.id); }}
              role="button"
              tabindex="0"
              onkeydown={(e) => { if (e.key === 'Enter') { closeMenu(); onselect?.(session.id); } }}
            >
              <div class="row-title">{truncate(session.title)}</div>
              <div class="row-meta">
                <span class="row-time">{relativeTime(session.time)}</span>
                {#if session.tokenCount}
                  <span class="row-tokens">{session.tokenCount < 1000 ? session.tokenCount : (session.tokenCount / 1000).toFixed(1) + 'k'}</span>
                {/if}
                <button class="menu-btn" onclick={(e) => toggleMenu(session.id, e)} title="Session actions">⋮</button>
              </div>
            </div>
            {#if menuTarget === session.id}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div class="menu-backdrop" onclick={closeMenu}></div>
              <div class="context-menu" style="top: {/* calculated via JS below */ 0}px">
                <button class="menu-item" onclick={() => handleFork(session)}>Fork</button>
                <button class="menu-item" onclick={() => handleSummarise(session)}>Summarise</button>
                <button class="menu-item" onclick={() => handleShare(session)}>Share</button>
                <button class="menu-item" onclick={() => handleReviewDiff(session)}>Review changes</button>
                <button class="menu-item danger" onclick={() => handleDelete(session)}>Delete</button>
              </div>
            {/if}
          {/each}
        {/if}
      {/each}

      {#if sessions.length === 0}
        <div class="empty-state">No sessions yet</div>
      {/if}
    </div>
  {/if}
</div>

<style lang="scss">
  @use 'tokens' as *;

  .session-sidebar {
    border-bottom: 1px solid $border;
    flex-shrink: 0;
    position: relative;

    &.collapsed {
      .sidebar-header { border-bottom: none; }
    }
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: $bg-header;
    border-bottom: 1px solid $border;
  }

  .collapse-btn {
    @include flat-btn;
    font-size: 8px;
    padding: 0 2px;
    width: 16px;
  }

  .header-title {
    flex: 1;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: $muted;
  }

  .action-msg {
    font-size: 9px;
    color: $green;
    animation: fadeOut 2s forwards;
  }

  @keyframes fadeOut {
    0%, 70% { opacity: 1; }
    100% { opacity: 0; }
  }

  .new-btn {
    @include flat-btn;
    font-size: 13px;
    padding: 0 4px;
    &:hover { color: $blue; }
  }
  .toggle-btn {
    @include flat-btn;
    font-size: 11px;
    padding: 0 3px;
    line-height: 1;
    color: $muted;
    &.active { color: $blue; }
    &:hover { color: $fg-dim; }
  }

  .session-list {
    max-height: 220px;
    overflow-y: auto;
    overscroll-behavior: contain;
    position: relative;
  }

  .group-label {
    font-size: 9px;
    font-weight: 600;
    color: $muted;
    padding: 5px 10px 2px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .session-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    cursor: pointer;
    border-left: 2px solid transparent;
    position: relative;

    &:hover { background: $bg-hover; }
    &.active {
      background: $blue-bg;
      border-left-color: $blue;
      .row-title { color: #fff; }
    }
  }

  .row-title {
    flex: 1;
    font-size: 11px;
    color: $fg-dim;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .row-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .row-time {
    font-size: 9px;
    color: $muted;
    white-space: nowrap;
  }

  .row-tokens {
    font-size: 9px;
    color: $tag;
    background: $tag-bg;
    border: 1px solid $tag-bdr;
    border-radius: 3px;
    padding: 0 4px;
    line-height: 14px;
    white-space: nowrap;
  }

  .menu-btn {
    @include flat-btn;
    font-size: 13px;
    padding: 0 2px;
    line-height: 1;
    opacity: 0;
    .session-row:hover & { opacity: 1; }
  }

  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9;
  }

  .context-menu {
    @include context-menu;
    position: absolute;
    right: 8px;
    z-index: 10;
    min-width: 120px;
  }

  .empty-state {
    padding: 12px 10px;
    font-size: 11px;
    color: $muted;
    text-align: center;
  }
</style>
