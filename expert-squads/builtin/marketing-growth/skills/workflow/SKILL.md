---
name: marketing-growth-workflow
description: Execute the binding Marketing & Growth Strategy workflow with typed Artifact handoffs and real parallel branches.
---

# Marketing Growth Campaign

Use only `marketing-growth-campaign`. Every node is mandatory and runs once. Each worker publishes exactly `marketing-growth/growth-brief`, `marketing-growth/evidence-dossier`, `marketing-growth/audience-analysis`, `marketing-growth/channel-analysis`, `marketing-growth/growth-strategy`, `marketing-growth/audit`, `marketing-growth/campaign-plan` according to its ownership. A consumer completely reads and selects every exact predecessor through the platform Artifact tools before calling the package publisher. The final owner rereads, verifies, and commits `artifacts/marketing-growth/campaign-plan.md`, obtains `merged` from `merge_back` when available, completely reads the final file from the exact immutable returned `primary_head`, passes that same value as `artifact_snapshot.source_commit`, publishes `marketing-growth/campaign-plan@1` with that exact resource set, then publishes matching interactive evidence from those commit bytes. It performs no write or Git mutation after merge. When already operating in the primary project without `merge_back`, it omits `source_commit` and snapshots the reread file directly.
