# Packaging Current State

`package:local` binds the native embedded service version to the canonical
`packages/opencorvus/package.json` version using the native build environment.
An explicit `OPENCORVUS_VERSION` must match desktop metadata. Its default channel
is `local`; the general developer build's branch/timestamp version is not a
local installer version.

This document is the packaging map for the repository. It separates the CLI
binary, the Tauri overlay desktop app, release CI, and local smoke packaging.

## Package Surfaces

| Surface                   | Main output                                                                                                        | UI hosting model                                                                                                                                                            | Current owner                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Native CLI bundle         | `packages/opencorvus/dist/opencorvus-<platform>/` plus a platform archive                                          | The native packager stages the Overlay UI beside the executable and verifies the complete colocated runtime before archiving it.                                            | `script/package-native-binary.ts` and `script/package-binary-matrix.ts`                                               |
| Local Linux single binary | `packages/opencorvus/dist/binary/opencorvus-linux-x64/opencorvus` and `...-baseline/opencorvus` plus `bin/rg`      | Overlay UI files are embedded into the Bun executable; no sibling `ui/` directory is required. Ripgrep is copied from the compatible build host into the runtime bundle.    | `script/package-linux-binary.ts`                                                                                      |
| Local container image     | Docker image built from `packages/opencorvus/Dockerfile`                                                           | Copies the local Linux single-binary bundle archive to `/opt/opencorvus`, installs Node.js, Git, Chromium, and the Browser MCP sidecar runtime, and serves embedded `/ui/`. | `packages/opencorvus/Dockerfile` and `script/opencorvus-container-entrypoint.sh`                                      |
| Overlay desktop app       | `packages/overlay/dist/opencorvus-overlay-<platform>-<arch>/opencorvus-overlay(.exe)` plus installer bundles in CI | Tauri embeds an `opencorvus-overlay-server-*` sidecar archive through Rust `include_bytes!`, then extracts it at runtime.                                                   | `packages/overlay/script/build.ts`, `packages/overlay/script/build-overlay.ts`, `packages/overlay/src-tauri/build.rs` |
| Overlay server sidecar    | `packages/opencorvus/dist/opencorvus-overlay-server-<platform>-<arch>/opencorvus(.exe)`                            | No web UI sidecar contract; it is the backend payload consumed by the Tauri overlay.                                                                                        | `packages/opencorvus/script/build.ts --overlay-server`                                                                |

## Root Scripts

| Command                                | Script                                     | Purpose                                                                                               | Platform behavior                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run package:native-binary`        | `script/package-native-binary.ts`          | Build the SDK, then build, verify, and archive the current host's complete native CLI runtime bundle. | Supports Windows x64, macOS x64/arm64, and Linux x64/arm64 on matching native hosts.                                                                                      |
| `bun run package:linux-binary`         | `script/package-linux-binary.ts`           | Build Linux x64 and baseline remote overlay-server bundles with embedded UI.                          | Requires Linux x64 or WSL. Rejects other hosts.                                                                                                                           |
| `bun run package:binary-matrix`        | `script/package-binary-matrix.ts`          | Run the host-verifiable package matrix.                                                               | Packages the matching native Windows, macOS, or Linux row and lists only non-host rows as skipped.                                                                        |
| `bun run package:gui-installer-matrix` | `script/package-gui-installer-matrix.ts`   | Build, validate, and stage the current host's GUI installer row.                                      | Owns Linux x64/ARM64, macOS x64/ARM64, and Windows x64 rows; executes only the row matching the native host.                                                              |
| `bun run package:local`                | `script/package-local.ts`                  | Local aggregate for overlay-server and overlay builds.                                                | Uses Bun for overlay-server, native Tauri for current host overlay, requires Docker for Linux overlay targets unless `--skip-linux` is passed, and skips macOS off macOS. |
| `bun run build:overlay`                | `packages/overlay/script/build-overlay.ts` | Build the bound overlay app for the current host or explicit same-OS target triple.                   | Rejects cross-OS Tauri builds.                                                                                                                                            |

## OpenCorvus Build Scripts

| Script                                         | Role                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/opencorvus/script/build.ts`          | Main Bun compile script. Supports CLI and `--overlay-server` flavors, `--single`, `--all`, `--baseline`, `--musl-only`, `--no-clean`, and `--binary-only`. It compiles the executable, packages native runtime `node_modules`, builds Browser MCP Node sidecars, and copies target-compatible Node and Ripgrep runtimes. |
| `packages/opencorvus/script/build-targets.ts`  | Pure target filtering for `build.ts`. Keeps target selection testable without running compile side effects.                                                                                                                                                                                                              |
| `packages/opencorvus/script/build-artifact.ts` | Artifact naming, entrypoint, external-module, native dependency, and Node runtime rules for Bun compile outputs.                                                                                                                                                                                                         |
| `packages/opencorvus/script/build.local.ts`    | Local build variant still present in the tree. It is not the root `package:linux-binary` entrypoint.                                                                                                                                                                                                                     |

