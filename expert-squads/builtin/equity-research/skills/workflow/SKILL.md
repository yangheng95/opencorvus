---
name: equity-research-workflow
description: Execute the binding Equity Research evidence chain through exact Task Artifact discovery, complete reads, explicit selections, and one typed output per owner.
---

# Equity Research workflow

Use only `equity-research-report`. Every declared node must produce terminal-success evidence before dependent work starts. `equity-fundamentals-analyst` and `equity-valuation-analyst` may run in parallel after the source dossier; no other dependency may be reordered.

Each worker searches the current Task catalog for predecessor type and immutable workflow/node provenance, completely reads every candidate it inspects, selects every exact supporting Artifact, and publishes one complete structured output. Dispatch prose carries intent and scope only, never copied predecessor content or private paths.

The final writer reads the charter, source dossier, both analysis branches, thesis, and audit. It resolves every audit item in the report, archives canonical Markdown, rereads that file, snapshots it, and publishes both `equity-research/report` and the matching `document@1` view.

Use the package assets at their owning stages: the planner fills the investment-research charter; the source analyst maintains the normalization ledger; the valuation analyst applies the valuation-model checklist; the thesis analyst maintains the catalyst/risk register; and the fact checker completes the independent audit. The report writer preserves those records and the audit resolution instead of inventing a parallel reporting method.
