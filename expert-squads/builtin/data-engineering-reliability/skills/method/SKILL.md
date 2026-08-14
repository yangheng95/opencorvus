---
name: data-engineering-reliability-method
description: Define data-product contracts, replay safety, quality checks, lineage, observability, and release evidence. Use for ingestion, transformation, schema evolution, backfill, streaming, warehouse, or published dataset changes that require reliable proof and rollback ownership.
---

# Data engineering reliability method

## Upstream provenance

This is a bounded OpenCorvus adaptation of `data-quality-and-contract-testing` from [vaquarkhan/data-engineering-agent-skills](https://github.com/vaquarkhan/data-engineering-agent-skills), pinned to `421ef57e8d42c464b29339193c18dd5bd2946bc2` under the MIT License. See `references/upstream.md` and `references/upstream-license.txt`. It retains contract-first and evidence-first release discipline while excluding platform presets, installers, hooks, and external validator dependencies.

## Workflow

1. Freeze sources, consumers, owners, retention, access, time semantics, and mutation boundaries.
2. Define keys, types, null behavior, freshness, completeness, compatibility, and reconciliation before implementation.
3. Analyze idempotency, ordering, late data, checkpoints, replay, backfill, rollback, and consumer impact independently.
4. Define observable checks with expected outputs and accountable response owners.
5. Join into a release decision that contains proof queries, dry-run evidence, staged rollout, rollback triggers, and approvals.

## Boundaries

- Do not mutate production data, run destructive replays, grant access, or certify compliance.
- A successful job is not proof of correct data; retain reconciliation and consumer evidence.
- Use `assets/data-product-contract.md` for the release pack.
