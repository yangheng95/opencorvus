# Human Resources & Organization Operations

Turns aggregate workforce and people-process evidence into parallel workforce and process analyses, an independently audited operating plan, and a canonical Human Resources delivery.

## Optional collaboration guidance

`people-operations-plan` is optional collaboration guidance. Each dispatch has its own execution identity; schedule actual input dependencies and independent work from evidence. The two independent analysis branches are dispatched together and may run in parallel; the join waits for both terminal results.

## Artifact contract

- `hr-operations/operating-charter`
- `hr-operations/evidence-dossier`
- `hr-operations/workforce-analysis`
- `hr-operations/process-analysis`
- `hr-operations/operating-plan-draft`
- `hr-operations/audit`
- `hr-operations/operating-plan`

Every consumed stage uses the package-owned codec and `hr-operations/shared/publish-hr-operations-artifact` publisher. Only the final Build-owned role writes and rereads one canonical file at the user's explicit delivery path (default: `artifacts/hr-operations/operating-plan.md`), verifies, commits, and merges it when working in a managed worktree, reads and snapshots the exact immutable returned `primary_head`, publishes the terminal Artifact, and publishes an identical `document@1` view.

## Boundary

Use aggregate evidence only. Never infer protected traits, rank individuals, make automated employment decisions, or present operational guidance as legal advice. Jurisdiction-specific legal conclusions require qualified professional review.

## Publisher dependency contract — 2026.10.24.1

`predecessor_artifact_locators` contains only the exact typed Engine Artifact predecessors required by the selected stage; root stages pass `[]`. Completely read and select other semantic evidence, including original file resources, through the normal Artifact transport. The Host retains that evidence in the output envelope’s `source_artifact_locators` together with the selected typed predecessors. This package input and complete output provenance have different purposes. Existing Tasks keep their frozen package revision; new installations use the current input contract.
