# Sales Strategy & Customer Research

Builds an attributable customer dossier, parallel opportunity and positioning analyses, an audited sales strategy, and a practical sales playbook.

## Binding workflow

`sales-strategy-playbook` is the sole workflow. Every node runs exactly once after all declared predecessors reach terminal success. The two independent analysis branches are dispatched together and may run in parallel; the join waits for both terminal results.

## Artifact contract

- `sales-strategy/research-charter`
- `sales-strategy/customer-dossier`
- `sales-strategy/opportunity-analysis`
- `sales-strategy/positioning-analysis`
- `sales-strategy/strategy-brief`
- `sales-strategy/audit`
- `sales-strategy/playbook`

Every consumed stage uses the package-owned codec and `sales-strategy/shared/publish-sales-strategy-artifact` publisher. Only the final Build-owned role writes and rereads `artifacts/sales-strategy/playbook.md`, verifies, commits, and merges it when working in a managed worktree, reads and snapshots the exact immutable returned `primary_head`, publishes the terminal Artifact, and publishes an identical `document@1` view.

## Boundary

Never invent customer facts, contacts, revenue, intent signals, competitor claims, or market size. Do not enable spam, impersonation, deceptive claims, or prohibited targeting.
