# Backend recovery readiness convergence

## Recall

### User request and acceptance

- Diagnose why the backend failed to start after restart, why the task stopped previously, and how the restart made the desktop client appear frozen.
- Repair the root cause and rebuild the Windows desktop package.
- Acceptance is a positive ordering contract: after process-local physical recovery has completed, a real listener serves `/global/health` while a deliberately held Task/Mission/Session application-recovery promise is still running; releasing that promise completes the same owned recovery receipt. The packaged Windows desktop artifacts must then be rebuilt from the repaired source.

### Observable evidence

- The affected database opened and applied its schema in under one second. The current backend also serves `/global/health`; database corruption or lock failure is therefore excluded as the startup cause.
- The previous Task execution first encountered a Windows Git indexing failure for a reserved `NUL` path. A later Tauri-managed restart recorded process-owned Session interruption and a Task process-recovery handoff. This explains why the original execution stopped, but it is not the listener-readiness failure.
- On the next start, Mission recovery reopened the Task and entered a streamed Orchestrator Turn before port `7878` was bound. The desktop supervisor waits 30 seconds for health, so it reported startup failure while the backend was still doing model work.
- A subsequent restart bound quickly only because the prior Task activation lease was still live. After lease expiry, recovery surfaced the uncertain external-operation result as a pending Interaction. The apparent current "freeze" is therefore a logical wait for operator confirmation, not a dead database.

### Root-cause and impact analysis

1. Direct trigger: `listenWithRecoveredServerRuntime` awaits `prepareServerRuntimeAfterRecovery`; that function awaits `input.recover()`, and only then calls `Server.listenPrepared`.
2. Control-flow root cause: the startup barrier combines bounded process-local integrity work with unbounded application convergence. Task, Mission, and Session recovery may legitimately include multiple streamed Provider/Tool steps, so listener readiness inherits model latency and external-tool latency.
3. Data-flow root cause: the returned `recovery` promise looks independently owned, and `serve.ts` stores it for shutdown/restart settlement, but the promise is already settled before the caller receives it. The API therefore exposes two lifecycle phases while implementing only one blocking phase.
4. Why the old path did not cure it: shared-database restoration deliberately retained recovery-before-bind. Concurrent Task reconciliation reduced serial delay but still allowed one full Orchestrator Turn to hold project initialization and therefore the global startup barrier.
5. Client impact: the desktop supervisor cannot distinguish "listener not published" from a dead backend; after 30 seconds it marks startup failed even though recovery can continue consuming CPU, memory, Provider streams, and tools. Repeated restart can interrupt that recovery again and create additional uncertain-operation reconciliation.
6. Shared-mechanism audit: the same server-runtime entry is used for initial serve and listener restoration. Host recovery covers every started Task directory, Mission process-recovery candidate, and pending Scheduler project. Normal, terminal, retry, restart, multi-project, and shared-database ownership remain governed by durable facts and leases; none requires a model Turn to finish before the health transport exists. ACP binds through the same ordering but explicitly awaits application recovery before returning its usable server. Project-local bootstrap still awaits its own reconciliation, which can delay an individual project-scoped request, but no longer blocks global listener/health publication; host recovery initializes affected projects concurrently, and the global Scheduler poller starts immediately after bind so one held project cannot suppress every other project's retry owner.

### Hard constraints and exclusions

- Initial investigation and validation did not restart, stop, refresh, or reuse the user's live desktop process. During packaging, the user later explicitly authorized killing the exact stuck client; PID 40968 at the verified repository Overlay path was stopped, while backend PID 30440 was preserved. All server validation otherwise uses isolated data and operating-system-assigned ports.
- Keep one recovery implementation: bounded physical recovery is the pre-listener barrier; durable application recovery is the returned owned promise started immediately after bind. No fallback listener or compatibility route is introduced.
- All Large Language Model interactions remain streamed. No prompt, routing gate, synthesized message, or hidden state is added.
- No User Interface automation test is added or run. This repair changes backend lifecycle code only, so UI screenshot acceptance is not applicable.
- Preserve unrelated and overlapping dirty-worktree changes. The implementation must patch only the server-runtime contract, its focused positive test, current architecture/spec records, and packaging outputs generated by the existing packager.
- The user's desktop executable originally occupied the default Cargo target and held its image open. After the user explicitly authorized stopping that exact stuck client, packaging still uses an explicitly configured isolated `CARGO_TARGET_DIR` so build ownership is deterministic and independent of the default target.

### Materials read and full-repository search

- Read `packages/opencorvus/src/cli/server-runtime.ts`, both initial and restart callers in `cli/cmd/serve.ts`, `engine/host-recovery.ts`, Mission wake recovery, Project Instance/independent-owner lifecycle, Task-control reconciliation, the global health route, desktop 30-second readiness supervisor, packaging scripts, current Task-control architecture, and the previous shared-database startup record.
- Searched all definitions and calls of listener preparation, recovery promises, project bootstrap reconciliation, independent project re-entry, Task-control scans, health routes, runtime settlement, and Windows packaging outputs.
- Existing focused startup tests assert the obsolete recovery-before-bind order and pre-listener cleanup behavior. They must be replaced with positive listener-ready/application-recovery-owned and foundational-recovery-failure contracts.

### Benchmark definition

