/**
 * currentDoc — store for the active document's properties.
 * Set by +page.svelte whenever a document loads.
 * Read by +layout.svelte to populate the right sidebar.
 */
import { writable } from 'svelte/store';

export interface DocContext {
  frontmatter: Record<string, any> | null;
  docType: string;
  mode: 'read' | 'edit' | 'source';
  filePath: string;
  onSave?: () => void;
  onApprove?: () => void;
  onFindRelated?: () => void;
  onInsert?: (slug: string, heading: string, content: string) => void;
  onSubsume?: (path: string) => void;
}

export const currentDoc = writable<DocContext>({
  frontmatter: null,
  docType: 'page',
  mode: 'read',
  filePath: '',
});
