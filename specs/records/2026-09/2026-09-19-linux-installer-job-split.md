# Linux installer job split

## Recall

- User asked why Linux release builds take so long and how to improve them, then explicitly requested `拆开` after the proposal to separate DEB, RPM and AppImage packaging with one shared compilation and independent retries.
- Acceptance: compile once per native Linux architecture; run three separately timed, parallel, independently retryable packaging jobs; retain successful outputs and compilation inputs across failed-job retries; assemble the unchanged complete platform artifact and pass the real release checker before publication. macOS and Windows keep their existing packaging behavior.
- Constraints: do not change the running v0.1.6 source `a6e0ae3c25ea47024b796b0661d976c8fdfcf31e`, tag or workflow run `35447500233`; no competing release, version bump, dependency/compression change, website/npm publication, UI automation, model credentials, new branch or delegation. Commit and normally push this next-build improvement on main.
- Read: repository rules; v0.1.6 Recall; packaging/release docs; architecture index (runtime/UI contracts are not changed); canonical and debug workflows; GUI matrix owner/test; overlay build, naming and configuration; release asset contracts/checker/stager and workflow tests; package environment and file-copy owners.
- Repository search: canonical `build.yml` and debug `build-overlays.yml` duplicate the same five native GUI rows; both call the matrix owner, which calls `packages/overlay/script/build.ts`. Only that script bundles installers. GUI matrix `bundleKinds` duplicates the script's host formats and has no consumer. Publication consumes exactly `overlay-<platform>` complete rows and must retain that interface.
- Primary references: [Tauri CLI bundle](https://v2.tauri.app/reference/cli/#bundle), [locked Tauri 2.11.4 bundle implementation](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.11.4/crates/tauri-cli/src/bundle.rs), [GitHub artifact transfer and permission rules](https://github.com/actions/upload-artifact), [reusable workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows).

## Analysis and impact

The completed v0.1.6 Linux x64 job `105909053996` spent 154.46 seconds compiling Tauri, then 2183.17 seconds bundling. RPM began at 14:08:49.266 UTC and AppImage at 14:43:49.969 UTC: about 35 minutes inside the RPM stage. Rust cache hit. v0.1.3 also spent about 19 minutes (x64) and 42 minutes (ARM64) between those markers. This establishes a packaging-stage bottleneck, not its internal CPU/compression/I/O cause; that deeper cause remains unknown and is outside this split.

Today one `tauri bundle --bundles deb rpm appimage` invocation serializes all formats inside the same job as compilation. Failure loses the runner filesystem and re-running the job repeats compilation. Splitting only step names would not fix that recovery boundary. Tauri's dedicated bundle command reads the already-built executable, checkout configuration/icons and Cargo metadata without invoking compilation. The embedded backend and frontend are inside that executable; external bundle resources are explicitly empty.

Use one reusable native-overlay workflow from both existing callers, retaining their five native matrix rows and final artifact names. Its build job compiles Linux without bundling and uploads only the package-input executable in a tar archive (preserving permissions), exposing the immutable artifact ID. A three-format job matrix downloads that exact artifact ID, restores the binary and invokes one Linux format, with separate timing/timeout and `fail-fast: false`. Each format uploads only final bundle files/signatures, not expanded staging trees. An assembly job downloads the retained input plus three format archives and invokes the existing `--skip-build` staging/checker. Internal artifacts use `gui-*`, outside the publisher's `{cli,overlay}-*` selection. Native rows remain isolated by platform and current workflow run; exact-source checkout and immutable input IDs prevent cross-run or architecture mixing.

Full/default local packaging remains composition of the same compile and bundle phases, not a second implementation. Remove the unused matrix format declaration in favor of the build option owner's host formats. New options explicitly reject invalid combinations/formats. Keep macOS app/DMG and Windows MSI/NSIS paired as before. The assembly job requires all three Linux format jobs; the parent reusable job succeeds only with a complete platform artifact. Existing draft ownership, full five-platform updater generation and final completeness requirements remain unchanged.

No application API, persisted user data, Task/Mission/Session scheduling, provider, UI or dependency contract changes. Costs/risks: two extra native packaging runners per Linux architecture and executable transfer overhead; this isolates RPM and enables reuse but does not itself promise a faster RPM. Same-run retries require retained artifacts (seven days release, three debug). Re-run a failed inner format job, not the complete parent matrix row; an intentional full rebuild replaces its same-run transfer artifacts and reruns dependent jobs. Real native debug execution is required to establish cross-job bundling, beyond local fixture/workflow tests.

## Plan

1. Implement explicit compile-only and Linux single-bundle phases in the existing owners, with positive option/error and staging tests.
2. Consolidate duplicated native overlay workflow steps into one called workflow; wire both callers, retained tar transfers, independent format matrix and complete assembly.
3. Update workflow contracts and packaging/release docs. Run focused tests, docs, types and release topology checks.
4. Commit, fetch/merge upstream, inspect the pending set and push through hooks. Run the debug-only native workflow at the resulting source (no release mutation) and record bounded native results; continue existing v0.1.6 release follow-up separately.

## Status

Implementation complete locally. Working tree was clean at start (`73cc4ce6`). Both callers now use the same per-platform reusable workflow. Linux has retained compile input, three independent formats and complete-row assembly; public asset naming and publication dependencies are unchanged. The debug caller offers a Linux-only selection for focused native validation.

## Local validation

- `bun test ./script/package-gui-installer-matrix.test.ts ./script/github-actions-workflow-contract.test.ts ./script/release-asset-contract.test.ts ./script/stage-release-upload-assets.test.ts ./script/desktop-update-manifest.test.ts`: 25 passed, 159 assertions. Covers explicit phase selection/error contracts, both Linux architectures' assembled filenames through the real release checker, required RPM error, unchanged paired macOS/Windows formats, shared workflow dependencies/artifact IDs and complete release staging. Fixture checks do not establish native bundler execution.
- `bun run typecheck`: eight package tasks passed; seven reused matching cache entries, changed Overlay checked afresh. `bun run docs:check`: passed (341 operations, 25 groups). `git diff --check`: passed.
- Downloaded checksum-verified actionlint 1.7.12: the new reusable workflow and debug caller pass. The canonical release file reports only two pre-existing unsupported `concurrency.queue` keys; the untouched HEAD version reports the identical diagnostics. GitHub has already accepted those existing keys in the successfully completed v0.1.6 workflow. Preserve the live queue policy; this local tool's schema does not validate that newer feature.
- Native Linux cross-job execution remains pending until the debug workflow runs from the pushed source. No source/tag change to v0.1.6 has been made.
