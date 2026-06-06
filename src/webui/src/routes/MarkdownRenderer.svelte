<script lang="ts">
  import { goto } from '$app/navigation';
  import markdownit from 'markdown-it';
  import anchor from 'markdown-it-anchor';
  import taskLists from 'markdown-it-task-lists';

  let { content, docPath = '' }: { content: string; docPath?: string } = $props();

  let html = $state('');

  // Resolve a relative image src against the document's location in the vault,
  // then rewrite to /api/asset?path=... so the server can serve vault files.
  function resolveImageSrc(src: string): string {
    if (!src || src.startsWith('http') || src.startsWith('/') || src.startsWith('data:')) return src;
    const dir = docPath ? docPath.split('/').slice(0, -1).join('/') : '';
    const parts = (dir ? dir + '/' + src : src).split('/');
    const out: string[] = [];
    for (const p of parts) {
      if (p === '..') out.pop();
      else if (p && p !== '.') out.push(p);
    }
    return `/api/asset?path=${encodeURIComponent(out.join('/'))}`;
  }

  const md = markdownit({ html: true })
    .use(anchor, {
      permalink: false,
      slugify: (s: string) =>
        s.trim().toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, ''),
    })
    .use(taskLists, { enabled: true });

  // Rewrite relative image sources through the asset API
  const defaultImageRender = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const srcIdx = token.attrIndex('src');
    if (srcIdx >= 0 && token.attrs) {
      token.attrs[srcIdx][1] = resolveImageSrc(token.attrs[srcIdx][1]);
    }
    return defaultImageRender
      ? defaultImageRender(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
  };

  function handleClick(e: MouseEvent) {
    const el = (e.target as HTMLElement).closest('a');
    if (!el) return;
    const href = el.getAttribute('href') || '';

    if (href.startsWith('#')) {
      e.preventDefault();
      const id = href.slice(1);
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
        history.replaceState(null, '', href);
      }
    } else if (href.startsWith('http://') || href.startsWith('https://')) {
      e.preventDefault();
      window.open(href, '_blank', 'noopener,noreferrer');
    } else if (href.replace(/#.*$/, '').endsWith('.md')) {
      e.preventDefault();
      const path = href.replace(/^\.\//, '');
      const url = '/' + path.replace(/\.md(#.*)?$/, '$1');
      goto(url);
    }
  }

  function convertWikilinks(src: string): string {
    return src.replace(/\[\[([^\]]+)\]\]/g, (_, raw: string) => {
      const pipe = raw.indexOf('|');
      const targetPart = pipe >= 0 ? raw.slice(0, pipe) : raw;
      const hashAt = targetPart.indexOf('#');
      const target = hashAt >= 0 ? targetPart.slice(0, hashAt) : targetPart;
      const anchor = hashAt >= 0 ? targetPart.slice(hashAt) : '';
      const href = (target.endsWith('.md') ? target : target + '.md') + anchor;
      const label = pipe >= 0 ? raw.slice(pipe + 1) : (target.replace(/\.md$/, '').split('/').pop() || target);
      return `[${label}](${href})`;
    });
  }

  $effect(() => {
    html = md.render(convertWikilinks(content));
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="markdown" onclick={handleClick} onkeydown={handleClick}>{@html html}</div>

<style lang="scss">
  @use '../lib/tokens' as *;

  .markdown {
    color: $fg;
    font-size: 15px;

    :global(h1) { font-size: 22px; color: $fg;    margin: 0 0 16px; }
    :global(h2) { font-size: 18px; color: $fg;    margin: 24px 0 12px; }
    :global(h3) { font-size: 16px; color: $fg-dim; margin: 20px 0 8px; }
    :global(p)  { margin: 0 0 12px; }
    :global(a)  { color: $blue; }

    :global(code) {
      background: $bg-3;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 13px;
    }
    :global(pre) {
      background: $bg;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      :global(code) { background: none; padding: 0; }
    }

    :global(ul), :global(ol) { padding-left: 24px; margin: 0 0 12px; }
    :global(li) { margin: 4px 0; }

    :global(blockquote) {
      border-left: 3px solid $border;
      padding-left: 16px;
      color: $muted;
      margin: 0 0 12px;
    }

    :global(table) { border-collapse: collapse; margin: 0 0 12px; width: 100%; }
    :global(th), :global(td) { border: 1px solid $border; padding: 8px 12px; text-align: left; }
    :global(th) { background: $bg-3; color: $fg; }

    :global(hr) { border: none; border-top: 1px solid $border; margin: 24px 0; }
  }
</style>
