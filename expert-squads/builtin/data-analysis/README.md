# Data Analysis & Business Insights

Turns bounded operating data into reproducible performance and segment analysis, audited business insights, and an actionable operating report.

## Optional collaboration guidance

`operating-insight-report` is optional collaboration guidance. Each node starts once after all declared predecessors reach terminal success; feedback continues existing nodes for further Turns. The two independent analysis branches are dispatched together and may run in parallel; the join waits for both terminal results.

The stage `data-analysis/audit` covers its exact insight brief. Review of a later report uses the existing fact-checker's target-bound Core FactCheckReview, with a complete updated dispatch input identifying the current writer Message. Material findings return to the existing report writer, and the changed result is checked again. Correct prior work and immutable historical evidence remain intact. Each delivery Turn follows write, verify, commit/merge and exact-commit publication; the no-write-after-merge rule applies within that Turn. Publication and an earlier clean audit do not themselves establish final business acceptance.

## Artifact contract

- `data-analysis/analysis-charter`
- `data-analysis/data-dossier`
- `data-analysis/performance-analysis`
- `data-analysis/segment-analysis`
- `data-analysis/insight-brief`
- `data-analysis/audit`
- `data-analysis/report`

Every consumed stage uses the package-owned codec and `data-analysis/shared/publish-data-analysis-artifact` publisher. Only the final Build-owned role writes and rereads one canonical file at the user's explicit delivery path (default: `artifacts/data-analysis/report.md`), verifies, commits, and merges it when working in a managed worktree, reads and snapshots the exact immutable returned `primary_head`, publishes the terminal Artifact, and publishes an identical `document@1` view.

The publisher takes one `artifact` object containing `artifact_type`, the type-specific `payload`, `resource_set` (null for intermediate stages), and `predecessor_artifact_locators`. The final report supplies its immutable resource set and all six exact predecessor locators in that same object. The current input contract belongs to the revision declared in `expert-squad.jsonc`; previously installed Task bindings retain their own immutable package version.

## Boundary

Treat correlation as observation, not causation. Never invent missing values, silently change metric definitions, or present an estimate as a source fact.

## Publisher dependency contract — 2026.10.24.1

`predecessor_artifact_locators` contains only the exact typed Engine Artifact predecessors required by the selected stage; root stages pass `[]`. Completely read and select other semantic evidence, including original file resources, through the normal Artifact transport. The Host retains that evidence in the output envelope’s `source_artifact_locators` together with the selected typed predecessors. This package input and complete output provenance have different purposes. Existing Tasks keep their frozen package revision; new installations use the current input contract.
