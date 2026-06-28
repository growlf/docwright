/**
 * DocWright Plugin API — ambient type declarations.
 *
 * Plugin developers: copy this file into your project for full type safety.
 * DocWright injects `window.__docwright` before any plugin bundle executes.
 *
 * Minimum viable plugin bundle:
 *
 *   window.__docwright.registerView('my-plugin', {
 *     mount(el) { el.innerHTML = '<p>Hello from my plugin</p>'; },
 *     unmount() {},
 *   });
 */

interface DWNotifyOpts {
  type: 'info' | 'warning' | 'error' | 'success' | 'drift';
  title: string;
  message: string;
  /** If true, the notification stays until manually dismissed. */
  persistent?: boolean;
}

/**
 * A View Container — the sidebar presence contract.
 * Implement this interface and pass it to `window.__docwright.registerView()`.
 */
interface DWViewContainer {
  /**
   * Called once when the user first activates this view (or on re-activation if
   * the bundle was unloaded). Render your sidebar UI into `el`. The element is
   * already in the DOM and sized — no RAF or polling needed.
   */
  mount(el: HTMLElement): void;

  /**
   * Called when this view is deactivated or the shell is destroyed.
   * Remove event listeners, cancel timers, destroy framework instances.
   */
  unmount(): void;

  /**
   * Called when the user types in the search input above the left panel.
   * Only invoked if `searchable: true` in your plugin.json.
   */
  onSearch?(query: string): void;

  /** Called each time the user switches to this view (after the first mount). */
  onActivate?(): void;

  /**
   * Called when the user switches away from this view.
   * If you claimed the right panel, release it here — the shell will also auto-release.
   */
  onDeactivate?(): void;
}

/**
 * The shell bridge — methods your plugin calls to interact with DocWright.
 * Available as `window.__docwright.bridge`.
 */
interface DWBridge {
  /** Show a transient toast at the bottom-right of the viewport. */
  toast(message: string, duration?: number): void;

  /** Add a notification banner to the notification area above the main content. */
  notify(opts: DWNotifyOpts): void;

  /**
   * Claim the right panel with arbitrary HTML.
   * The right panel will show your content instead of the standard
   * Properties/Related/Review tabs until you release it or are deactivated.
   */
  claimRightPanel(html: string, label?: string): void;

  /**
   * Release the right panel back to DocWright.
   * Properties/Related/Review tabs are restored for the open document.
   */
  releaseRightPanel(): void;

  /** Navigate the main content area (SvelteKit goto). */
  navigate(path: string): void;

  /**
   * Open a vault document in the main content area.
   * @param vaultPath — vault-relative path, e.g. "proposals/my-doc.md"
   */
  openDocument(vaultPath: string): void;

  /** Base URL for DocWright API calls — always '/api'. Use for fetch(). */
  readonly apiBase: string;

  /** Vault root path on the server filesystem. */
  readonly vaultRoot: string;

  /**
   * Bridge API version string — currently '1'.
   * Check this before using methods introduced after your target version.
   */
  readonly apiVersion: string;
}

/** The single entry point injected by DocWright at `window.__docwright`. */
interface DWDocwright {
  /** Shell bridge — populated before any plugin bundle executes. */
  readonly bridge: DWBridge;

  /**
   * Register a View Container for sidebar presence and activity bar icon.
   * Call this from your `client/bundle.js`.
   *
   * The `name` must match the `name` field in your `plugin.json`.
   * DocWright calls `vc.mount(el)` when the user activates your view,
   * and `vc.unmount()` when they switch away.
   */
  registerView(name: string, vc: DWViewContainer): void;
}

declare var __docwright: DWDocwright;
