/**
 * Core View Container registrations.
 *
 * Imported by +layout.svelte and called in onMount after the bridge is set up.
 * Keeping registrations here means +layout.svelte has zero view-specific imports.
 */

import { mount as svelteMount, unmount as svelteUnmount } from 'svelte';
import type { Writable } from 'svelte/store';
import { goto } from '$app/navigation';

import GovernancePanel from '$lib/GovernancePanel.svelte';
import FileTree        from '../routes/FileTree.svelte';
import GitPanel        from '$lib/GitPanel.svelte';
import SearchPanel     from '$lib/SearchPanel.svelte';

export interface CoreVCOptions {
  onNewMenu:        () => void;
  filesSearchQuery: Writable<string>;
  govSearchQuery:   Writable<string>;
}

export function setupCoreVCs(opts: CoreVCOptions): void {
  const dw = (window as any).__docwright;

  // ── Governance Engine (order: 10, primary) ────────────────────────────
  let govApp: any = null;
  dw.registerView('governance', {
    mount(el: HTMLElement) { govApp = svelteMount(GovernancePanel, { target: el }); },
    unmount()              { if (govApp) { svelteUnmount(govApp); govApp = null; } },
    onSearch(q: string)    { opts.govSearchQuery.set(q); },
    onActivate()           { if (window.location.pathname !== '/status' && window.location.pathname !== '/status/') goto('/status'); },
    onDeactivate()         { opts.govSearchQuery.set(''); },
  });

  // ── Search (order: 25) ────────────────────────────────────────────────
  let searchApp: any = null;
  dw.registerView('search', {
    mount(el: HTMLElement) { searchApp = svelteMount(SearchPanel, { target: el }); },
    unmount()              { if (searchApp) { svelteUnmount(searchApp); searchApp = null; } },
    onActivate()           { if (window.location.pathname !== '/search' && window.location.pathname !== '/search/') goto('/search'); },
  });



  // ── Git (order: 40) ───────────────────────────────────────────────────
  // APIs: GET /api/git/status, POST /api/git/stage|commit|push|tag (writes need auth)
  let gitApp: any = null;
  dw.registerView('git', {
    mount(el: HTMLElement) { gitApp = svelteMount(GitPanel, { target: el }); },
    unmount()              { if (gitApp) { svelteUnmount(gitApp); gitApp = null; } },
  });

  // ── Files (order: 20, searchable) ────────────────────────────────────
  // APIs: GET /api/list, /api/registry (reads — auth-ready)
  let filesApp: any = null;
  dw.registerView('files', {
    mount(el: HTMLElement) {
      filesApp = svelteMount(FileTree, {
        target: el,
        props: { onNewMenu: opts.onNewMenu },
      });
    },
    unmount()           { if (filesApp) { svelteUnmount(filesApp); filesApp = null; } },
    onSearch(q: string) { opts.filesSearchQuery.set(q); },
    onDeactivate()      { opts.filesSearchQuery.set(''); },
  });
}
