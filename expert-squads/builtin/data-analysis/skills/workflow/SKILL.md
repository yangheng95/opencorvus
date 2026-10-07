---
name: data-analysis-workflow
description: Execute the binding Data Analysis & Business Insights evidence chain with exact Artifact discovery, complete reads, explicit source selection, parallel analysis, audit, and canonical publication.
---

# Data Analysis & Business Insights workflow

Use only `operating-insight-report`. Each node has an independent initial Turn when its actual inputs are available. Later feedback uses continuation Turns on the existing nodes. The two analysis branches start together after the shared dossier and may run in parallel. The synthesis node waits for both. The initial fact-check stage audits the insight brief, its one direct producer predecessor.

The stage `data-analysis/audit` and a target-bound Core FactCheckReview have different scopes. Keep the stage audit tied to its exact brief. For factual review of a later report, the scheduler continues the existing fact-checker with the writer's exact current Session/Message in a complete new `turn.input`. The reviewer records the Core review for that target. Material findings go back to the report writer in this Task; after a correction, review the changed result against the original obligation and the correct work to preserve. Earlier stage completion does not settle a newly identified discrepancy.

Workers enumerate the current Task catalog, choose by exact type and immutable workflow/node provenance, completely read selected Artifacts, call `artifact_select`, and publish the codec-valid output owned by the current stage through `data-analysis/shared/publish-data-analysis-artifact`. Dispatch prose carries intent and scope only. For each delivery Turn, the final writer rereads, verifies, and commits the canonical Markdown, obtains `merged` from `merge_back` when available, completely reads the final file from the exact immutable returned `primary_head`, passes that same value as `artifact_snapshot.source_commit`, publishes the terminal Artifact with its resource set, and publishes identical commit bytes through `document@1`. It performs no further write or Git mutation after that Turn's merge. A later authorized continuation may repair the report and follows the same sequence for its new result, preserving earlier immutable evidence. When already operating in the primary project without `merge_back`, it omits `source_commit` and snapshots the reread file directly.
