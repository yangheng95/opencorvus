# Darwin DMG packaging repair

## Recall

- User: `会导致发布失败吗？修复问题`, continuing the v0.1.13 release and the Intel DMG investigation. The missing platform prevents complete public release. Repair and native diagnostic verification are now requested; no agents, extra branch/worktree, UI automation or user-process changes.
- Exact original release: run 35820194375, source 0778b617, draft 394308419 and tag v0.1.13. Its 40-minute budget started at 04:53:53 UTC and is never reset. Source repair cannot be silently injected into that tag/run. Preserve draft/tag ownership while making the repair concrete and reviewable.
- Read: prior investigation Recall/logs and exact Tauri 2.11.4 DMG/CommandExt source; shared installerBundler and Overlay build/options; canonical/debug/reusable workflows; packaging docs; installer, workflow and matrix tests; release deadline/publication owners. Repository status is clean at 2c7ff43d.
- Evidence: executable compilation and app signing succeed; DMG script fails with suppressed inner output. Same image/bundler succeeded in v0.1.12; v0.1.8 had the same outer failure and a same-source retry passed. No particular disk/mount/signing root cause has been established. The original release's CLI Intel row has now progressed successfully; remaining failure is the GUI DMG row.
- Acceptance: expose exact packager diagnostics at the existing command owner, preserve failed macOS diagnostic files, validate through the real installed CLI and workflow contracts, run the existing debug packaging workflow on native Intel macOS, diagnose/fix any reproduced underlying failure and requalify actual app/DMG/updater outputs. Record limits and release-identity decisions honestly; commit/push every task change with normal hooks.

## Analysis before changes

The immediate packaging error is inside upstream `bundle_dmg.sh`; current `output_ok()` emits its captured streams only at debug level and replaces a failed exit with a generic error. Our existing command supplies no verbosity flag, and failed-job retention covers only first-run diagnostics, so the original output cannot identify the failing native operation. The first repair is therefore the proven diagnostic failure, not a guessed retry, filesystem tweak or notarization bypass.

`installerBundler` is shared by local full builds and hosted format jobs, including the prepared RPM producer. A standard Tauri verbosity argument belongs at that existing command owner. macOS failure retention belongs in the existing reusable package workflow and must retain bounded text/native disk state, not secrets or an alternate publishing path. The debug workflow currently has only a duplicate all/Linux matrix, so replace its boolean selection with an explicit platform selector derived from the canonical release matrix; remove the former selection input and update its docs/tests. This enables the necessary exact-host check without starting four unrelated native rows.

No product scheduler, Task/Mission/Session queue, wake, concurrency or persistence defect is evidenced. Native subprocess failure must be tested on macOS; local Windows CLI/schema tests prove only command/workflow contracts. Application UI and model behavior are unchanged. The source correction and debug artifacts cannot satisfy the original run's immutable publication receipt; a fresh-source release decision remains separate if original-source recovery cannot complete within its existing budget.

## Plan

1. Enable verbose output through the current installer command and retain failed macOS packaging logs, generated script and disk-state diagnostics in the reusable workflow.
2. Replace debug `linux_only` with a platform choice; select rows from the existing canonical release matrix and verify exact selection/errors. Run focused real CLI, matrix and workflow tests; document the changed diagnostic operation.
3. Commit/push with normal checks and dispatch the existing debug workflow only for darwin-x64. Inspect actual native logs, repair any reproduced inner failure at its real owner, and repeat only justified checks.
4. Record native qualification and remaining release boundary. Preserve the original tag/draft and deadline; ask for a new source/identity decision only after the concrete repair is verified if required.

## Results

Phase 1 implemented: the existing installerBundler always selects Tauri verbose logging, including the prepared RPM CLI. Non-Linux package execution preserves its output with shell pipefail semantics; failed macOS jobs collect native disk state and retain it with the generated DMG script. Debug selection now reads the canonical release matrix and can select exactly darwin-x64; the former boolean input and duplicate matrix were removed.

Focused validation: the real installed Tauri CLI accepts the verbose command and returns its expected version; the runnable selector emits exact Actions JSON on Windows using fileURLToPath; matrix staging and workflow contracts pass. `bun test ./script/installer-bundler.test.ts ./script/overlay-build-selection.test.ts ./script/package-gui-installer-matrix.test.ts ./script/github-actions-workflow-contract.test.ts`: 22 passed / 217 assertions. Initial test-only failures were an outdated checkout inventory and using URL.pathname as a Windows file path; corrected both and reran exact file paths. Docs/architecture/whitespace checks pass. Native qualification and the inner DMG cause remain pending; no guessed packaging retry or release-source rewrite has been added.
