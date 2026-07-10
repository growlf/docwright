<script lang="ts">
  import { showToast } from './toast';

  let {
    frontmatter = null as Record<string, any> | null,
    path = '' as string,
    onProposalCreated,
  }: {
    frontmatter?: Record<string, any> | null;
    path?: string;
    onProposalCreated?: (proposalPath: string) => void;
  } = $props();

  // Modal state
  let showCreateModal = $state(false);
  let showLinkModal = $state(false);
  let proposalTitle = $state('');
  let proposalDescription = $state('');
  let selectedProposal = $state('');
  let proposals = $state<Array<{ path: string; title: string }>>([]);
  let loadingProposals = $state(false);
  let isCreating = $state(false);
  let isLinking = $state(false);

  // Check if this is an issue and can be processed. Issue documents are identified by
  // their location under issues/ (the schema doesn't require a `type: issue` field —
  // most issue files never set one), with the frontmatter field kept as a fallback
  // for any document that does set it explicitly.
  const isIssue = $derived(path?.startsWith('issues/') || frontmatter?.type === 'issue');
  const canForwardPath = $derived(
    isIssue &&
    ['triaged', 'scope-checked', 'awaiting-proposal'].includes(frontmatter?.status)
  );
  const isAlreadyConsumed = $derived(frontmatter?.['proposal-linked'] || frontmatter?.consumed_by);

  // Load available proposals for linking
  async function loadProposals() {
    if (loadingProposals) return;
    loadingProposals = true;
    try {
      const res = await fetch('/api/documents?type=proposal&status=proposed,awaiting-approval');
      if (res.ok) {
        const data = await res.json();
        proposals = data.proposals || [];
      }
    } catch (e) {
      showToast(`Error loading proposals: ${e}`, 5000);
    } finally {
      loadingProposals = false;
    }
  }

  async function createProposal() {
    if (!proposalTitle.trim()) {
      showToast('Proposal title is required', 3000);
      return;
    }

    isCreating = true;
    try {
      // Construct proposal content
      const proposalContent = `---
title: "${proposalTitle.replace(/"/g, '\\"')}"
author: ${frontmatter?.author || 'Unknown'}
created: ${new Date().toISOString().split('T')[0]}
tags: ${JSON.stringify(frontmatter?.tags || [])}
approved: false
sources:
  - ${frontmatter?.['created_by'] ? 'issues/' + frontmatter.title?.toLowerCase().replace(/\\s+/g, '-') + '.md' : 'issue'}
---

# ${proposalTitle}

## Problem

${proposalDescription || frontmatter?.description || 'Based on issue: ' + frontmatter?.title}

## Proposed Solution

[Add solution details]

## Implementation Notes

[Add implementation notes]

## Testing

- [ ] Test 1
- [ ] Test 2

## Success Criteria

- [ ] Criterion 1
- [ ] Criterion 2
`;

      const proposalPath = 'proposals/' + proposalTitle.toLowerCase().replace(/\\s+/g, '-').replace(/[^\\w-]/g, '') + '.md';

      const res = await fetch('/api/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: proposalPath, content: proposalContent }),
      });

      if (res.ok) {
        // Mark the issue as proposal-linked
        const updateRes = await fetch('/api/set-field', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: frontmatter?.['_path'] || '',
            field: 'status',
            value: 'proposal-linked',
          }),
        });

        if (updateRes.ok) {
          showToast(`✓ Proposal created and issue linked`, 3000);
          showCreateModal = false;
          onProposalCreated?.(proposalPath);
          proposalTitle = '';
          proposalDescription = '';
        }
      } else {
        showToast(`Error creating proposal: ${res.statusText}`, 5000);
      }
    } catch (e) {
      showToast(`Error: ${e}`, 5000);
    } finally {
      isCreating = false;
    }
  }

  async function linkProposal() {
    if (!selectedProposal) {
      showToast('Please select a proposal', 3000);
      return;
    }

    isLinking = true;
    try {
      const res = await fetch('/api/set-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: frontmatter?.['_path'] || '',
          field: 'status',
          value: 'proposal-linked',
        }),
      });

      if (res.ok) {
        // Also set consumed_by field
        await fetch('/api/set-field', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: frontmatter?.['_path'] || '',
            field: 'consumed_by',
            value: selectedProposal,
          }),
        });

        showToast(`✓ Issue linked to proposal`, 3000);
        showLinkModal = false;
        selectedProposal = '';
      } else {
        showToast(`Error linking issue: ${res.statusText}`, 5000);
      }
    } catch (e) {
      showToast(`Error: ${e}`, 5000);
    } finally {
      isLinking = false;
    }
  }
</script>

