---
name: seo-geo-workflow
description: Execute the binding SEO & Generative Engine Optimization workflow with typed Artifact handoffs and real parallel branches.
---

# Search and Generative Discovery Plan

Use only `search-generative-discovery-plan`. Every node is mandatory and runs once. Each worker publishes exactly `seo-geo/discovery-brief`, `seo-geo/source-dossier`, `seo-geo/search-analysis`, `seo-geo/generative-analysis`, `seo-geo/discoverability-strategy`, `seo-geo/audit`, `seo-geo/optimization-plan` according to its ownership. A consumer completely reads and selects every exact predecessor through the platform Artifact tools before calling the package publisher. The final owner rereads, verifies, and commits `artifacts/seo-geo/optimization-plan.md`, obtains `merged` from `merge_back` when available, completely reads the final file from the exact immutable returned `primary_head`, passes that same value as `artifact_snapshot.source_commit`, publishes `seo-geo/optimization-plan@1` with that exact resource set, then publishes matching interactive evidence from those commit bytes. It performs no write or Git mutation after merge. When already operating in the primary project without `merge_back`, it omits `source_commit` and snapshots the reread file directly.
