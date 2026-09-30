# Atomic release-history backfill evidence

- [Plan and progress](../../records/2026-09/2026-09-30-release-history-backfill.md).
- `inventory.json`: frozen complete package-version, retained tag and existing GitHub Release inventory before body changes; includes 58 evidenced versions from 0.0.35-beta through 0.1.22.
- `versions/<canonical-version>.json`: original source, preceding version source, commit identities/messages and changed-file summary. Each file is committed with its corresponding version's individually reviewed changelog correction. Source evidence is not a second authored notes source.
- `initial-layout.png`: manually inspected real desktop page on an isolated website development server, before missing historical entries were added.

Root CHANGELOG.md is the authored content authority. Current/deleted Release history is source-linked; unavailable installer/publication evidence is not reconstructed from a version name alone. Final public screenshots and readback receipts will be registered here after deployment.
