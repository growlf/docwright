# docwright Example Vault

This is the generic starter vault for the `org-operations` profile.
It shows the structure and document formats for a new docwright deployment.

## How to start

1. Copy this folder into your own repository
2. Write your organization's mission in `policies/core/mission.md` — that's the root node everything else traces back to
3. Add program-area policies under `policies/program-areas/` — one per major activity domain
4. Submit your first real inbox item via the web form or `docwright capture "your idea"`

## What to write first

`policies/core/mission.md` — one or two sentences of purpose.
Everything in docwright traces back to this document.
Without it, the AI triage layer has no foundation to work from.

## Questions?

See `PROPOSAL.md` in the repo root for the full architecture specification,
or join the discussion at https://github.com/growlf/docwright

## Reference implementation

Cascade STEAM's deployment of docwright is the reference implementation.
See `cascade-steam-vault-seed.md` in the repo root for a real-world example
of all document types fully populated.
