# Data Analysis & Business Insights

Turns bounded operating data into reproducible performance and segment analysis, audited business insights, and an actionable operating report.

## Binding workflow

`operating-insight-report` is the sole workflow. Every node runs exactly once after all declared predecessors reach terminal success. The two independent analysis branches are dispatched together and may run in parallel; the join waits for both terminal results.

## Artifact contract

- `data-analysis/analysis-charter`
- `data-analysis/data-dossier`
- `data-analysis/performance-analysis`
- `data-analysis/segment-analysis`
- `data-analysis/insight-brief`
- `data-analysis/audit`
- `data-analysis/report`

Every consumed stage uses the package-owned codec and `data-analysis/shared/publish-data-analysis-artifact` publisher. Only the final Build-owned role writes and rereads `artifacts/data-analysis/report.md`, verifies, commits, and merges it when working in a managed worktree, reads and snapshots the exact immutable returned `primary_head`, publishes the terminal Artifact, and publishes an identical `document@1` view.

## Boundary

Treat correlation as observation, not causation. Never invent missing values, silently change metric definitions, or present an estimate as a source fact.
