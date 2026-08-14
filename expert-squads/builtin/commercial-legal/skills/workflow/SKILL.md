---
name: commercial-legal-workflow
description: Execute the binding commercial legal evidence chain with one typed Artifact per owner, two parallel analyses, independent review, and canonical report delivery.
---

# Commercial Legal workflow

Use only `commercial-legal-review`. Every node runs exactly once. The contract and regulatory analysts are the only parallel branch and both begin only after the authority dossier reaches terminal success. The strategy counsel joins both branches. The fact checker directly verifies only the strategy counsel's single synthesized output. The report writer begins only after that independent audit.

Every worker uses `artifact_search` without a text query to enumerate the complete current Task catalog, reads each chosen immutable locator completely, and selects every semantic source. Domain outputs use `publish_commercial_legal_artifact`; do not duplicate them through generic `artifact_publish`. Dispatch prose carries scope and intent, never Artifact bodies or locators.

The report writer reads all six predecessor Artifact types, writes, rereads, verifies, and commits `artifacts/commercial-legal/report.md`, obtains `merged` from `merge_back` when available, completely reads the final file from the exact immutable returned `primary_head`, passes that same value as `artifact_snapshot.source_commit`, publishes `commercial-legal/report` with the returned resource set, then publishes a `document@1` from those commit bytes. It performs no write or Git mutation after merge. When already operating in the primary project without `merge_back`, it omits `source_commit` and snapshots the reread file directly.
