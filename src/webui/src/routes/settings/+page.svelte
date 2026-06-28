<script lang="ts">
  // Settings page — accessible from footer ⚙ Settings link.
  // Simple linkable route; no modal needed.
</script>

<div class="settings-page">
  <h1 class="settings-title">Settings</h1>

  <section class="settings-section">
    <h2 class="settings-section-title">AI Instructions</h2>
    <a class="settings-file" href="/CLAUDE">CLAUDE.md</a>
    <a class="settings-file" href="/AGENTS">AGENTS.md</a>
  </section>

  <section class="settings-section">
    <h2 class="settings-section-title">Templates</h2>
    <a class="settings-file" href="/templates/proposal-template">proposal-template.md</a>
    <a class="settings-file" href="/templates/plan-template">plan-template.md</a>
    <a class="settings-file" href="/templates/research-template">research-template.md</a>
  </section>

  <section class="settings-section">
    <h2 class="settings-section-title">Project</h2>
    <a class="settings-file" href="/CONTRIBUTING">CONTRIBUTING.md</a>
    <a class="settings-file" href="/SECURITY">SECURITY.md</a>
    <a class="settings-file" href="/CHANGELOG">CHANGELOG.md</a>
    <a class="settings-file" href="/NOTICE">NOTICE.md</a>
  </section>

  <section class="settings-section">
    <h2 class="settings-section-title">Brand</h2>
    <a class="settings-file" href="/brand.json">brand.json</a>
    <a class="settings-file" href="/brand/theme.css">brand/theme.css</a>
  </section>

  <p class="settings-hint">
    Edit these files to customise DocWright.
    See <a href="/docs/customization">docs/customization.md</a> for details.
  </p>
</div>

<style lang="scss">
  @use '../../lib/tokens' as *;

  .settings-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 32px 24px;
  }
  .settings-title {
    font-size: 20px;
    font-weight: 700;
    color: $fg;
    margin: 0 0 24px;
  }
  .settings-section {
    margin-bottom: 24px;
  }
  .settings-section-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: $muted;
    margin: 0 0 8px;
  }
  .settings-file {
    display: block;
    padding: 6px 10px;
    font-size: 13px;
    color: $fg-dim;
    text-decoration: none;
    border-radius: 4px;
    &:hover { background: $bg-hover; color: $accent; }
  }
  .settings-hint {
    font-size: 12px;
    color: $muted;
    margin-top: 8px;
    a { color: $accent; }
  }
</style>
