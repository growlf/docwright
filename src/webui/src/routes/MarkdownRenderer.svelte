<script lang="ts">
  import markdownit from 'markdown-it';
  import anchor from 'markdown-it-anchor';

  let { content }: { content: string } = $props();

  let html = $state('');

  const md = markdownit({ html: true, linkify: true })
    .use(anchor, {
      permalink: false,
      slugify: (s: string) =>
        s.trim().toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, ''),
    });

  const defaultRender =
    md.renderer.rules.link_open ||
    function (tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };

  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    const token = tokens[idx];
    const href = token.attrGet('href') || '';

    if (href.startsWith('http://') || href.startsWith('https://')) {
      token.attrSet('target', '_blank');
      token.attrSet('rel', 'noopener noreferrer');
    }

    return defaultRender(tokens, idx, options, env, self);
  };

  function handleClick(e: MouseEvent) {
    const anchor = (e.target as HTMLElement).closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href') || '';
    if (!href.startsWith('#')) return;

    e.preventDefault();
    const id = href.slice(1);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      history.replaceState(null, '', href);
    }
  }

  $effect(() => {
    html = md.render(content);
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="markdown" onclick={handleClick} onkeydown={handleClick}>{@html html}</div>

<style>
  .markdown { color: #e0e0e0; font-size: 15px; }
  .markdown :global(h1) { font-size: 22px; color: #fff; margin: 0 0 16px; }
  .markdown :global(h2) { font-size: 18px; color: #fff; margin: 24px 0 12px; }
  .markdown :global(h3) { font-size: 16px; color: #ddd; margin: 20px 0 8px; }
  .markdown :global(p) { margin: 0 0 12px; }
  .markdown :global(a) { color: #58a6ff; }
  .markdown :global(code) { background: #2a2a2a; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
  .markdown :global(pre) { background: #111; padding: 16px; border-radius: 6px; overflow-x: auto; }
  .markdown :global(pre code) { background: none; padding: 0; }
  .markdown :global(ul), .markdown :global(ol) { padding-left: 24px; margin: 0 0 12px; }
  .markdown :global(li) { margin: 4px 0; }
  .markdown :global(blockquote) { border-left: 3px solid #444; padding-left: 16px; color: #999; margin: 0 0 12px; }
  .markdown :global(table) { border-collapse: collapse; margin: 0 0 12px; width: 100%; }
  .markdown :global(th), .markdown :global(td) { border: 1px solid #333; padding: 8px 12px; text-align: left; }
  .markdown :global(th) { background: #222; color: #fff; }
  .markdown :global(hr) { border: none; border-top: 1px solid #333; margin: 24px 0; }
</style>
