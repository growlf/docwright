/**
 * currentDoc — store for the active document's properties.
 * Set by +page.svelte whenever a document loads.
 * Read by +layout.svelte to populate the right sidebar.
 */
import { writable } from 'svelte/store';

export interface DocContext {
  frontmatter: Record<string, any> | null;
  body: string;
  docType: string;
  mode: 'read' | 'edit' | 'source';
  filePath: string;
  onSave?: (fm: Record<string, any>) => void;
  onApprove?: (fm: Record<string, any>) => void;
  onFindRelated?: () => void;
  onPlan?: () => void;
  onAddRelated?: (path: string) => void;
  onAddDepends?: (path: string) => void;
  onAddBlocks?: (path: string) => void;
  onSubsume?: (path: string) => void;
}

export const currentDoc = writable<DocContext>({
  frontmatter: null,
  body: '',
  docType: 'page',
  mode: 'read',
  filePath: '',
});
