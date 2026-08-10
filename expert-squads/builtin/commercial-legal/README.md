# Commercial Legal Expert Squad

Commercial Legal is a self-contained commercial matter review package. It binds matter definition, official authority research, parallel contract and regulatory analysis, strategy synthesis, independent fact checking, and Build-owned reporting into one seven-node workflow.

## Artifact Application Binary Interface (ABI)

Every stage publishes one package-owned, schema-versioned Artifact through `publish_commercial_legal_artifact`. The typed publisher completely reads, validates, and selects every declared predecessor before publication. The strategy is the fact checker's sole direct predecessor. The final writer rereads, verifies, commits, and merges `artifacts/commercial-legal/report.md` when working in a managed worktree, reads and snapshots the exact immutable returned `primary_head`, publishes `commercial-legal/report`, and publishes an identical `document@1`.

## Boundary

Every conclusion is bound to supplied facts, exact document text, jurisdiction, as-of date, and cited authority. Unknown facts and unavailable authority remain explicit. The output is legal research and risk analysis, not a substitute for advice from qualified counsel in the relevant jurisdiction.
