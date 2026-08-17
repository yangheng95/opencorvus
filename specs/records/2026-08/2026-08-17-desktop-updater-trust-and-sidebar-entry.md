# Desktop updater trust and sidebar entry

## Recall

| Item | Record |
| --- | --- |
| User request | Explain why desktop update checking fails even though the official site has downloads, repair the updater, and place the update control on the bottom bar of the left panel shown in the supplied screenshots. |
| Acceptance criteria | Every desktop build consumes the official signed update channel with the existing published trust root; checking no longer fails with `Updater does not have any endpoints set`; the left sidebar footer has a clear update action beside the existing version and connection surfaces; focused contract checks pass; the real Overlay page is visually reviewed at desktop size. |
| Hard constraints | Preserve unrelated dirty-worktree changes; do not rotate or invent an updater key; do not expose private signing material; keep one updater configuration authority; do not add or run User Interface automation tests; do not stop or restart the user's running Overlay; use the existing streamed/native update flow and existing settings panel for download/install confirmation. |
| Sources read | `AGENTS.md`; `docs/packaging.md`; `packages/overlay/src-tauri/tauri.conf.json`; `packages/overlay/src-tauri/src/main.rs`; `packages/overlay/script/build.ts`; `packages/overlay/script/build-overlay.ts`; `script/package-local.ts`; `script/package-gui-installer-matrix.ts`; `script/desktop-update-channel.ts`; `script/sync-version.ts`; `.github/workflows/build.yml`; `packages/overlay/src/services/desktop-update.ts`; `DesktopUpdatePanel.tsx`; `App.tsx`; `SidebarVersionLabel.tsx`; `ConnectionBadge.tsx`; sidebar styles and bilingual strings; current August packaging/release records. |
| Whole-repository search results | The native failure is raised before any network request when `app.updater()` sees no endpoints. The canonical release build injects an endpoint and public key, but the host-bound `build:overlay` path and unsigned local installer path compile the checked-in placeholder key plus `endpoints: []`. The running `0.0.45-beta` executable is the repository-local `packages/overlay/dist/...` binary, not the public installer. The public GitHub Release is `v0.0.44-beta.1`, and `desktop-update-beta/latest.json` exists. The published Windows binary contains the beta endpoint and the established Minisign-compatible public trust root; the private signing key is not required by clients. The sidebar footer is owned once by `App.tsx` and currently contains `SidebarVersionLabel` plus `ConnectionBadge`. The About panel already owns checking, download, signature verification, confirmation, and installation. |
| Independent agent feedback | None before implementation. The first post-implementation review confirmed the root cause, trust root, build-path coverage, shared updater flow, and focused checks. It required force-adding this ignored spec, hunk-only staging of shared dirty files, deterministic convergence of multi-endpoint drift, and a saved final screenshot. The endpoint projection and test were corrected; the screenshot was saved for the required follow-up review. |

## Analysis

### Observable symptom and direct trigger

The About panel reports `DESKTOP_UPDATE_CHECK_FAILED: Cannot configure desktop updater: Updater does not have any endpoints set.` The Rust command reaches `app.updater()` and fails while constructing the updater, before `updater.check()` can request any URL. The existence of the website download page or GitHub installer assets therefore cannot affect this failure.

### Root cause and control flow

There are two build paths with different updater configuration:

1. The credential-protected release build overrides the Tauri configuration with the official channel endpoint and an environment-provided public key.
2. The ordinary host-bound build compiles the checked-in Tauri configuration, whose updater has a development placeholder trust root and no endpoints. `package:local` deliberately reuses that host-bound executable while disabling creation of unsigned updater artifacts, so the resulting application still exposes native updater commands but cannot configure its updater client.

The current process evidence identifies the second path: the live executable is under the repository's `packages/overlay/dist/opencorvus-overlay-windows-x64/`, and binary inspection confirms the placeholder key and empty endpoint set. The similarly staged local `0.0.45-beta` installer carries the same broken client configuration. The public website currently points at an earlier signed release and is a separate distribution surface.

### Why the old path did not solve it

Injecting updater configuration only in `packages/overlay/script/build.ts` protects canonical CI releases but permits other supported build/package entrypoints to emit a product-versioned desktop executable with a callable yet unusable updater. Keeping the public verification key in a protected environment variable also creates an unnecessary split source: the key is a client trust root embedded in every released binary, not private signing material.

