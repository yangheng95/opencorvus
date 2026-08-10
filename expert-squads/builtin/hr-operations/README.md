# Human Resources & Organization Operations

Turns aggregate workforce and people-process evidence into parallel workforce and process analyses, an independently audited operating plan, and a canonical Human Resources delivery.

## Binding workflow

`people-operations-plan` is the sole workflow. Every node runs exactly once after all declared predecessors reach terminal success. The two independent analysis branches are dispatched together and may run in parallel; the join waits for both terminal results.

## Artifact contract

- `hr-operations/operating-charter`
- `hr-operations/evidence-dossier`
- `hr-operations/workforce-analysis`
- `hr-operations/process-analysis`
- `hr-operations/operating-plan-draft`
- `hr-operations/audit`
- `hr-operations/operating-plan`

Every consumed stage uses the package-owned codec and `hr-operations/shared/publish-hr-operations-artifact` publisher. Only the final Build-owned role writes and rereads `artifacts/hr-operations/operating-plan.md`, verifies, commits, and merges it when working in a managed worktree, reads and snapshots the exact immutable returned `primary_head`, publishes the terminal Artifact, and publishes an identical `document@1` view.

## Boundary

Use aggregate evidence only. Never infer protected traits, rank individuals, make automated employment decisions, or present operational guidance as legal advice. Jurisdiction-specific legal conclusions require qualified professional review.
