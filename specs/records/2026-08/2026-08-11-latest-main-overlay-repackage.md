# Latest main merge and Overlay repackage

## Recall

- User request: pull the latest code and package the Overlay again at the existing `0.0.39-beta` release family.
- Acceptance: merge `origin/main` without losing either side's current contracts; pass focused backend checks; run the real `bun run build:overlay` path; report the produced Windows artifact from the merged source.
- Hard constraints: preserve unrelated work; do not run User Interface automation tests; repair build-tool defects exposed by the real package path; independently review the final diff and evidence before commit and push.
- Read material: root `AGENTS.md`, package scripts, `session/wake.ts`, `cli/cmd/serve.ts`, Task control-plane architecture, Expert Squad registry, shared filesystem rename primitive, and current August records/indexes.
- Repository search: the content-addressed Expert Squad snapshot publisher was the only remaining direct directory `rename` on this path; `Filesystem.renameAfterTransientContention` is the existing atomic Windows retry primitive and is already used by Git and implicit-project publication.
- Independent-agent feedback: pending final read-only review after implementation and complete build evidence.

## Problem depth and impact

- Observable symptom: after the latest-main merge, Vite compilation completed but generated Expert Squad payload publication failed repeatedly with Windows `EPERM` while renaming `.snapshot-*` to its immutable digest directory.
- Direct trigger: `materializeCapturedPackageSnapshot` called Node's one-shot `rename` directly under the repository-local package runtime root.
- Root cause: Windows can retain a transient directory handle after the large package tree is written; the registry bypassed the repository's bounded atomic-rename retry contract, so a recoverable contention aborted the whole package build.
- Why the old path was insufficient: retrying the entire build merely repeated the same one-shot publication boundary. The mature shared primitive already recognizes `EPERM`/`EBUSY`, preserves atomic rename semantics, and bounds delay and attempts through the single flag surface.
- Impact surface: embedded Expert Squad payload generation, Overlay packaging, and any runtime package snapshot materialization on Windows. Package bytes, digest calculation, collision handling, and immutable target validation remain unchanged.
- Excluded: no User Interface behavior is modified; no compatibility path, copy/delete fallback, or new configuration source is introduced.

## Implementation and verification plan

1. Route snapshot publication through `Filesystem.renameAfterTransientContention` and keep the existing `EEXIST`/`ENOTEMPTY` concurrent-winner validation.
2. Add a focused positive contract test that materializes an embedded package into the content-addressed revision store and verifies the exact digest and readable bytes.
3. Run the focused test, exact generated-payload command under the package runtime root, typecheck, version/docs checks, and the full Overlay build.
4. Record artifact identity, obtain independent read-only review, resolve every valid finding, then commit and push only after auditing the complete upstream delta.

## Evidence ledger

- First integration boundary: local `HEAD ce15067cfd7da89b2d41e03e6b46f0a9ebbfe8ab`, fetched `MERGE_HEAD 0ae8383da13eeab039ff0067f24297bd3ba85bc2`, merge base `d05710d754f9d396466cd26701c730aab074fa01`.
- Conflict resolution: `git ls-files -u` is empty. `serve.ts` retains startup recovery ownership and failure propagation while adding Mission recovery metrics; `session/wake.ts` retains signal/settlement/independent-Project lifecycle ownership while adding stable receipt identity and Mission recovery completion; both indexes are the complete entry union; the architecture record retains both output-settlement/Mission recovery and scheduler-occurrence contracts.
- Focused positive test: `bun test packages/opencorvus/test/expert-squad/package-snapshot-publication.test.ts` passed with 1 test, 0 failures, and 4 expectations under the repository-local package runtime root.
- Reproduction-path verification: with `OPENCORVUS_HOME=.scratch/package-runtime`, `bun packages/opencorvus/script/generate-expert-squad-payload.ts` completed and regenerated the canonical payload instead of failing with `EPERM`.
- Complete build: `bun run build:overlay` passed after 7,099-module Vite builds, generated build artifacts, Software Development Kit rebuild, Overlay-server compile/runtime payload/hash, and optimized Tauri build.
- Static and repository checks: `packages/opencorvus` typecheck, `version:check` (`0.0.39-beta`), `docs:check` (329 operations, 25 groups), `git diff --cached --check`, and `git diff --check` all passed. No User Interface automation test was run.
- First artifact: `packages/overlay/dist/opencorvus-overlay-windows-x64/opencorvus-overlay.exe`, 198,373,888 bytes, file/product version `0.0.39-beta`, SHA-256 `def0e4e6767a040ded4fae850db8b1d1552eac5fde63b07f13b6131a933cb3e7`.
- First independent read-only review: conflict union, atomic retry semantics, positive test, and artifact identity were accepted. Its sole P1 finding was the missing evidence ledger; this section resolves it and requires a second review.
- Final remote refresh: `origin/main` advanced from the first `MERGE_HEAD` to `2002f2d114bddbb7e6206a62d53560a20edadbaa`. The two new remote commits add the eighth Expert Squad batch and Mission website content. They must be integrated after closing the first merge, followed by affected payload verification, a fresh complete Overlay build, artifact identity refresh, and final independent review before push.
- Final integration boundary: intermediate reviewed merge `46f1336` was merged with `origin/main 2002f2d114bddbb7e6206a62d53560a20edadbaa` without conflicts, producing `69003dacd0813e72e622c88f5ca7ac258536e828`; `git merge-base --is-ancestor origin/main HEAD` returned 0.
- Latest Expert Squad checks: package snapshot publication plus the eighth-batch package and generated-payload integration suites passed with 15 tests, 0 failures, and 388 expectations. The package typecheck also passed on the final integrated tree.
- Final complete build: the uninterrupted build process completed both Vite passes, current 95-package generated payload, Software Development Kit rebuild, Windows Overlay-server payload/hash, optimized Tauri link, and final dist copy. The foreground wait interruption did not stop the owned build process; its original session returned exit code 0 and `Full overlay build complete`.
- Final artifact: `packages/overlay/dist/opencorvus-overlay-windows-x64/opencorvus-overlay.exe`, 198,599,168 bytes, file/product version `0.0.39-beta`, SHA-256 `a7c5f4ee0b299931fa44d238361975cbea21ef346d86c502143081b79700084b`.
- Final checks after the latest build: clean `git status`, `version:check` at `0.0.39-beta`, `docs:check` (329 operations, 25 groups), and `git diff --check` all passed. Final independent review and one last remote refresh remain before push.
