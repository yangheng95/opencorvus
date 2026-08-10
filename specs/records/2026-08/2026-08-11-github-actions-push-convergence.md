# GitHub Actions Push Convergence

## Recall

### User request

- Strictly fix the large number of GitHub Actions failures created by every push.
- After the repair is proven, delete the repository's previous Actions runs.

### Acceptance criteria

- Classify the current push-triggered workflows by their first failing command; do not treat the required-job aggregator as an independent defect.
- Every workflow that consumes generated Software Development Kit (SDK) exports on a clean runner must build those exports before the first consumer runs.
- The OpenCorvus unit suite must execute through its repository-owned preload and isolated runtime/database root on Linux, macOS, and Windows.
- Ordinary pushes remain verification/deployment only. Native release packaging remains restricted to an explicit `v*` tag or a manually supplied release version.
- Workflow syntax and focused workflow contracts pass locally; a source-frozen clean snapshot reproduces the runner initialization path.
- A new push completes its required Actions checks without failures before any history is deleted.
- Delete all completed Actions runs older than the new green proof run, then verify that the retained proof run is the only newer run. Do not delete workflow definitions.

### Hard constraints

- Preserve the shared dirty index and all unrelated working-tree changes. Do not reset, clean, stash, or whole-file stage shared files.
- Do not add or run User Interface (UI) automation.
- Do not package a native release on an ordinary push.
- Run focused checks rather than the intentionally disabled root `bun test`.
- The post-implementation review must be performed read-only by an independent agent.
- GitHub run deletion is destructive and is authorized only for `yangheng95/opencorvus`; enumerate exact run IDs immediately before deletion.

### Sources read

- Repository rules in `AGENTS.md`.
- `.github/actions/setup-bun/action.yml` and every active workflow under `.github/workflows/`.
- `script/github-actions-workflow-contract.test.ts`, `script/generate.ts`, `turbo.json`, `packages/opencorvus/package.json`, `packages/opencorvus/bunfig.toml`, `packages/opencorvus/test/preload.ts`, and the inactivity/process-supervisor path.
- GitHub run/job logs for current `main` push `b9682aacee4cda23c6c6a5b785e84d45b68e56ee` and prior push `e2eb495e89f4209ef5e8503b77af74af70d1d99d`.
- Bun's official test-runner and test-configuration documentation: the documented default is a single test-runner process with preload scripts loaded before tests; supported within-file concurrency is `--concurrent` with an optional maximum.
- Prior clean-runner repair record, used only as historical guidance; all remote states were freshly verified.

### Whole-repository search

- Generated SDK imports are consumed by `packages/opencorvus/src/expert-squad/registry.ts`, `conversation-authoring.ts`, and `protocol-schema.ts`; `script/generate.ts` imports build/template generators before its later SDK build step.
- `prepare_sdk` exists only in the shared setup action and selected `test.yml` jobs. `generate.yml` and `typecheck.yml` omit it even though their first generator call now traverses the registry.
- `packages/opencorvus/bunfig.toml` owns the sole test preload. `packages/opencorvus/package.json` adds the undocumented `--parallel=2` process mode to the test command.
- The workflow contract test currently covers SDK setup only for three `test.yml` jobs and does not cover `generate.yml`, `typecheck.yml`, or the package test execution boundary.
- `build.yml` remains tag/manual only; `build-overlays.yml` remains manual only. They are excluded from the ordinary-push failure repair except for regression validation of their triggers.

### Independent agent feedback

- None before implementation. A fresh read-only review is required after the first complete validation pass.

## Evidence and root cause

### Observable state

- Repository identity is `yangheng95/opencorvus`, default branch `main`. During investigation a parallel authorized delivery advanced both local `HEAD` and fetched `origin/main` to `31be4bc705ee5fe58c1d9567a8f6f4f68c417fb7`; the source-frozen validation snapshot was rebuilt from that exact tree before verification.
- The newest push started `generated-artifacts`, `security`, `test`, `codeql`, and `typecheck`. Security succeeded; CodeQL and Test were initially still running; `generated-artifacts` and `typecheck` failed during their first generator step.
- Recent pushes repeatedly show the same red pattern. Deployment successes and security successes prove this is not a repository-wide credential or runner outage.

