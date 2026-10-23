# Sales Strategy & Customer Research

Builds an attributable customer dossier, parallel opportunity and positioning analyses, an audited sales strategy, and a practical sales playbook.

## Optional collaboration guidance

`sales-strategy-playbook` is optional collaboration guidance. Each dispatch has its own execution identity; schedule actual input dependencies and independent work from evidence. The two independent analysis branches are dispatched together and may run in parallel; the join waits for both terminal results.

## Artifact contract

- `sales-strategy/research-charter`
- `sales-strategy/customer-dossier`
- `sales-strategy/opportunity-analysis`
- `sales-strategy/positioning-analysis`
- `sales-strategy/strategy-brief`
- `sales-strategy/audit`
- `sales-strategy/playbook`

Every consumed stage uses the package-owned codec and `sales-strategy/shared/publish-sales-strategy-artifact` publisher. Only the final Build-owned role writes and rereads one canonical file at the user's explicit delivery path (default: `artifacts/sales-strategy/playbook.md`), verifies, commits, and merges it when working in a managed worktree, reads and snapshots the exact immutable returned `primary_head`, publishes the terminal Artifact, and publishes an identical `document@1` view.

## Boundary

Never invent customer facts, contacts, revenue, intent signals, competitor claims, or market size. Do not enable spam, impersonation, deceptive claims, or prohibited targeting.

## Publisher dependency contract — 2026.10.24.1

`predecessor_artifact_locators` contains only the exact typed Engine Artifact predecessors required by the selected stage; root stages pass `[]`. Completely read and select other semantic evidence, including original file resources, through the normal Artifact transport. The Host retains that evidence in the output envelope’s `source_artifact_locators` together with the selected typed predecessors. This package input and complete output provenance have different purposes. Existing Tasks keep their frozen package revision; new installations use the current input contract.
