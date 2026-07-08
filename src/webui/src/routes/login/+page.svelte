<script lang="ts">
  import type { PageData, ActionData } from './$types.js';

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
  <title>Sign in — DocWright</title>
</svelte:head>

<div class="login-shell">
  <div class="login-card">
    <div class="login-logo">
      <span class="logo-mark">⚖</span>
      <span class="logo-name">DocWright</span>
    </div>

    <h1>Sign in</h1>

    {#if form?.error}
      <p class="error">{form.error}</p>
    {/if}

    {#if data.authMode === 'forgejo' || data.authMode === 'none'}
      <form method="POST" action="?/forgejo" use:enhance>
        <button type="submit" class="btn-forgejo">
          Sign in with Forgejo
          {#if data.forgejoUrl}
            <span class="host">({new URL(data.forgejoUrl).hostname})</span>
          {/if}
        </button>
      </form>
    {/if}

    {#if data.authMode === 'local'}
      <form method="POST" action="/api/auth/login" class="local-form">
        <label>
          Username
          <input name="username" type="text" autocomplete="username" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autocomplete="current-password" required />
        </label>
        <button type="submit" class="btn-local">Sign in</button>
      </form>
    {/if}

    {#if data.authMode === 'none'}
      <p class="none-notice">
        <strong>AUTH_MODE=none</strong> — authentication is disabled.
        This instance accepts all connections without credentials.
      </p>
    {/if}
  </div>
</div>

<style>
  .login-shell {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: var(--bg, #1e1e2e);
  }

  .login-card {
    background: var(--surface, #2a2a3e);
    border: 1px solid var(--border, #3a3a5c);
    border-radius: 12px;
    padding: 2.5rem 2rem;
    width: 100%;
    max-width: 380px;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .login-logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .logo-mark { font-size: 1.5rem; }

  h1 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
    color: var(--fg, #cdd6f4);
  }

  .error {
    background: #3b1a1a;
    border: 1px solid #7f1d1d;
    color: #fca5a5;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    margin: 0;
  }

  .btn-forgejo {
    width: 100%;
    padding: 0.625rem 1rem;
    background: var(--accent, #89b4fa);
    color: #1e1e2e;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .btn-forgejo:hover { filter: brightness(1.1); }

  .host { font-weight: 400; opacity: 0.7; font-size: 0.8rem; }

  .local-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.85rem;
    color: var(--fg-muted, #a6adc8);
  }

  input {
    background: var(--input-bg, #181825);
    border: 1px solid var(--border, #3a3a5c);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    color: var(--fg, #cdd6f4);
    font-size: 0.9rem;
    width: 100%;
    box-sizing: border-box;
  }

  input:focus { outline: 2px solid var(--accent, #89b4fa); border-color: transparent; }

  .btn-local {
    width: 100%;
    padding: 0.625rem 1rem;
    background: var(--surface2, #313244);
    color: var(--fg, #cdd6f4);
    border: 1px solid var(--border, #3a3a5c);
    border-radius: 6px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
  }

  .btn-local:hover { background: var(--surface3, #45475a); }

  .none-notice {
    font-size: 0.8rem;
    color: var(--fg-muted, #a6adc8);
    border: 1px dashed var(--border, #3a3a5c);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    margin: 0;
  }
</style>
