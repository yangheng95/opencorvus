---
name: cloud-platform-architecture-method
description: Turn measurable workload requirements, failure behavior, and cost or operations constraints into provider-neutral cloud architecture decisions. Use for cloud, hybrid, migration, resilience, or platform design that requires explicit alternatives, trade-offs, and approval gates.
---

# Cloud platform architecture method

## Upstream provenance

This is a bounded OpenCorvus adaptation of `cloud-design-patterns` from [github/awesome-copilot](https://github.com/github/awesome-copilot), pinned to `3f0bba475ec40b9680e1d0311b9caffeec5ad4c3` under the MIT License. See `references/upstream.md` and `references/upstream-license.txt`. It retains provider-neutral pattern selection and trade-off analysis, but does not copy the upstream pattern catalog or Azure-specific mappings.

## Workflow

1. Freeze system boundaries, measurable objectives, data classes, traffic assumptions, dependencies, and prohibited changes.
2. Analyze requirements, reliability, and cost/operations independently before selecting a topology.
3. Compare at least two viable alternatives against the same objectives and failure cases.
4. Record state ownership, consistency, recovery, observability, deployment, rollback, and support implications.
5. Join the branches into a staged decision with validation experiments and explicit approval owners.

## Boundaries

- Do not deploy, change cloud accounts, use credentials, or invent vendor pricing and service guarantees.
- Security exceptions, budget approval, data residency, and production readiness remain human-owned decisions.
- Use `assets/cloud-decision-record.md` for the final deliverable.