{#if canForwardPath && !isAlreadyConsumed}
  <div class="forward-path-actions">
    <button
      class="action-btn create"
      onclick={() => { showCreateModal = true; }}
      title="Create a new proposal from this issue"
    >
      ✨ Create Proposal
    </button>
    <button
      class="action-btn link"
      onclick={() => { loadProposals(); showLinkModal = true; }}
      title="Link this issue to an existing proposal"
    >
      🔗 Link Proposal
    </button>
  </div>
{/if}

<!-- Create Proposal Modal -->
{#if showCreateModal}
  <div class="modal-overlay" onclick={() => { if (!isCreating) showCreateModal = false; }}>
    <div class="modal-dialog" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>Create Proposal from Issue</h2>
        <button class="close-btn" onclick={() => { if (!isCreating) showCreateModal = false; }} disabled={isCreating}>✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="proposal-title">Proposal Title</label>
          <input
            id="proposal-title"
            type="text"
            bind:value={proposalTitle}
            placeholder="e.g., Implement feature X"
            disabled={isCreating}
          />
        </div>
        <div class="form-group">
          <label for="proposal-desc">Description (optional)</label>
          <textarea
            id="proposal-desc"
            bind:value={proposalDescription}
            placeholder="Additional context or description..."
            rows={4}
            disabled={isCreating}
          ></textarea>
        </div>
        <div class="form-note">
          This issue will be marked as <code>proposal-linked</code> and consumed by the new proposal.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" onclick={() => { showCreateModal = false; }} disabled={isCreating}>Cancel</button>
        <button class="btn-primary" onclick={createProposal} disabled={isCreating || !proposalTitle.trim()}>
          {isCreating ? '⏳ Creating...' : '✓ Create Proposal'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Link Proposal Modal -->
{#if showLinkModal}
  <div class="modal-overlay" onclick={() => { if (!isLinking && !loadingProposals) showLinkModal = false; }}>
    <div class="modal-dialog" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>Link to Proposal</h2>
        <button class="close-btn" onclick={() => { if (!isLinking) showLinkModal = false; }} disabled={isLinking}>✕</button>
      </div>
      <div class="modal-body">
        {#if loadingProposals}
          <div class="loading">Loading proposals...</div>
        {:else if proposals.length === 0}
          <div class="empty">No proposals available</div>
        {:else}
          <div class="form-group">
            <label for="proposal-select">Select Proposal</label>
            <select id="proposal-select" bind:value={selectedProposal} disabled={isLinking}>
              <option value="">-- Choose a proposal --</option>
              {#each proposals as prop}
                <option value={prop.path}>{prop.title}</option>
              {/each}
            </select>
          </div>
          <div class="form-note">
            This issue will be marked as <code>proposal-linked</code> and linked to the selected proposal.
          </div>
        {/if}
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" onclick={() => { showLinkModal = false; }} disabled={isLinking || loadingProposals}>Cancel</button>
        <button class="btn-primary" onclick={linkProposal} disabled={isLinking || !selectedProposal || loadingProposals}>
          {isLinking ? '⏳ Linking...' : '✓ Link Issue'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  .forward-path-actions {
    display: flex;
    gap: 8px;
    margin-right: 12px;
  }

  .action-btn {
    padding: 6px 12px;
    border-radius: 4px;
    border: 1px solid #ccc;
    background: #f5f5f5;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;

    &:hover:not(:disabled) {
      background: #e8e8e8;
      border-color: #999;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &.create {
      color: #2563eb;
      border-color: #bfdbfe;
      background: #eff6ff;

      &:hover:not(:disabled) {
        background: #dbeafe;
      }
    }

    &.link {
      color: #7c3aed;
      border-color: #ddd6fe;
      background: #f5f3ff;

      &:hover:not(:disabled) {
        background: #ede9fe;
      }
    }
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-dialog {
    background: white;
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    padding: 20px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;

    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    color: #999;

    &:hover:not(:disabled) {
      color: #333;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .modal-body {
    padding: 20px;
    flex: 1;
    overflow-y: auto;
  }

  .form-group {
    margin-bottom: 16px;

    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
      color: #333;
    }

    input, select, textarea {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 13px;
      font-family: inherit;

      &:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
      }

      &:disabled {
        background: #f3f4f6;
        cursor: not-allowed;
        opacity: 0.6;
      }
    }

    textarea {
      resize: vertical;
      font-family: monospace;
      font-size: 12px;
    }
  }

  .form-note {
    font-size: 12px;
    color: #666;
    background: #f9fafb;
    padding: 10px 12px;
    border-radius: 4px;
    border-left: 3px solid #3b82f6;

    code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 11px;
    }
  }

  .loading, .empty {
    text-align: center;
    padding: 20px;
    color: #999;
    font-size: 13px;
  }

  .modal-footer {
    padding: 16px 20px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    flex-shrink: 0;
  }

  .btn-cancel, .btn-primary {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid #d1d5db;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .btn-cancel {
    background: white;
    color: #333;

    &:hover:not(:disabled) {
      background: #f3f4f6;
    }
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;

    &:hover:not(:disabled) {
      background: #2563eb;
      border-color: #2563eb;
    }
  }
</style>
