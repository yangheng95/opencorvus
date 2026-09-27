# Data Analysis & Business Insights

Turns bounded operating data into reproducible performance and segment analysis, audited business insights, and an actionable operating report.

## Binding workflow

`operating-insight-report` is the sole workflow. Each node starts once after all declared predecessors reach terminal success; feedback continues existing nodes for further Turns. The two independent analysis branches are dispatched together and may run in parallel; the join waits for both terminal results.

The stage `data-analysis/audit` covers its exact insight brief. Review of a later report uses the existing fact-checker's target-bound Core FactCheckReview, with a complete updated dispatch input identifying the current writer Message. Material findings return to the existing report writer, and the changed result is checked again. Correct prior work and immutable historical evidence remain intact. Each delivery Turn follows write, verify, commit/merge and exact-commit publication; the no-write-after-merge rule applies within that Turn. Publication and an earlier clean audit do not themselves establish final business acceptance.

## Artifact contract

- `data-analysis/analysis-charter`
- `data-analysis/data-dossier`
- `data-analysis/performance-analysis`
- `data-analysis/segment-analysis`
- `data-analysis/insight-brief`
- `data-analysis/audit`
- `data-analysis/report`

Every consumed stage uses the package-owned codec and `data-analysis/shared/publish-data-analysis-artifact` publisher. Only the final Build-owned role writes and rereads `artifacts/data-analysis/report.md`, verifies, commits, and merges it when working in a managed worktree, reads and snapshots the exact immutable returned `primary_head`, publishes the terminal Artifact, and publishes an identical `document@1` view.

The publisher takes one `artifact` object containing `artifact_type`, the type-specific `payload`, `resource_set` (null for intermediate stages), and `source_artifact_locators`. The final report supplies its immutable resource set and all six exact predecessor locators in that same object. This input contract belongs to package version `2026.09.27.4`; previously installed Task bindings retain their own immutable package version.

## Boundary

Treat correlation as observation, not causation. Never invent missing values, silently change metric definitions, or present an estimate as a source fact.
