# lifecycle-gate

## Rule

Certain lifecycle transitions require structural field completeness and/or human authorization:

| Transition | Required | Human-only? |
|-----------|---------|------------|
| `status: completed` | `completed_date` must be set and non-empty | No — AI may complete |
| `status: canceled` | `canceled_date` AND `cancellation_reason` must be set | No — AI may cancel (with human confirmation) |
| `gate_status: approved` or `gate_status: waived` | — | **Yes — never set by AI** |
| `approved: true` on proposal | — | **Yes — never set by AI** |

## Rationale

Missing `completed_date` leaves the plan in an ambiguous completed state — future queries about completion timing will have no data. Missing `cancellation_reason` makes canceled plans unauditable. Gate status and proposal approval are human governance decisions that the MCP server hard-blocks.

## Examples

Passing (completed with date):
```yaml
status: completed
completed_date: 2026-06-17
```

Failing (completed without date):
```yaml
status: completed
completed_date: ""
```

Failing (canceled without reason):
```yaml
status: canceled
canceled_date: 2026-06-17
cancellation_reason: ""
```

## Scope

Applies when a plan is being completed (`plan.completing`) or approved (`plan.approved`), and when a proposal is being approved (`proposal.approving`).
