# Omnichannel Distribution

Omnichannel Distribution prepares and validates channel-specific delivery bundles. It does not post to external platforms. Real posting requires a separately configured connector and a separately declared workflow.

## Binding workflow

The only workflow is omnichannel-delivery-pack. Channel specification and rights/compliance analysis run in parallel. Channel adaptation and measurement planning then run in parallel. A synthesis node joins those branches before a single-predecessor readiness review and Build-owned delivery.

## Artifact contract

Every worker uses one package-owned typed publisher. Consumers discover, completely read, and select exact predecessors. Only omnichannel-delivery-owner writes artifacts/omnichannel-distribution/manifest.json, schedule.csv, README.md, and channel directories; it rereads, verifies, commits, and merges the bundle when working in a managed worktree, reads and snapshots the exact immutable returned primary_head, publishes the delivery Artifact, and presents matching document and table Interactive Artifacts.
