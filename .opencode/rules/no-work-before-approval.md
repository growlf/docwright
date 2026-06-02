# Rule: No Active Work Before Plan Approval

Active implementation work MUST NOT begin on any proposal or plan until
the plan has `status: approved` (plans/) or `status: in-progress`.

## Permitted before approval

- Gathering data to understand a problem or evaluate feasibility
- Reading existing code or docs to inform a proposal
- Discussing hypothetical approaches, architectures, or trade-offs
- Drafting the proposal or plan document itself
- Asking clarifying questions of the human

## Forbidden before approval

- Writing implementation code (source files, configs, tests)
- Creating or modifying infrastructure
- Making git commits with implementation work
- Any action that changes the state of a system under governance

## Enforcement

This rule is checked at the pre-commit hook and during plan activation.
Any implementation commit not linked to an approved plan should be rejected.