- Task: start the production listener lifecycle with a controlled application-recovery promise that reports `started`, remains held, and later reports `completed`.
- Inputs: an isolated runtime home, an operating-system-assigned loopback port, real `Server.listenPrepared`, and injected bounded observers for process/workspace recovery ordering.
- Outputs: HTTP 200 from the real `/global/health` route with `healthy: true` while recovery state is `started`; after release, the exact returned recovery promise resolves to `completed`.
- Environment: Windows-compatible Bun test runner, no user database, no credentials, no live desktop process.
- Inactivity timeout: each readiness/recovery checkpoint is bounded to five seconds; the test's outer safety limit is 60 seconds.
- Acceptance: foundational recovery precedes bind; bind precedes application recovery completion; health succeeds during the held recovery; recovery completion remains awaitable; foundational failure publishes no listener and performs runtime cleanup.

### Independent agent feedback

- None before implementation.
- The first mandatory read-only review found five valid shared-lifecycle issues: shutdown joined recovery before requesting the cancellation that could release it; project recovery was sequential and global Scheduler polling waited behind the whole pass; two real checkers leaked their newly bound listener on recovery failure; ACP/client-stop facts in this record were contradictory; and relative Cargo targets resolved against different working directories.
- Corrections now start runtime settlement before joining recovery, recover project directories concurrently, initialize the durable global Scheduler poller immediately after bind, centralize recovery-required listener cleanup, record the later client-stop authorization, and project one repository-root-resolved absolute Cargo target into both local packaging subprocesses. Focused positive tests cover held-recovery cancellation, held-project sibling progress, listener health/poller ordering, and relative packaging target projection. A second independent review is required after these corrections.
- The second mandatory read-only review found no P0/P1 issue and confirmed those corrections closed the original lifecycle failures. It identified missing positive proof that recovery-required callers close the published listener before propagating rejection, plus one stale evidence sentence. The final correction adds that contract and also closes the same post-bind cleanup boundary when Scheduler poller initialization fails. A final read-only review follows the correction.

## Implementation plan

1. Split server preparation into a bounded pre-listener foundation and an application-recovery promise that starts immediately after successful bind.
2. Make initial serve and restart restoration use the same lifecycle result; attach immediate failure observation without hiding rejection, and keep shutdown/restart settlement awaiting that exact promise.
3. Replace obsolete ordering tests with the benchmark contract and focused failure/cleanup coverage.
4. Update current architecture and this record, run focused non-UI tests, the real startup checker, typecheck, docs check and diff validation.
5. Build unsigned local Windows MSI/NSIS installers in an isolated Cargo target and record artifact hashes/sizes. Signed release-matrix packaging remains a release-authority operation because it requires the protected updater trust configuration.
6. Request mandatory independent read-only review, repair every valid finding, rerun affected checks, commit only task files, merge upstream, inspect outgoing commits, verify and push.

## Acceptance evidence

- Focused startup benchmark: `test/runtime-startup-recovery.test.ts` passed 11/11 with 20 assertions after review corrections. Its real loopback listener returned HTTP 200 and `healthy: true` while the controlled application recovery remained held, then the exact returned Promise completed after release. It also proves settlement cancels a held recovery before joining it, a ready sibling Project completes while another Project remains held, and recovery-required or post-bind-poller failure closes the published listener before error propagation. The same file proves foundational failure cleanup, post-bind recovery failure observability, ACP startup, restart occurrence projection, and graceful settlement receipts.
- Shared-database regression proof: `test/shared-database-multi-backend.test.ts` passed 1/1 with 11 assertions. Two independent backend processes remained healthy on one exact SQLite database, so listener-first application recovery did not recreate a database-wide owner or break Project fence recovery.
- Packaging toolchain proof: the first local package attempt identified the user's running default-target client, PID 40968, as the Windows image-lock owner. After explicit user authorization that exact client was stopped; backend PID 30440 was preserved. Both Overlay build paths now honor an explicit `CARGO_TARGET_DIR`, and `script/package-local.test.ts` passed 2/2 including the exact isolated-target projection.
- TypeScript typecheck passed across the repository. `docs:check` passed with 333 operations in 25 groups. `git diff --check` passed.
- The unsigned local Windows package completed from the final reviewed source in the isolated Cargo target `packages/overlay/src-tauri/target-codex-repaired`. Embedded backend `--version` returned `0.0.0-v0.0.45beta-202608161219`.
- MSI: `OpenCorvus_0.0.45-beta_x64_en-US.msi`, 190,255,104 bytes, SHA-256 `5A316F006D4AD8DFF339DA8159DA04D5A4E9AE34BEA26B2077F92CA1D682A0C8`.
- NSIS: `OpenCorvus_0.0.45-beta_x64-setup.exe`, 189,007,732 bytes, SHA-256 `B9BFD5F1D6A8F6E86E5623AAEC0471BCF4FD986D24557770E759BC88E6F37A67`.
- Bare Overlay executable: 199,671,808 bytes, SHA-256 `B06D7E01E926E8CFC08AF1F0D432BCC39760556F76A0EA78C6BE5D63C9739375`.
- Signed release-matrix packaging was intentionally not fabricated: its protected updater public key was absent. The repository's local packaging contract disables updater artifacts and produced both native installer formats without credentials.