### Root cause A: generated SDK bootstrap ordering

- Both failed jobs terminate with `Cannot find module '@opencorvus-ai/sdk/expert-squad-authoring'` from `packages/opencorvus/src/expert-squad/registry.ts`.
- Dependency installation creates the workspace dependency graph but not `packages/sdk/js/dist`. The shared setup action already owns the canonical `prepare_sdk` primitive, but the two generator workflows do not enable it.
- `script/generate.ts` builds the SDK only after importing and executing generators whose transitive graph already consumes the generated SDK export. Therefore its internal later build cannot bootstrap the first import.
- Repair boundary: enable the existing setup action's SDK preparation in every clean-runner job whose first command traverses those imports, and encode that requirement in the workflow contract test.

### Root cause B: unsupported parallel test-process boundary and cross-file state leakage

- Linux, macOS, and Windows unit jobs fail with `Memory tests require the repository test preload`, followed by the expected fail-closed refusal to reset a database outside `OPENCORVUS_TEST_PROCESS_ROOT`. The final `test (linux)` job is only an aggregator reporting those upstream failures.
- The same command fails locally with Bun 1.3.14 when `--parallel=2` is present and succeeds on the same focused test when that flag is removed. The flag was added after the last clean-runner repair.
- The repository preload dynamically creates one process-owned temporary runtime/database root and installs global cleanup. Bun's undocumented `--parallel=2` process mode did not preserve that preload boundary. Removing it restored preload loading, but a complete single-process run then exposed the opposite problem: mutable Instance, database, provider, and mock state leaked between test files. Four failures from the combined run passed immediately when each file was launched in a fresh process.
- Bun's documented test runner loads configured preloads before tests. The documented `--concurrent` option is within a runner and is unsuitable for this suite's shared runtime/database ownership.
- Repair boundary: add one repository-owned file runner that discovers `.test.ts` files in canonical byte order, launches each file through an ordinary preload-aware `bun test` process, permits at most two independent files at once, inherits output, aggregates every failed file, and returns nonzero if any file fails. The package test command remains under the existing inactivity monitor.

### Root cause C: stale workflow contract after deploy hardening

- The first focused contract run exposed a separate deterministic failure: the checkout inventory still expected 15 tag-based references, while the active workflows now contain 17 references because the deployment workflow added two jobs and pins both checkout invocations to an immutable commit.
- The previous count and all-`@v6` expectation no longer represented the current security contract. Reverting the pinned deployment actions would weaken the signed deployment boundary.
- Repair boundary: enumerate the complete active checkout ownership map, preserving the two immutable deployment pins and the current major-version references for the remaining jobs.

### Root cause D: committed generator drift

- Once the SDK bootstrap ran in a clean snapshot, `generate.ts` produced a one-line change in the portable authoring template. This proved the checked-in template was stale even though the earlier workflow never progressed far enough to report it.
- Repair boundary: commit only the generator-owned line and re-run generation twice from the frozen snapshot until the generated-artifact checker reports no drift.

### Root cause E: expansion-sensitive duplicated test facts

- The full preload-correct suite exposed fixed totals of 15, 25, and 29 after the generated Market had expanded to 45 payload packages plus four embedded packages. The same expansion also left two tests calling the removed `settingsCatalog` API, one stale package-tool description, an obsolete non-canonical Session ID, and a Zod 3 `anyOf` assertion against Zod 4's `oneOf` result.
- Repair boundary: derive Market and shipped-package totals from the generated/built-in source arrays, migrate exact-detail tests to `settingsDetail`, and update the remaining positive contracts to their current authoritative schemas and tool declaration.

### Root cause F: expansion-sensitive integration budgets

