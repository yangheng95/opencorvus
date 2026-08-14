---
name: data-analysis-workflow
description: Execute the binding Data Analysis & Business Insights evidence chain with exact Artifact discovery, complete reads, explicit source selection, parallel analysis, audit, and canonical publication.
---

# Data Analysis & Business Insights workflow

Use only `operating-insight-report`. Every node runs once after its declared predecessors reach terminal success. The two analysis branches start together after the shared dossier and may run in parallel. The synthesis node waits for both. The fact-check node has exactly one direct producer predecessor.

Workers enumerate the current Task catalog, choose by exact type and immutable workflow/node provenance, completely read selected Artifacts, call `artifact_select`, and publish one codec-valid output through `data-analysis/shared/publish-data-analysis-artifact`. Dispatch prose carries intent and scope only. The final writer rereads, verifies, and commits the canonical Markdown, obtains `merged` from `merge_back` when available, completely reads the final file from the exact immutable returned `primary_head`, passes that same value as `artifact_snapshot.source_commit`, publishes the terminal Artifact with its resource set, and publishes identical commit bytes through `document@1`. It performs no write or Git mutation after merge. When already operating in the primary project without `merge_back`, it omits `source_commit` and snapshots the reread file directly.
