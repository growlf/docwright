<script lang="ts">
  import { goto } from '$app/navigation';
  import markdownit from 'markdown-it';
  import anchor from 'markdown-it-anchor';
  import taskLists from 'markdown-it-task-lists';

  let { content }: { content: string } = $props();

  let html = $state('');

  const md = markdownit({ html: true })
    .use(anchor, {
      permalink: false,
      slugify: (s: string) =>
        s.trim().toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, ''),
    })
    .use(taskLists, { enabled: true });

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
