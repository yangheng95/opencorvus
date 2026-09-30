# Atomic release-history backfill evidence

- [Plan and progress](../../records/2026-09/2026-09-30-release-history-backfill.md).
- `inventory.json`: frozen complete package-version, retained tag and existing GitHub Release inventory before body changes; includes 58 evidenced versions from 0.0.35-beta through 0.1.22.
- `versions/<canonical-version>.json`: original source, preceding version source, commit identities/messages and changed-file summary. Each file is committed with its corresponding version's individually reviewed changelog correction. Source evidence is not a second authored notes source.
- `initial-layout.png`: manually inspected real desktop page on an isolated website development server, before missing historical entries were added.
- `atomic-commits.json`: the 58 exact individually reviewed commits, latest to earliest, each containing only its version entry and source evidence.
- `github-readback.json`: exact authored-body and original publication-state readback for the eight retained version Release objects; mutable updater channels were outside this body backfill.
- `history-dark.png`, `history-light.png`: manually inspected 58-version history index using the site's existing themes.
- `baseline-top.png`, `baseline-middle.png`, `baseline-lower.png`, `baseline-integrations.png`, `baseline-full.png`: actual complete 0.0.35-beta baseline and independently viewed sections, including its integrations, permissions, runtime and developer capabilities.
- `historical-beta-detail.png`: actual numbered beta detail, preserving distinct preparation-attempt history.
- `settings-current-light.png`, `settings-current-dark.png`: actual isolated core development `/ui` installed-version reading, English/light and Chinese/dark chrome.
- `settings-history-light.png`, `settings-history-dark.png`: real version navigation and search, including the baseline's distinct numbered beta attempts.
- `settings-baseline-light.png`, `settings-baseline-dark-middle.png`, `settings-baseline-dark-lower.png`: manually read baseline introduction, tools/integrations and final capability groups in the desktop settings column.
- `settings-about-light.png`: About's release-notes entry; its button was clicked and the current-version detail was verified.
- `settings-validation.json`: isolated service, build/type/design/i18n and backend contract evidence; screenshots provide the visual acceptance.
- `public-deployment.json`: successful signed website workflow 36674176850 for exact source fe9f9f491812aa5e5c9372bbd1d6d809ef2ff07d, public route availability and owned-service cleanup.
- `public-history-light.png`, `public-history-dark.png`: final production 58-version index after deployment, manually viewed in both themes.
- `public-baseline-top.png`, `public-baseline-middle.png`, `public-baseline-tools.png`, `public-baseline-integrations.png`, `public-baseline-lower.png`: final production baseline detail, manually navigated and read through its capability groups/source links/footer.

Root CHANGELOG.md is the authored content authority. Current/deleted Release history is source-linked; unavailable installer/publication evidence is not reconstructed from a version name alone. Public website and GitHub backfill are delivered. The desktop Settings feature is recorded under Unreleased for the next canonical installer; immutable v0.1.22 binaries were published before this feature and remain unchanged.