## Overlay Build Scripts

| Script                                      | Role                                                                                                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/overlay/script/build-overlay.ts`  | Developer-facing full overlay build. Runs i18n check, Vite build, SDK rebuild, `opencorvus --overlay-server` build, then `tauri build --no-bundle`.             |
| `packages/overlay/script/build.ts`          | Release overlay phases: compile the embedded backend/frontend and Tauri executable, then bundle installers. `--no-bundle` compiles only; Linux `--bundle <deb|rpm|appimage>` consumes the retained executable without compiling. |
| `packages/overlay/script/build-docker.ts`   | Linux overlay Docker builder. Requires prebuilt `opencorvus-overlay-server-linux-*` payloads and produces portable overlay directories.                         |
| `packages/overlay/script/artifact-names.ts` | Single naming helper for overlay package, executable, and overlay-server sidecar names.                                                                         |
| `packages/overlay/src-tauri/build.rs`       | Rust build script that archives the overlay-server payload as `embedded_sidecar.tar.gz` and emits an `include_bytes!` module.                                   |

## Release CI

`.github/workflows/build.yml` is the canonical release workflow.

The shared `setup-bun` action installs the frozen dependency graph on every native
host. Linux and macOS also restore/save the Bun download cache through GitHub
Actions. Windows uses the runner-local Bun cache populated by its normal install:
archiving the full Windows download tree after a successful build exceeded the
native job deadline. Rust build and Bun executable caches retain their own owners.

It currently has these jobs:

1. `prepare`: resolves version, syncs package metadata, and optionally creates the GitHub Release.
2. `package-overlay`: runs the GUI installer matrix natively on Linux x64, Linux ARM64, macOS ARM64, macOS x64, and Windows x64.
3. `package-cli`: runs the portable CLI matrix on the same five native hosts.
4. `publish-release-assets`: stages and uploads the validated GUI installers and CLI archives to the GitHub Release.
5. `publish-release`: publishes the draft only after all independent Release assets upload successfully, then promotes the signed `latest.json` to the matching desktop update channel.

The canonical release publishes both portable CLI archives and Tauri GUI installers:

- `package-overlay` calls the shared `.github/workflows/package-overlay.yml` once per native host. The debug-only `build-overlays.yml` uses that same implementation; `platform=all`, `platform=linux` or an exact platform such as `darwin-x64` selects rows from the canonical release matrix through `script/overlay-build-selection.ts`. The former `linux_only` input is replaced by this one selector. The matrix script owns SDK preparation, compilation, staging, naming and validation.
- `script/check-release-assets.ts overlay --require-bundle --require-updater` verifies each staged executable, installer set, selected updater artifact, and updater signature before upload.
- `package-cli` invokes `package:binary-matrix`, which owns native CLI compilation, complete runtime staging, smoke execution, archive creation, and archive verification.
- `script/package-linux-binary.ts` remains the remote/container overlay-server bundle with embedded UI under `dist/binary/*`; it is not the public terminal CLI archive.
- `build:overlay` remains the developer-facing bound Tauri build command. Release installers use `packages/overlay/script/build.ts` through the GUI matrix owner.
- Generated binaries are not committed to a distribution branch: current
  installers and portable runtimes exceed GitHub's 100 MB per-object Git limit.
  GitHub Releases is the single binary distribution authority.

### CI transfer artifacts and public release assets

The shared installer command enables Tauri verbose logs for local and hosted builds,
including the corrected RPM producer. Native bundle subprocess output is otherwise
hidden behind Tauri's generic `failed to run` error. Non-Linux GUI jobs retain a package
log on failure; failed macOS jobs additionally retain the generated DMG script, disk
space, mounted-image and disk inventories in `installer-diagnostics-<platform>`.
These diagnostics do not convert a failed bundle into success or replace installer
validation. Use the exact-platform debug workflow for native diagnosis; its artifacts
cannot replace another release run's source-owned publication inputs.

Linux compilation runs once per architecture using `package:gui-installer-matrix --build-only`.
It retains the `package-input` executable in a permission-preserving tar archive, and three
independent native jobs consume that exact immutable Actions artifact ID to bundle DEB,
RPM and AppImage in parallel. Each job has its own timer, a 90-minute bound and a retained
format archive. RPM therefore does not hold up production of the other formats.

RPM uses `script/prepare-rpm-bundler.py` through the shared installer-command owner
for both local and hosted packaging. It builds the installed Tauri CLI version's exact
upstream source with one checksum-verified Cargo source patch to rpm 0.16.0: hash only
the bytes the inner writer actually accepted. Gzip level 6 and installer metadata remain
unchanged. The stock npm RPM producer is replaced; it is not a retry path. Other formats
use the installed CLI as before. Linux local RPM packaging additionally needs Python 3.12+
and `patch`, alongside the existing native Rust build environment.

The workflow caches only the prepared bundler and its identity receipt, using CLI version,
native architecture and preparation/patch identity. Product version bumps do not invalidate
this tool cache. Preparation checks that the dependency graph changes only rpm's source;
an upstream rpm version change requires reviewing/removing the patch. Cached executable
bytes must match their recorded tool identity. These identity checks do not replace package
acceptance.

Before retaining an RPM, `script/check-rpm-package.py` runs system RPM verification,
uses the official Python RPM bindings to check the uncompressed CPIO digest explicitly,
and installs/verifies all files in an empty isolated root. The installed executable must
match the immutable compile snapshot after Tauri's exact first `__TAURI_BUNDLE_TYPE_VAR_UNK` to `__TAURI_BUNDLE_TYPE_VAR_RPM` transformation. Tauri restores its working binary after bundling, so that mutable path is not an installed-file comparison input. The compile digest, expected and actual installed digests, and marker offset are recorded. This accepts
the package file transaction, not a desktop launch or OS dependency integration; packages
with install scripts require additional acceptance rather than silently skipping those scripts.
The workflow exercises this checker with system rpmbuild first, saves the verified bundler
cache before product acceptance, and retains failed RPMs for diagnosis.

After all three formats succeed, assembly restores their archives and invokes
`package:gui-installer-matrix --skip-build`, including the existing complete installer
and updater-signature checker. The internal `gui-input-*` and `gui-bundle-*` artifacts
are not release upload inputs. The final artifact remains `overlay-<platform>`.
Use GitHub's failed-job retry on the inner format job to reuse the successful compile
and other format artifacts; re-running the complete parent native workflow is a full
rebuild. Transfers expire after seven days for release builds or three days for debug
builds. Once expired, the native row must be rebuilt. Never mix artifacts from other runs.

Each `package-overlay` and `package-cli` row uploads its whole validated staging directory as one
short-lived GitHub Actions artifact. Its displayed byte count is the aggregate
of the executable and every installer format for that platform; it is not the
size of one installer.

`publish-release-assets` downloads those row artifacts, then
`script/stage-release-upload-assets.ts` validates and flattens the installer and
CLI archive files into a temporary directory. The workflow passes the resulting
file list to `gh release upload`, so each installer or CLI archive is an
independently downloadable asset on
<https://github.com/yangheng95/opencorvus/releases>. The release upload does not
publish the aggregate Actions artifact, an unpacked CLI directory, or a staged
bare executable.

### Signed desktop update channels

The desktop updater has one compiled trust root and two release channels:

- semantic versions with a prerelease component use `desktop-update-beta/latest.json`;
- versions without a prerelease component use `desktop-update-stable/latest.json`.

Installers remain immutable assets on `v<version>` releases. The mutable channel
release contains metadata only. `publish-release` updates that metadata after the
complete version release is public, so a client never receives a manifest that
points at a draft or partial installer set. Windows uses the signed NSIS
(Nullsoft Scriptable Install System) setup executable, macOS uses Tauri's signed
application archive, and Linux uses the signed AppImage.

The updater's Minisign-compatible public verification key is committed in
`packages/overlay/src-tauri/tauri.conf.json`, because it is the client trust
root already embedded in every published application. `sync-version.ts` keeps
that configuration on the beta or stable channel derived from the synchronized
semantic version, so release, local installer, host-bound, and development
builds consume one updater configuration.

Release packaging requires these protected GitHub Actions secrets:

- `TAURI_SIGNING_PRIVATE_KEY`: the complete encrypted private key used only by native packaging jobs;
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the private-key password.

Generate the key pair with the installed Tauri command-line interface outside
the repository and CI workspace, for example `tauri signer generate --write-keys
<offline-path>`. Store an encrypted offline copy of the private key and password
in separate recovery authorities, and record the public key fingerprint with the
release operator runbook. A lost private key cannot sign updates accepted by
existing clients. Replacing the public key creates a new trust root and therefore
requires a conventionally installed bridge release signed by the old key; never
silently substitute a new key in the channel metadata.

## Validation Commands

Run the focused packaging contract tests after changing packaging logic:

```bash
bun test script/release-asset-contract.test.ts script/stage-release-upload-assets.test.ts script/desktop-update-manifest.test.ts script/github-actions-workflow-contract.test.ts packages/opencorvus/test/browser-mcp-node-bundle.test.ts
```

Build the complete native CLI package on the current supported host:

Both native matrix entrypoints initialize `<repo>/.scratch/package-runtime` as
their build-time OpenCorvus runtime root and project its canonical `tmp`
directory through `TEMP`, `TMP`, and `TMPDIR`. This keeps build validation,
content-addressed package snapshots, and pinned runtime downloads out of the
operator's production AppData. The canonical backend release build applies the
same projection when invoked directly. An explicitly configured absolute
`OPENCORVUS_HOME` replaces this default root and remains the only runtime-path
authority for that package invocation.

```bash
bun run package:binary-matrix
```

The matrix must report the current host row as `packaged`, execute each emitted
binary with `--version`, and create the matching release archive.

Build the native GUI installer package on the current supported host:

```bash
bun run package:gui-installer-matrix
```

The GUI matrix must report the current host row as `packaged` and stage its
validated executable plus native installer bundles under
`packages/overlay/dist-artifacts/<platform>/`.

The Linux single-binary smoke check must copy the runtime bundle to an empty
directory, run `opencorvus serve`, and fetch `/ui/`. Passing that check proves
the UI is embedded and Ripgrep comes from the packaged `bin/rg` instead of the
host `PATH`.

Build the local container image from the repository root after
`bun run package:linux-binary` has produced
`packages/opencorvus/dist/binary/opencorvus-linux-x64/opencorvus-bundle.tar.gz`:

```bash
docker build -f packages/opencorvus/Dockerfile \
  --build-arg OPENCORVUS_BINARY_NAME=opencorvus-linux-x64 \
  -t opencorvus:local .
```

Container release smoke checks:

```bash
docker run --rm opencorvus:local --version
docker run --rm --entrypoint sh opencorvus:local -lc 'node --version && git --version && chromium --version && /opt/opencorvus/browser-mcp-node/node --version && test -f /opt/opencorvus/browser-mcp-node/browser.mjs && test -f /opt/opencorvus/browser-mcp-node/node_modules/playwright/index.js'
docker run --rm -d --name opencorvus-smoke -p 7878:7878 opencorvus:local
curl -fsS http://127.0.0.1:7878/ui/ | grep -i '<!doctype html'
docker rm -f opencorvus-smoke
```

## Continuous integration and publication

The `CI` workflow (`.github/workflows/test.yml`) is the ordinary main-push and
pull-request entry point. It owns version alignment, generated-artifact fixed
point, documentation, types, credential/dependency checks, the Linux critical
binary build, three-platform isolated backend/utility tests and service tests.
CodeQL remains separate for its security permissions and weekly scan. Canonical
native publication, manual Overlay debugging and website deployment keep their
existing boundaries; a CI push does not dispatch a native Release.

Root Markdown and Markdown under `docs/` or `specs/` use documentation checks
and security auditing without native tests/builds. Markdown elsewhere (including
expert-squad payloads) still selects full code validation. Renames consider both
source and destination. New code checks supersede earlier checks on the same
ref/platform; documentation updates do not cancel code checks. Manual validation
has its own concurrency identity.

For a focused hosted reproduction, manually dispatch `test.yml` with newline-
separated package-relative `test_files`. An empty value runs the complete suite;
selected runs are explicitly named `Selected CI passed`, not full acceptance.
Backend logs stream each file's START/DONE, exit code and duration. File process
isolation, finite inactivity supervision and all three host platforms remain
part of the test contract. Native packaging still requires every installer
format, including RPM, before the release completeness checker permits publication.

## Linux Binary Smoke Expectations

A current Linux single-binary package is valid when the built executable:

1. Reports the repository package version with `opencorvus --version`.
2. Starts `opencorvus serve` from an empty directory with its packaged `bin/rg`.
3. Serves `/ui/` from the embedded overlay UI.
4. Does not require a sibling `ui/` directory next to the executable.
