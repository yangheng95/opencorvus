# Tax Compliance Expert Squad

Tax Compliance is a self-contained accounting and tax compliance package. It binds engagement definition, official authority and evidence research, parallel accounting-controls and tax-obligation analysis, remediation synthesis, independent fact checking, and Build-owned reporting into one seven-node workflow.

## Artifact Application Binary Interface (ABI)

Every stage publishes one package-owned, schema-versioned Artifact through `publish_tax_compliance_artifact`. The typed publisher completely reads, validates, and selects every declared predecessor before publication. The compliance plan is the fact checker's sole direct predecessor. The final writer rereads, verifies, commits, and merges `artifacts/tax-compliance/report.md` when working in a managed worktree, reads and snapshots the exact immutable returned `primary_head`, publishes `tax-compliance/report`, and publishes an identical `document@1`.

## Boundary

Every rate, deadline, calculation, and conclusion is bound to supplied records, entity, jurisdiction, period, as-of date, and cited authority. Unknown data remains explicit. The output is compliance research and planning, not a substitute for review by qualified accounting and tax professionals.

## Publisher dependency contract — 2026.10.24.1

`predecessor_artifact_locators` contains only the exact typed Engine Artifact predecessors required by the selected stage; root stages pass `[]`. Completely read and select other semantic evidence, including original file resources, through the normal Artifact transport. The Host retains that evidence in the output envelope’s `source_artifact_locators` together with the selected typed predecessors. This package input and complete output provenance have different purposes. Existing Tasks keep their frozen package revision; new installations use the current input contract.
