# Commercial Legal Expert Squad

Commercial Legal is a self-contained commercial matter review package. It binds matter definition, official authority research, parallel contract and regulatory analysis, strategy synthesis, independent fact checking, and Build-owned reporting into one seven-node workflow.

## Artifact Application Binary Interface (ABI)

Every stage publishes one package-owned, schema-versioned Artifact through `publish_commercial_legal_artifact`. The typed publisher completely reads, validates, and selects every declared predecessor before publication. The strategy is the fact checker's sole direct predecessor. The final writer rereads, verifies, commits, and merges `artifacts/commercial-legal/report.md` when working in a managed worktree, reads and snapshots the exact immutable returned `primary_head`, publishes `commercial-legal/report`, and publishes an identical `document@1`.

## Boundary

Every conclusion is bound to supplied facts, exact document text, jurisdiction, as-of date, and cited authority. Unknown facts and unavailable authority remain explicit. The output is legal research and risk analysis, not a substitute for advice from qualified counsel in the relevant jurisdiction.

## Publisher dependency contract — 2026.10.24.1

`predecessor_artifact_locators` contains only the exact typed Engine Artifact predecessors required by the selected stage; root stages pass `[]`. Completely read and select other semantic evidence, including original file resources, through the normal Artifact transport. The Host retains that evidence in the output envelope’s `source_artifact_locators` together with the selected typed predecessors. This package input and complete output provenance have different purposes. Existing Tasks keep their frozen package revision; new installations use the current input contract.
