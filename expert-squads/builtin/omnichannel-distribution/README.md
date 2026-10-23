# Omnichannel Distribution

Omnichannel Distribution prepares and validates channel-specific delivery bundles. It does not post to external platforms. Real posting requires a separately configured connector and a separately declared workflow.

## Optional collaboration guidance

omnichannel-delivery-pack is optional collaboration guidance. Channel specification and rights/compliance analysis run in parallel. Channel adaptation and measurement planning then run in parallel. A synthesis node joins those branches before a single-predecessor readiness review and Build-owned delivery.

## Artifact contract

Every worker uses one package-owned typed publisher. Consumers discover, completely read, and select exact predecessors. Only omnichannel-delivery-owner writes artifacts/omnichannel-distribution/manifest.json, schedule.csv, README.md, and channel directories; it rereads, verifies, commits, and merges the bundle when working in a managed worktree, reads and snapshots the exact immutable returned primary_head, publishes the delivery Artifact, and presents matching document and table Interactive Artifacts.

## Publisher dependency contract — 2026.10.24.1

`predecessor_artifact_locators` contains only the exact typed Engine Artifact predecessors required by the selected stage; root stages pass `[]`. Completely read and select other semantic evidence, including original file resources, through the normal Artifact transport. The Host retains that evidence in the output envelope’s `source_artifact_locators` together with the selected typed predecessors. This package input and complete output provenance have different purposes. Existing Tasks keep their frozen package revision; new installations use the current input contract.
