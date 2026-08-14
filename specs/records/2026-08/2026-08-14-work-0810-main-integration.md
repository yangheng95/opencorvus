# Work 0810 and Main Integration

## Recall

- User request: synchronize the latest `main` branch into the current `work-0810` branch, then create a Pull Request or merge it into `main`.
- Acceptance: preserve the four `work-0810` Overlay fixes on top of the latest `origin/main`; resolve every merge conflict without creating parallel behavior; pass `bun run build:overlay`; push the integrated current branch; create a `work-0810` to `main` Pull Request.
- Hard constraints: keep the current branch as the delivery source; do not force-push or directly rewrite `main`; do not run User Interface automation tests; preserve unrelated upstream changes; obtain an independent read-only review before commit and push.
- Read material: root `AGENTS.md`; the three August records for Composer intent, Composer disclosure/density, and subagent selector deduplication; the prior latest-main Overlay repackage record; conflicted Overlay components and their call sites.
- Repository search: `SubagentConversationPanel` remains the selector projection boundary; latest `main` adds `isSubagentActivityRecord` filtering while `work-0810` adds unique session projection and latest-record lookup. `SelectControl` remains shared; latest `main` adds TextField accessibility propagation while `work-0810` adds Composer tooltip rendering and copy wrapping.
- Independent-agent feedback: pending final read-only review after conflict resolution and verification.

## Problem depth and impact

- Observable symptom: GitHub reports that `work-0810` cannot be automatically merged into `main`; local comparison shows `main` and the feature branch have diverged.
- Direct trigger: `origin/main` contains 338 commits not present in `work-0810`, while the feature branch contains four Overlay commits not present in `main`.
- Root cause: both branches changed the same current Overlay projection and Select primitive after their common base, and both specification indexes accumulated independent entries.
- Why the old path was insufficient: pushing the feature branch only published its commits; it did not integrate later `main` contracts, so GitHub could not produce a conflict-free merge result.
- Impact surface: subagent conversation selector projection, shared Select accessibility and Composer tooltip layout, specification indexes, build output, and Git delivery state.
- Excluded: no backend protocol, data migration, release, tag, direct `main` push, or User Interface automation test is required.

## Integration and verification plan

1. Merge the fetched `origin/main` into `work-0810` without rewriting either history.
2. Resolve the selector conflict as filtered unique session projection with the existing latest-record authority.
3. Resolve the Select conflict by retaining both TextField accessibility propagation and tooltip-aware option-copy wrapping.
4. Resolve both specification indexes as the complete entry union and verify no conflict markers or unmerged paths remain.
5. Run focused typecheck/document checks and the real `bun run build:overlay` packaging path.
6. Obtain independent read-only review, fix all valid findings, commit the merge, audit the complete upstream delta, push `work-0810`, and create the Pull Request.

## Evidence ledger

- Initial boundary: `work-0810` at `3c074394c79244f7caede8a9f6fb737bd1258947`; `origin/main` at `67ba67288d2ced42a3b81a9c217afc5233e03d9b`; divergence count `338 4`.
- Merge conflicts: `SubagentConversationPanel.tsx`, `SelectControl.tsx`, `specs/README.md`, and `specs/records/2026-08/README.md`.
- Conflict settlement: the selector now composes latest-main activity filtering with unique `sessionID` projection and latest-record lookup; the shared Select composes TextField accessibility propagation with tooltip-aware option wrapping; both indexes contain the complete union. `git ls-files -u` is empty.
- Toolchain recovery: the initial checks exposed a stale local Software Development Kit and a missing locked `open-websearch@2.1.11` dependency. `bun run --cwd packages/sdk/js build` and proxy-backed `bun install --frozen-lockfile` restored the declared dependency graph without changing `bun.lock` beyond the fetched `main` state.
- Build-root repair: the full Overlay pipeline generates the Work Artifact qualification matrix before Software Development Kit generation and again during the server build. Rewriting identical bytes repeatedly produced Windows `EUNKNOWN` file-open failures. The generator now reads the canonical target and returns it when the bytes are already current, preserving the single generated authority and avoiding a redundant write.
- Focused positive test: `bun test packages/opencorvus/test/generate-work-artifact-qualification-matrix.test.ts` passed with 1 test, 0 failures, and 6 expectations; the first generation returned the explicit `written` result, the second returned `current`, and the canonical matrix contained the expected profile/qualification bytes.
- Network reproduction: the native runtime payload timed out without the same local proxy required by Git. With `HTTP_PROXY` and `HTTPS_PROXY` set to `http://127.0.0.1:7890`, the exact `bun run build --overlay-server` subcommand passed, including runtime payload and payload SHA-256 stages.
- Complete build: proxy-backed `bun run build:overlay` passed after 7,106-module Vite builds, generated artifacts, Software Development Kit rebuild, Overlay-server compile/runtime payload/hash, optimized Tauri build, and dist copy. No User Interface automation test was run.
- Final artifact: `packages/overlay/dist/opencorvus-overlay-windows-x64/opencorvus-overlay.exe`, 199,246,848 bytes, file/product version `0.0.43-beta`, SHA-256 `74956cea56498d8ca8d0c2c1d6991ea1ec7db79a4f2e700e379e267c866f0178`.
- Final static checks: Overlay typecheck, `docs:check` (`334 ops, 25 groups`), `git diff --cached --check`, and `git diff --check` passed.
- First independent review: all conflict resolutions, Overlay contracts, indexes, checks, and artifact evidence were accepted. Its sole P2 finding was that two filename/content assertions would not fail if the redundant second write returned. The generator now exposes one underlying `written/current` result while preserving the existing filename-returning wrapper, and the focused test asserts both positive states directly.
- Post-review complete build: proxy-backed `bun run build:overlay` passed again after the result-contract repair, including all generated-artifact, Software Development Kit, Overlay-server, Tauri, and dist-copy stages. A second independent review is required before commit.
- Second independent review: no unresolved findings. The reviewer independently confirmed the single `written/current` implementation, filename wrapper compatibility, positive state assertions, 13-file delivery diff, four conflict settlements, focused test, Overlay typecheck, `docs:check`, diff checks, and final artifact identity.
- Commit and push evidence: merge commit `3c64c0083360730aa215ba925933ee9dbc2623de` was pushed to `origin/work-0810`; the push hook passed Software Development Kit imports, AI runtime, 10-package typecheck, routes, docs, and secret scanning.
- Pull Request evidence: [#18 `fix(overlay): refine composer menus and subagent selectors`](https://github.com/yangheng95/opencorvus/pull/18) was opened from `work-0810` to `main` with initial head `3c64c0083360730aa215ba925933ee9dbc2623de`. At creation, GitHub reported that initial head as `MERGEABLE`, with `mergeStateStatus` `UNSTABLE` while repository checks were completing.