- Default payload provisioning now installs 45 packages. In clean Windows evidence, real runtime/database ownership handoffs took 37–47 seconds, project-directory integration cases took 26–29 seconds, a Session loop case took 28–31 seconds, and a scheduled wake case took 35 seconds. Their old 20- or 30-second budgets caused the first timeout and then cascading ownership failures.
- Repair boundary: raise only those measured integration-test budgets to 90 seconds. Assertions, cleanup, inactivity monitoring, and failure behavior remain unchanged.

### Root cause G: platform-specific crash simulation

- The first proof push moved generated artifacts, typecheck, security, and all non-unit test jobs to success, then Linux exposed one stale-owner test defect: `child.kill()` sends SIGTERM, allowing the Linux fixture to perform normal owner-file cleanup before the test asserted crash residue. Windows termination had left the evidence behind, so the source-frozen Windows pass did not cover this signal difference.
- Repair boundary: send SIGKILL for the one test that explicitly models an unclean crash. The existing assertions still require owner/lock residue, rewrite only the recorded PID/process identity, and prove that a successor acquires ownership.

### Why prior paths did not root-fix it

- The earlier clean-runner repair added an opt-in SDK primitive and enabled it for then-known direct consumers, but later generator call graphs were not added to the contract, so two workflows silently drifted.
- The later test speed-up changed the process model without validating the preload/database ownership invariant on a clean runner.
- Retrying, deleting red runs, or changing the required-job aggregator would hide symptoms but leave both first failures unchanged.

### Impact and exclusions

- Affects ordinary push and pull-request verification in `generated-artifacts`, `typecheck`, and all three OpenCorvus unit-matrix rows.
- Does not affect Security, the successful SDK-prepared build/channel/overlay jobs, or CodeQL's source analysis.
- Does not authorize changing release triggers, deploying, tagging, publishing a Release, or changing product runtime behavior.

## Implementation plan

1. Enable `prepare_sdk: "true"` in `generate.yml` and `typecheck.yml`.
2. Replace the unsupported Bun parallel mode with the repository-owned per-file, preload-aware isolated runner under the existing inactivity monitor.
3. Add focused positive tests for runner parsing/discovery and extend the workflow contract to cover both generator workflows and the canonical test command.
4. Update the stale checkout inventory contract to preserve the deployment workflow's two immutable action pins.
5. Validate workflow YAML, the focused contract, an isolated clean SDK/generator path, a focused preload-dependent test, and relevant package type checks.
6. Obtain an independent read-only review, resolve every valid finding, commit only owned hunks, and push.
7. Wait for all workflows triggered by the repair push to reach terminal success. Enumerate repository Actions runs, delete every run older than that green proof run, and verify the remaining state.

## Verification record

- Workflow YAML: checksum-verified `actionlint` 1.7.12 completed with exit code 0.
- Focused contracts: `script/github-actions-workflow-contract.test.ts` passed 4/4; `packages/opencorvus/script/run-test-files.test.ts` passed 3/3. The runner harness starts real pass/fail Bun test files, proves each receives a distinct repository preload root, proves execution continues after failure, and verifies aggregated failure paths, child stdout/stderr forwarding, CLI summary, and exit code 1.
- Source-frozen clean snapshot at the current main tree plus only this task's patch:
  - SDK build and repository generation completed; `generated-artifacts.ts --check-clean-worktree` reported no drift.
  - API documentation check passed with 329 operations in 25 groups.
  - Turbo typecheck passed all eight participating package tasks.
  - The first complete isolated run found two measured 30-second budget failures. Both files passed alone, their three affected budgets were raised to 90 seconds, and the complete suite was repeated.
  - Final OpenCorvus suite: all 136 discovered test files passed in isolated Bun processes; Turbo reported 3/3 successful tasks in 11 minutes 30 seconds.
- Independent review must remain clear after every repair. Final acceptance requires a later proof push with every triggered workflow successful before any historical Actions run is deleted.