### Impact audit

- Definitions and callers: checked-in Tauri plugin configuration, release and host-bound build scripts, version synchronization, release workflow contract, packaging documentation, and focused updater tests.
- Runtime data/control flow: native check/download/install commands and the shared SolidJS update signals remain unchanged. Only their compiled endpoint/trust configuration becomes complete for every build.
- User Interface: reuse the existing update service and About panel. The new footer action checks immediately; an available update or error opens About for full details and the existing signed download/install flow. No second updater state or install path is introduced.
- Release/security: preserve the exact public trust root extracted from the already accepted `v0.0.44-beta.1` binary. Retain private signing key/password only in protected release secrets. Stable versus beta endpoint remains derived from the synchronized semantic version.
- Tests/docs/delivery: add positive configuration/version projection coverage, update workflow and packaging contracts, run focused checks plus typecheck/build, visually review the real page, then perform independent read-only review. No schema, API, backend sidecar, updater manifest format, or release publication change is required.
- Risk: a wrong public key would strand updates, so equality with the published binary is mandatory evidence. A stale channel during a future stable bump is prevented by making `sync-version.ts` validate and project the endpoint from the canonical version.

## Plan

1. Make checked-in Tauri updater configuration the sole client authority: retain the published trust root, set the version-derived endpoint and passive Windows install mode, and remove release-only endpoint/key injection.
2. Extend version synchronization and focused tests so beta/stable channel drift is detected and corrected; remove the obsolete public-key secret contract while preserving private signing secrets.
3. Add a sidebar-footer update component backed only by the existing desktop-update service, with bilingual accessible status, and connect it to the existing About details/install surface.
4. Run focused updater/workflow/version checks, Overlay i18n/type/CSS/build checks, and documentation checks. Start the real development page, capture and inspect the footer at desktop size, and iterate on layout if needed.
5. Obtain an uninvolved read-only agent review, resolve every valid finding, repeat affected checks/review until clear, commit only this task's files, merge current upstream without rebasing, verify the outgoing commit set, and push the current branch.

## Verification record

- The first 1440 × 900 real-page screenshot placed a text-labelled Update button correctly in the footer, but the default 280-pixel sidebar then truncated both `OpenCorvus` and `v0.0.45beta`. The control was reduced to the existing refresh/download icon language while retaining its complete dynamic tooltip and accessible label; the saved second screenshot confirms all three footer surfaces fit.
- Published trust evidence: the public `v0.0.44-beta.1` Windows NSIS installer was downloaded from its immutable GitHub Release and extracted read-only. Its embedded `opencorvus-overlay.exe` contains the exact beta endpoint and exact public key now checked into `tauri.conf.json`; no private credential was read or recorded.
- Focused contracts: `bun test script/desktop-update-manifest.test.ts script/sync-version.test.ts script/github-actions-workflow-contract.test.ts script/package-build-environment.test.ts` passed 12 tests and 83 expectations, including stable-channel projection that collapses extra endpoint drift to one canonical endpoint.
- Configuration and documentation: `bun ./script/sync-version.ts --check`, `bun run --cwd packages/overlay check:i18n`, `bun run --cwd packages/overlay check:css-tokens`, and `bun run docs:check` passed.
- Compile/build: `bun run --cwd packages/overlay typecheck`, `bun run --cwd packages/overlay build:vite`, and `git diff --check` passed. Vite reported only its existing third-party `use client`, static/dynamic import, and large-chunk warnings.
- Real-page visual review: the actual Vite-hosted Overlay connected to the running backend. The saved 1280 × 720 final screenshot at `C:/Users/hengu/AppData/Local/Temp/opencorvus-sidebar-update-final.png` shows full `OpenCorvus`, full `v0.0.45beta`, the compact refresh update button, and `Online` in one unclipped footer row. Clicking the button selected the real About settings tab and exposed the existing Desktop updates section. No User Interface automation test or fixture was created or run.
- Independent read-only review: the first review produced the four findings recorded in Recall. After the endpoint fix, screenshot capture, documentation correction, and hunk-only staging, the final follow-up review reported no unresolved findings.
