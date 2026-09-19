# Overlay current-branch integration and package

## Recall

- User: identify fixes on the current branch missing from main, then package the latest Overlay. User explicitly chose to merge latest main into the current branch and retain its fixes.
- Acceptance: origin/main ancestry included; release family aligned to 0.0.64-beta; freshly compiled Windows Overlay and embedded backend; local installer packages; version and package checks; independent read-only review; scoped commit and upstream push.
- Constraints: retain existing untracked script/video/ and the special-character path; no branch/worktree creation, user process interruption, release publication or UI automation tests. No product interface changes are intended.
- Read: package.json; native packaging and Overlay build scripts; current architecture index and panel contract; September runtime readiness and main's 0.0.64 release record.
- Search: refreshed origin; main has 3 exclusive commits, current HEAD 19011684 has 69. main version commit 5b11c32e is absent from HEAD. Current native packaging uses package.json unless OPENCORVUS_VERSION is supplied. Overlay embeds its backend and builds a Tauri executable.
- Independent agent feedback: none at plan creation; read-only delivery review will follow validation.

## Analysis and impact

The earlier build returned 0.0.63-beta because this branch did not include main's release-family update. The packaging entry correctly read that branch's manifest; rebuilding alone cannot incorporate absent commits. main adds the 0.0.64 release/dependency updates and website paper changes. Current branch has runtime, task evidence, prompt, SDK, benchmark and paper changes; these must remain intact. Exact commit ancestry and source diffs, rather than commit titles alone, determine inclusion. The panel diff confirms new bounded exact task-message reads and related public SDK projections.

No newly observed scheduler or terminal-state defect is under repair here; this is source integration and packaging, not requalification of all existing branch changes. Build and focused dependency/version checks establish the merged packaging contract, not full provider or visual acceptance. No credentials are needed. Potential risks are textual merge conflicts, dependency relinking, Windows file locks and version drift. No OpenCorvus Overlay process was found running before the build. Existing ignored output directories are disposable build destinations; unrelated workspace files remain untouched.

## Execution

1. Merge fetched origin/main into current branch without automatically committing; resolve only evidence-supported conflicts.
2. Update this record and indexes, remove any encountered UI automation tests required by repository policy, and install the merged locked dependencies.
3. Verify version/dependency contracts, build the host Overlay with matching embedded version and local Windows installers, inspect artifact metadata and embedded backend checks.
4. Review the full integration difference and evidence independently; fix valid findings, rerun relevant checks, commit and push current upstream after a fresh fetch/merge and outgoing-commit audit.

## Evidence

- Fetched origin successfully; divergence is main-only 3 / current-only 69. Current upstream already contains all 69 current-branch commits, so they are not newly outgoing work.
- Merged origin/main with no automatic commit. Only specs/README.md and the monthly README conflicted; both sides' entries retained. Main already deletes the encountered website UI automation tests and screenshot script; none were run or reintroduced.
- Release-family check passed at 0.0.64-beta. docs:check passed (339 operations, 25 groups).
- Ordinary frozen installation retained stale transitive links: actual Express/body-parser qs remained 6.15.3 and Provider adapters still resolved old helpers. 9 of 21 focused tests failed. Stopped only this task's package process tree (root PID 19052), then bun install --frozen-lockfile --force installed 3373 packages. All 21 focused tests passed after relinking, without changing dependency declarations or the merged lock.
- Re-ran bun run package:local --skip-linux with OPENCORVUS_VERSION=0.0.64-beta, OPENCORVUS_CHANNEL=local, and OPENCORVUS_BUN_RUNTIME_DIR=.scratch/bun-runtime-1.3.14. This builds the embedded backend, Tauri Overlay and native MSI/NSIS installers. No provider credentials are used and no user Overlay process was interrupted.
- Independent read-only review assigned to review_overlay_merge; initial and final evidence reviews passed with no valid findings. The reviewer independently verified all three artifact sizes and SHA-256 hashes plus Overlay version metadata.
- First independent review: all 35 staged paths match origin/main exactly except the two additive indexes; all existing branch commits are retained and already upstream. No valid finding. Artifact evidence was completed afterward as recorded below.
- Full typecheck passed: 8/8 executed packages. API route check passed (6 rules, 34 files), architecture index passed (16 current documents), package topology passed (10 packages).
- Fresh embedded backend compiled with 319 embedded frontend files; actual executable --version returned 0.0.64-beta. Real check-work-artifact-profile.ts --profile office.presentation@1 --package-root packages/opencorvus/dist/opencorvus-overlay-server-windows-x64 passed, including compiled typed lifecycle, canonical validation receipt and fresh delivery revalidation. This verifies the packaged backend document path; no desktop visual or remote-provider acceptance is claimed.
- Full package:local --skip-linux finished successfully. Rust release build took 3m33s. Desktop executable ProductVersion and FileVersion are both 0.0.64-beta. MSI and NSIS installers were freshly generated; no installation or update of the user's application was performed. docs:check passed again after build; no generated tracked-file drift.

| Local artifact (under packages/overlay/src-tauri/target/release/) | Bytes | SHA-256 |
| --- | ---: | --- |
| opencorvus-overlay.exe | 202369024 | b04c33ec3b25875f9702e53c961103d7a41be11b66a80764e2b4b673b5e9b70e |
| bundle/msi/OpenCorvus_0.0.64-beta_x64_en-US.msi | 192913408 | 1d27c64e726803b3a4b1e218db54c05c24bf33ba7feb5f5b037f9f64fcb55855 |
| bundle/nsis/OpenCorvus_0.0.64-beta_x64-setup.exe | 191583826 | 07ab6a32708c85d4b5bfe8b41266256c199379b2abd704c8fd6620c8d0f54220 |

The package contains current-branch fixes plus main through 5b11c32e. It is a local 0.0.64-beta build, not a new official Release. Current-branch fixes remain unmerged into main. Final merge commit and upstream push follow final review; the normal push hook is mandatory.
