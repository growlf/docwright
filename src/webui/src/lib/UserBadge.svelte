<script lang="ts">
  import type { DocWrightUser } from '../../../app.js';

  let { user }: { user: DocWrightUser | null } = $props();

  let open = $state(false);

  function toggle() { open = !open; }

  async function signOut() {
    await fetch('/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }
</script>

{#if user}
  <div class="user-badge" class:open>
    <button class="badge-btn" onclick={toggle} title={user.displayName} aria-label="User menu">
      {#if user.avatarUrl}
        <img class="avatar" src={user.avatarUrl} alt={user.displayName} />
      {:else}
        <span class="avatar-initials">{user.displayName.slice(0, 2).toUpperCase()}</span>
      {/if}
    </button>
    {#if open}
      <div class="badge-menu">
        <div class="badge-name">{user.displayName}</div>
        <div class="badge-username">@{user.username}</div>
        <hr class="badge-sep" />
        <button class="badge-signout" onclick={signOut}>Sign out</button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .user-badge {
    position: relative;
  }

  .badge-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .badge-btn:hover { opacity: 0.8; }

  .avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    display: block;
  }

  .avatar-initials {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--accent, #89b4fa);
    color: #1e1e2e;
    font-size: 0.7rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
  }

  .badge-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    background: var(--surface, #2a2a3e);
    border: 1px solid var(--border, #3a3a5c);
    border-radius: 8px;
    padding: 0.5rem;
    min-width: 160px;
    z-index: 200;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  }

  .badge-name {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--fg, #cdd6f4);
    padding: 0.125rem 0.25rem;
  }

  .badge-username {
    font-size: 0.75rem;
    color: var(--fg-muted, #a6adc8);
    padding: 0 0.25rem;
  }

  .badge-sep {
    border: none;
    border-top: 1px solid var(--border, #3a3a5c);
    margin: 0.25rem 0;
  }

  .badge-signout {
    background: none;
    border: none;
    color: var(--fg-muted, #a6adc8);
    font-size: 0.8rem;
    text-align: left;
    padding: 0.25rem 0.25rem;
    cursor: pointer;
    border-radius: 4px;
    width: 100%;
  }

  .badge-signout:hover {
    background: var(--surface2, #313244);
    color: var(--fg, #cdd6f4);
  }
</style>
