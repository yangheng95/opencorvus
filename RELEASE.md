# Release Flow

This repository has one canonical release flow.

For the full package-script and artifact-shape map, see [docs/packaging.md](/docs/packaging.md).

## Source Of Truth

- Release version source of truth: [packages/opencorvus/package.json](/packages/opencorvus/package.json).
- `script/sync-version.ts` owns the explicit OpenCorvus release-family target registry. It synchronizes the CLI, Overlay, internal workspace packages, Visual Studio Code extension, native process supervisor, Tauri configuration, and Bun/Cargo lock entries from that source.
- `packages/web` keeps its independent documentation-site version and is not a release-family target.

Use:

```bash
bun run version:bump 0.0.23beta
```

`version:bump` accepts compact product input such as `0.0.8beta` and canonical SemVer input such as `v0.0.8-beta`. Stored package/native metadata is always canonical SemVer (`0.0.8-beta`), while Overlay derives the compact label (`v0.0.8beta`) from the same value.

Validate:

```bash
bun run version:check
```

## Changelog

- [CHANGELOG.md](/CHANGELOG.md) is the single user-facing version history from `0.0.35beta` onward. It is a release record, not a second version source.
- Record user-visible work under `未发布` as it lands. Use the standard `Added`, `Changed`, `Fixed`, `Removed`, and `Security` categories when they apply.
- Before dispatching a release, move the accumulated entries into a dated compact product version such as `0.0.36beta - YYYY-MM-DD`, then leave a new empty `未发布` section.
- Keep compact product versions in the changelog; package and native metadata continue to use canonical SemVer such as `0.0.36-beta`.

## Canonical CI Workflow

- Canonical workflow: `.github/workflows/build.yml`
- Trigger sources:
  - tag push `v*`
  - manual dispatch with `version`

Version inputs accept compact prerelease and canonical SemVer forms, but stored repo versions are normalized to canonical SemVer. The tag-triggered GitHub release workflow still listens to `v*` tags.

The workflow does all of the following in one pipeline:

1. Sync and verify `opencorvus` + `overlay` versions
2. Run the native GUI installer matrix on Linux / Linux ARM64 / macOS ARM64 / macOS x64 / Windows x64
3. Run the native command-line interface (CLI) archive matrix on the same five hosts
4. Validate and stage GUI installers and CLI archives with `LICENSE`, `THIRD_PARTY_NOTICES.md`, and `SHA256SUMS`
5. Upload the verified files to a draft GitHub Release
6. Publish the draft only after every independent Release asset uploads successfully

`build-overlays.yml` is debug-only and is not the canonical release path.

Generated binaries are never committed to a distribution branch. GitHub rejects
individual Git objects larger than 100 MB, while current native installers and
portable runtimes exceed that boundary. GitHub Releases is the single binary
distribution authority.

The portable CLI matrix is a canonical release input. The Linux remote-service
bundle remains an explicit operational command with a separate artifact shape;
see [docs/packaging.md](/docs/packaging.md).

## Public Downloads

- Latest release: <https://github.com/yangheng95/opencorvus/releases/latest>
- All releases: <https://github.com/yangheng95/opencorvus/releases>

The matrix first uploads one temporary GitHub Actions artifact per platform.
That artifact aggregates the executable and all installer formats for transfer
between jobs, so its displayed size is not one installer's size.

For a real release, `publish-release-assets` downloads those temporary
artifacts, validates and flattens the installer files with
`script/stage-release-upload-assets.ts`, adds the repository license and
third-party notices, then generates `SHA256SUMS` over the complete upload set.
It passes every file separately to `gh release upload`. The GitHub Release page therefore exposes portable CLI archives, MSI, Nullsoft
Scriptable Install System (NSIS) setup, Disk Image (DMG), AppImage, Debian
package (DEB), Red Hat Package Manager (RPM), and macOS application archives as
independent downloads. The temporary row artifact is never the public download
contract.

| Platform            | Recommended download                                                                 |
| ------------------- | ------------------------------------------------------------------------------------ |
| Windows x64         | `OpenCorvus_<version>_x64-setup.exe`, or `.msi` for managed installation             |
| macOS Apple silicon | `OpenCorvus_<version>_aarch64.dmg`                                                   |
| macOS Intel         | `OpenCorvus_<version>_x64.dmg`                                                       |
| Linux x64           | `OpenCorvus_<version>_amd64.AppImage`, `.deb`, or `.rpm` for the target distribution |
| Linux ARM64         | `OpenCorvus_<version>_aarch64.AppImage`, `_arm64.deb`, or `.aarch64.rpm`             |

Every platform row also publishes `opencorvus-<platform>.tar.gz`; x64 rows add
`opencorvus-<platform>-baseline.tar.gz` for processors without Advanced Vector
Extensions 2 (AVX2).

## Local Release Command

Use:

```bash
./script/release 0.0.1
./script/release v0.0.1
```

What it does:

1. Normalizes the explicit version and requires a clean tracked worktree/index on a named branch with a remote upstream
2. Fetches that upstream, requires the local `HEAD` to be its exact commit, and runs the read-only `bun ./script/sync-version.ts <version> --check`
3. Resolves the upstream's exact GitHub repository and remote merge branch, then dispatches `.github/workflows/build.yml` with both `--repo <owner/repository>` and `--ref <remote-branch>` plus the verified `expected_source_sha=<HEAD>` fence

Version generation remains an explicit preparation step through `bun run version:bump <version>` followed by review, commit and push. The workflow rejects a manual dispatch if its checkout no longer equals `expected_source_sha`; the dispatcher never writes version projections or chooses a newer semantic version on the operator's behalf.

## Local Overlay Build

Use:

```bash
bun run --cwd packages/overlay build
```

This build is bound to `opencorvus` packaging:

1. Builds the current-platform `opencorvus` binary
2. Stages it into overlay Tauri resources
3. Builds the overlay installer/bundle

## Required CI Guards

- `.github/workflows/test.yml` runs `bun ./script/sync-version.ts --check`
- If overlay and opencorvus versions drift, CI must fail
- The release workflow validates GUI asset names and required files with:

```bash
bun ./script/check-release-assets.ts overlay ... --require-bundle
```

## Release Expectations

Successful release means:

- GUI executable and installer bundles exist for every supported platform
- CLI runtime archives exist for every supported platform, including baseline x64 variants
- `SHA256SUMS`, `LICENSE`, and `THIRD_PARTY_NOTICES.md` are attached to the release
- Overlay launches bundled `opencorvus`
- Overlay reaches `online`
- Overlay and opencorvus versions are aligned in repo metadata

The canonical workflow performs portable CLI acceptance with
`bun run package:binary-matrix` on each supported native host. Linux
remote-service bundle acceptance remains separate under
`bun run package:linux-binary`.
