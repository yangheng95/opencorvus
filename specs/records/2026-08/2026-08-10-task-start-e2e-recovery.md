# Task start end-to-end recovery

## Recall

| Item | Record |
| --- | --- |
| User request | A newly created Mission Task is active but has no visible Agent Session topology, execution occurrence, or Goal. Diagnose and repair it, then run an end-to-end test and report only after the full chain passes. |
| Exact failing Task | `tsk_g019fe9bd84a2000000000000vCRzRHCiNLxK00`, project `D:\myhexin-local\demos\long-absa-task`, created `2026-08-10T03:35:39Z`. |
| Input | A real HTTP Mission wake against a separately started backend and isolated Git fixture that instructs Mission to create one small Task. |
| Required output | The wake creates a Mission and Task; the Task has a root Session and orchestrator Session; the orchestrator persists a user/assistant Turn; at least one execution occurrence or Goal becomes visible; Task activity advances beyond creation; Task-owned runtime files remain beneath `.opencorvus/.r/tasks/<full-task-id>`; unrelated catalog and Task projection requests complete while the Task runs. |
| Environment | Start the repository backend on loopback with an isolated `OPENCORVUS_HOME` and isolated Git project. Copy the existing local `auth.json` and `models.json` into that disposable runtime without printing or recording credentials. Record only non-secret IDs, statuses, timestamps, paths, output bytes, and package digests in this record. |
| Timeout | Inactivity timeout, not wall-clock timeout: reset whenever a new HTTP response, Task event, Session message/part, occurrence, Goal, or runtime file appears. Fail after 120 seconds without any such activity during Task startup; cancellation settlement has its own 30-second bound. |
| Acceptance | All required output contracts pass; no request hangs or returns 5xx; the completed Task replays correctly after stopping the source backend and starting the packaged sidecar against the same isolated runtime; focused non-UI tests, typecheck, documentation checks, and package checks pass; independent read-only review has no unresolved findings. |
| Hard constraints | Use a real backend/HTTP route rather than an in-process-only fixture for final acceptance. Do not touch or restart the user's active app/process. Do not use UI automation. Do not add fallback, dual layout, synthetic messages, or host workflow gates. Preserve full per-Task runtime isolation. |
| Sources read | `AGENTS.md`; `benchmark-debug-template`; `2026-08-10-task-runtime-directory-isolation.md`; `2026-08-10-task-file-replay-and-recovery-repackage.md`; `2026-08-09-mission-random-port-e2e-loop.md`; production log `2026-08-10T033122-5872-1.log`; the live runtime Task log; the read-only runtime DB rows; `project/instance.ts`; `project/independent-project-owner.ts`; `orchestrator/agent.ts`; `orchestrator/loop.ts`; `task-artifact/recovery.ts`; existing Mission E2E scripts. |
| Repository search | The existing `mission-e2e.ts` runs Session internals and explicitly forbids Task dispatch, so it cannot accept this failure. The real routes and durable tables already expose Mission wake, Task, Session, Part, occurrence, Goal, and runtime evidence. `provideInitializedProjectExecution` is the boundary immediately after the observed `orchestrator starting` log and before the missing orchestrator message. |
| Independent agent feedback | The first review found a reentrant double-disposal case and package-evidence overstatement. The second found the failing reentrant-reset intersection. The implementation, positive tests, and evidence boundaries were corrected after each review. Final independent review found no unresolved issue. |

## Captured failure evidence

- Task creation and Task root writes succeeded: `intent/request.md`, `logs/events.ndjson`, and `logs/timeline.log` exist under the full Task ID root.
- The DB contains the Task root Session and an orchestrator child Session created at `03:35:41.251Z`.
- Both Task Sessions have zero Message and zero Part rows. The Task has no completion/error and its event log contains only `task.created` and `task.updated(active)`.
- The last Task-side log is `orchestrator starting` at `03:35:41.446Z`; no `orchestrator finished` or decision error follows.
- The Mission Session continues model turns while project-scoped catalog, browser-preview, Session config, and work-ledger selection requests accumulate without completion and surface `signal timed out`.
- Bootstrap also reports existing Engine Artifact rows whose old runtime resources are absent as corruption. That is a separate recovery-contract defect and must not be confused with the startup hang.

## Debug loop

1. Build a reusable real-server Task-start checker with structural evidence and inactivity semantics.
2. Reproduce the zero-message orchestrator stall in an isolated environment or reduce it to the exact ownership/lock boundary with production primitives.
3. Repair a demonstrated lifecycle/ownership root cause if the isolated benchmark reproduces one; otherwise preserve the evidence boundary and verify the existing durable-wake recovery contract.
4. Run focused positive tests, then the real HTTP checker until every acceptance metric passes.
5. Perform self-review and mandatory independent read-only review; fix findings and rerun before packaging and delivery.

## Root-cause boundary and recovery

- The captured process stopped after creating the orchestrator Session and logging `orchestrator starting`, before the first Message, Part, execution occurrence, or Goal. Its durable `queued_operator_wake` remains pending, so current bootstrap recovery can resume it when that project is deliberately opened by the rebuilt application.
- The same production process had already experienced a Git `HEAD` watcher termination after the repository disappeared. Project-scoped requests later timed out while global health remained available. This proves a project-instance lifecycle failure, but the retained evidence does not identify a narrower lock or function as the unique cause.
- The current source and rebuilt payload did not reproduce the startup stall in a clean isolated runtime. Recovery relies on the already-delivered watcher lifecycle repair, durable wake draining, and per-Task runtime isolation.
- The final focused recovery run did expose a separate deterministic shutdown defect: `State.dispose` marked every project state entry as disposing in parallel, while the Question and Permission disposers must publish their real `abandoned` events through the project Bus. The Bus was therefore unavailable during its dependents' disposal. State entries now unwind sequentially in reverse initialization order, and a disposer may read an existing dependency that has not begun disposal; creating new state and reading an entry already being disposed remain rejected.
- The failing Task was created before the MSI and NSIS rebuilds completed. The installed runtime payload therefore was not the newly rebuilt installer payload verified below.

## Real HTTP source baseline

- Isolated runtime/project root: `C:\Users\hengu\AppData\Local\Temp\opencorvus-task-e2e-20260810-1` (removed after verification).
- Source backend: `http://127.0.0.1:17880`.
- Mission wake created Mission `c1498822d65b1f0c`, Mission Session `ses_-fe6016315626ffffffffffffTxl7mNxB2f3IzD`, and Task `tsk_g019fe9cf99d6000000000000G54XH70VPOiR5I`.
- The Task created root Session `ses_-fe6016306528ffffffffffffIstnK7WmJElES6`, orchestrator Session `ses_-fe6016305e1bffffffffffffb5I2QcmW65m4pb`, and researcher, planner, developer, and tester Sessions.
- The Task reached public status `inactive`, lifecycle status `completed`, and completion time `2026-08-10T04:07:00.929Z`. All five latest execution occurrences were terminal `completed`.
- The developer created `RESULT.md`; the exact bytes were `45 32 45 5f 4f 4b 0a`, which decodes to `E2E_OK\n`.
- The Task-owned root existed at `.opencorvus/.r/tasks/tsk_g019fe9cf99d6000000000000G54XH70VPOiR5I`. Post-completion `/expert-squad/catalog` and `/chat/capability` requests both returned HTTP 200.
- An initial isolation attempt used the wrong environment variable and wrote one Mission without a Task into the regular runtime database. The exact Mission `cae1ba6b24720a0e` was deleted through the Mission API with cancellation provenance while the server was scoped only to the disposable project. The failing production Task was not opened or mutated. Opening that project against the unrelated regular database correctly removed the source-baseline Task Artifact root as unreferenced, so this first sample is not used as final package Artifact-replay evidence.

## Final rebuilt-package end-to-end verification

- A second clean isolated runtime/project at `C:\Users\hengu\AppData\Local\Temp\opencorvus-task-e2e-20260810-2` ran directly on the newly built sidecar version `0.0.0-main-202608100424` at `http://127.0.0.1:17883`.
- Mission `66e8b1cbfee56787` created exactly one Task `tsk_g019fe9f51eb0000000000000WxXmYCzPfCSajE`, root Session `ses_-fe60160ae050ffffffffffff8BDSSTmd9V0B6E`, and orchestrator Session `ses_-fe60160ada0dffffffffffffb7wWk4H1pzsF28`.
- The fixed Base workflow created researcher `ses_-fe60160aa98efffffffffffftu7r6tD167hZU2`, planner `ses_-fe6016098fafffffffffffffsZXPcKLDFwN7Ja`, developer `ses_-fe601607e0ddffffffffffffMkrgY2VKEVPSkV`, and tester `ses_-fe601605e7daffffffffffffvvpKGGiF96RlEy`. The Mission status projection reported five execution occurrences and all Task activity inactive after completion.
- The Task completed at `2026-08-10T04:44:20.714Z`. `RESULT.md` and its durable Task Artifact both contained exact bytes `46 49 4e 41 4c 5f 45 32 45 5f 4f 4b 0a` (`FINAL_E2E_OK\n`).
- The Task root contained six Artifact files. Completion Decision selected `resources/0000/RESULT.md`, 13 bytes, SHA-256 `b649131917f7bda75da13c76f2639a44e5512abf8e72c2439eb24e350ee4b5d7`.
- After stopping and restarting the same newly built sidecar, project bootstrap accepted the Artifact catalog without a corruption diagnostic. The Task replayed as `completed`; the selected Artifact existed, its bytes and digest matched Completion Decision, and `/expert-squad/catalog` plus `/chat/capability` returned HTTP 200.
- The resumed Mission completely read the canonical completed Task evidence, created no additional Task, and reached `inactive` with zero running activity. Final shutdown had no State/Bus disposal error.

## Package evidence

| Artifact | Size (bytes) | SHA-256 |
| --- | ---: | --- |
| `packages/opencorvus/dist/opencorvus-overlay-server-windows-x64/opencorvus.exe` | 154,296,320 | `FD77605A8CDAC7E1E02982B710973E0847762941842EE9EE2555FDECD180743E` |
| `packages/overlay/src-tauri/target/release/bundle/msi/OpenCorvus_0.0.38-beta_x64_en-US.msi` | 187,568,128 | `55B52D942EE9D1FE4CF3D8355080FD1905C71B0CCC3E70AA4046C1E52268389B` |
| `packages/overlay/src-tauri/target/release/bundle/nsis/OpenCorvus_0.0.38-beta_x64-setup.exe` | 186,458,362 | `10D03A343D656B3D941760377DB2822FF4DD93A81BC2EBC265432E6A4AF1890B` |

## Verification ledger

| Check | Result |
| --- | --- |
| Real source-backend Mission → Task → expert workflow → file verification | Passed |
| Final packaged Mission → Task → four experts → durable Artifact → Mission completion | Passed |
| Packaged sidecar restart and durable completed-Task/Artifact replay | Passed |
| Focused Task recovery/runtime isolation/watcher/state-disposal tests | Passed: 15 tests, 53 assertions |
| Package-local test | Passed: 1 test, 2 assertions |
| OpenCorvus typecheck and documentation checks | Passed |
| Independent read-only review | Passed after two fix/re-review cycles; no unresolved finding |

## Follow-up: non-Git to Git refresh lock

### Recall

| Item | Record |
| --- | --- |
| User request | Diagnose why Task `tsk_g019fea125899000000000000J9GV1xoNAPUe46` has no loadable messages, then fix it without expanding the blast radius. |
| Observed input | A long-running Mission Session in `D:\myhexin-local\demos\long-absa-task` executes `git init`, then creates a Task through the normal Mission control plane. |
| Required output | The project refresh completes; a peer initialized project call completes while the original long-lived lease remains active; the Task orchestrator can persist its first Message/Part; project capability/config/catalog reads remain available. |
| Timeout | The focused lock benchmark must complete the peer initialized call within one second while the original lease is deliberately retained. Real Task startup keeps the existing 120-second inactivity timeout. |
| Acceptance | The focused non-Git → Git refresh test observes preflight under both the old non-Git and new Git contexts, two initializer executions, and a completed peer call; existing State, watcher, Task recovery, runtime-isolation, typecheck, documentation, and package-local checks remain green; final independent review has no unresolved finding. |
| Scope constraint | Change only project-instance refresh bookkeeping and its focused positive test. Do not change Mission orchestration, Task/session protocols, durable data, UI, watcher policy, or add fallback behavior. |
| Evidence read | Production log `2026-08-10T050347-24148-1.log`; read-only runtime DB rows for the exact Task and Sessions; `project/instance.ts`; `project/bootstrap.ts`; `conversation/capability-transaction.ts`; `skill/reference-lock.ts`; existing lifecycle and watcher tests. |
| Repository search | `capabilityPreflights` is owned only by `project/instance.ts`. Both external and inherited initialized entry paths populate it before context preparation. The refresh branch alone discards the set immediately before rerunning the same `refreshInitializers`, leaving their completed preflight fact absent after a successful bootstrap. |
| Independent agent feedback | First review rejected retention of the old context's preflight as stale authority. The implementation now revalidates under the new context without reacquiring the instance lock. The second review found the code and test clean and requested this verification-ledger update. Final review checked the complete diff, current artifacts, and isolated packaged run and found no unresolved issue. |

### Failure evidence and root cause

- The running sidecar hash is the newly built `24D200B573A36EDDF9B24AA4A6350A269FC41C2889C9066BD9D43966AA7A3D32`; this is not an old-installation mismatch.
- At `05:07:34.119Z` the Mission executes `git init`. The project changes from non-Git to Git, disposes State, and successfully reruns bootstrap.
- Task `tsk_g019fea125899000000000000J9GV1xoNAPUe46` reaches `orchestrator starting` at `05:08:20.509Z`. Its root and orchestrator Sessions both remain at zero Messages and zero Parts.
- Project-backed Session config, file, browser-preview, expert-squad, mission-skill, and chat-capability requests then wait or time out, while DB-only conversation/board and global health requests continue returning HTTP 200.
- `prepareContextExclusive` clears `entry.capabilityPreflights` during the successful Git-identity refresh and reruns the same initializers without validating their capability references under the new context. A peer initialized call therefore requests a write-locked preflight while the long-running Mission still holds its valid read lease. Writer preference queues subsequent project reads behind that impossible upgrade, producing the visible message-loading outage.

### Minimal repair design

1. Extract the existing capability-reference validation body from the helper that separately acquires an instance write lease.
2. During refresh, retain the already-upgraded instance write lease, switch to the new project context, rerun each refresh initializer's preflight under the canonical Skill and conversation reference-read locks, then bootstrap.
3. Add one production-primitive test that observes preflight under both non-Git and Git contexts, holds the original lease open, and requires a peer initialized call to complete concurrently.
4. Do not alter lock scheduling, Session lifetime, watcher handling, Mission behavior, or durable recovery.

### Implementation and verification

- `runCapabilityPreflight` is the single implementation for Skill/conversation reference locking, preflight execution, and completion bookkeeping. The ordinary external path still acquires its instance write lease before calling it.
- The refresh path clears old preflight authority, applies the new Project context, calls the same helper while it already owns the upgraded write lease, and only then reruns bootstrap. It neither recursively acquires the instance lock nor accepts the old context's validation.
- The focused production-primitive benchmark observed preflight Git contexts `[false, true]`, two initializer runs, and `peer-ready` before releasing the original long-lived lease. The initial implementation reliably timed out at the peer boundary before the repair.

### Isolated current-package replay

- The newly rebuilt sidecar version `0.0.0-main-202608100529` ran on `http://127.0.0.1:17884` with an isolated `OPENCORVUS_HOME`, copied local authentication/model inputs, and a brand-new non-Git project. `/global/health` reported the isolated database under that disposable runtime root.
- Real Mission `c928a7045203bcc9`, Session `ses_-fe6015d11715ffffffffffffy76YMEbiHU3MX2`, executed `git init` and then created exactly one Task `tsk_g019fea30601d000000000000JFLwBxLRD14O01` through `manage_task`.
- The Task root Session was `ses_-fe6015cf9f08ffffffffffff50T5UaXePPCT7a`; orchestrator Session `ses_-fe6015cf9962ffffffffffff6drG3kmQ6pErs5` persisted its user and assistant Messages and a streaming execution occurrence while the Mission remained active. This is the exact boundary missing in the production failure.
- During that retained Mission activity, the root Session config, Expert Squad catalog, Mission Skill catalog, and chat capability routes returned HTTP 200 in 3-132 ms. No project-backed request timed out or returned 5xx.
- The fixed Base chain created researcher, planner, developer, and tester Sessions. The Task completed normally with five terminal execution occurrences; the Mission then became inactive with zero running activity.
- `REFRESH_E2E_OK.txt` contained exactly 15 bytes `52 45 46 52 45 53 48 5f 45 32 45 5f 4f 4b 0a`; SHA-256 was `6FE7B29F10869FEDC9B238AF272E0F96CD7E6BEE523D1BB015CE950F3496E51B`.
- The full Task ID root existed at `.opencorvus/.r/tasks/tsk_g019fea30601d000000000000JFLwBxLRD14O01` with nine Task runtime files. The isolated server shut down gracefully; its disposable runtime, copied credentials, and project were moved to the Recycle Bin after verification. The user's running server on port 7878 was not opened, restarted, or modified.

| Follow-up check | Result |
| --- | --- |
| non-Git → Git refresh lock benchmark | Passed: 1 test, 1 composite assertion |
| Task recovery/runtime isolation/watcher/state-disposal focused regression | Passed: 16 tests, 54 assertions across 7 files |
| OpenCorvus typecheck | Passed |
| Documentation check | Passed: 322 operations, 25 groups |
| Package-local contract | Passed: 1 test, 2 assertions |
| `git diff --check` | Passed |
| Current packaged non-Git → `git init` → Task first Message/Part | Passed: real Mission and Task; first orchestrator user/assistant Messages and streaming occurrence persisted while Mission remained active |
| Current packaged full Base Task chain | Passed: five terminal occurrences, exact 15-byte deliverable, Task completed, Mission inactive |
| Current packaged project-read availability | Passed: Session config, Expert Squad, Mission Skill, and chat capability returned HTTP 200 in 3-132 ms |
| Independent read-only review | Passed: complete diff, current package evidence, and isolated packaged replay reviewed with no unresolved finding |

## Follow-up: Git initialization request settlement during Mission selection

### Recall

| Item | Record |
| --- | --- |
| User request | Diagnose why the selected Mission's message panel stayed empty, then correct the behavior after confirming that the UI had abandoned the selection on timeout. |
| Exact failing Session | Mission Session `ses_-fe60134f5200ffffffffffffNblvG8DlV2Ezdn` in `D:\myhexin-local\demos\long-absa-task`; Chat Debug Info generated at `2026-08-10T17:23:05Z` showed the selected Session identity but no hydrated board fields or cards. |
| Acceptance | A project Git initialization request uses the existing server-settled mutation contract; a directory switch waits for the authoritative `POST /project/current/init-git` response and can then continue to Session hydration even when settlement exceeds the ordinary request timeout; focused positive service tests and Overlay typecheck pass. |
| Hard constraints | Do not restart or manipulate the user's running application. Do not add retry, fallback, dual state, synthetic messages, a longer arbitrary timeout, or UI automation. Preserve selection-epoch supersession and the single canonical Git initialization endpoint. Preserve unrelated dirty-worktree changes. |
| Sources read | `AGENTS.md`; this Task-start recovery record and its non-Git-to-Git refresh follow-up; production sidecar log `2026-08-10T171642-21848-1.log`; read-only runtime DB rows; live read-only Session conversation response; `overlay/services/api.ts`; `host-transport.ts`; `project-git.ts`; `workspace.ts`; `conversation.ts`; `main.tsx`; `server/routes/project.ts`; `project/project.ts`; focused Git initialization and server-settled request tests. |
| Repository search | `initializeProjectDirectoryGit` is the only Overlay service that calls `POST /project/current/init-git`; startup, directory switching, and the manual Git action all reuse it. `serverSettledRequest` is the existing single contract for mutations whose truthful boundary is the server response. The server route returns only after `Project.initGit` and the required active-project refresh or disposal. |
| Independent agent feedback | The first review found that the Git initialization service could not accept an explicit caller abort signal and that the initial focused test covered only request metadata. The service and directory-switch option now propagate explicit caller cancellation, Chat selection passes its existing signal, and tests cover an actually pending request plus explicit abort. Two read-only re-reviews found no unresolved issue. |

### Failure analysis

- Observable failure: the selected source was visible, but `chat.title`, `chat.status`, and `chat.directory` were unset and the card tree contained zero cards.
- Direct trigger: selecting the Mission switched to a non-Git project while automatic Git initialization was enabled. `applyDirectory` awaited `initializeProjectDirectoryGit` before loading the Session conversation.
- Data and control-flow root cause: the Overlay transport applied its ordinary 15-second timeout to `POST /project/current/init-git`. The server correctly continued the idempotent mutation and project refresh after the client stopped waiting. The selection therefore failed before `loadConversation` could commit the board and message projection.
- Production evidence: the Git initialization request started at `17:22:43.959Z` and returned HTTP 200 after 38,946 ms. Project-backed reads queued behind the refresh for roughly 24 seconds; the Overlay recorded `work-ledger.select-mission: signal timed out` at `17:23:13.992Z` and again at `17:23:18.466Z`. A later Session conversation request returned HTTP 200 in 23 ms.
- Data integrity evidence: the Session remained present with 12 Message rows and 61 Part rows, and its conversation route returned a valid 130,893-byte payload. The blank panel was not data loss.
- Why the old path did not recover: the timeout was only a client-side observation boundary. It neither cancelled nor rolled back the server mutation, and the selection path had no authoritative response from which to continue. Retrying the whole selection would be a second workflow path and is not the root fix.
- Scope exclusions: conversation projection, persisted Session/Message/Part schemas, server Git initialization semantics, project lock scheduling, and UI rendering are already producing valid results and are not changed. The separate Task Artifact recovery warning in the same log is unrelated.

### Repair design and verification plan

1. Bind `initializeProjectDirectoryGit` to `serverSettledRequest`, so the canonical service waits for the server response while still honoring any future explicit caller signal.
2. Extend the focused Git initialization service test to assert the server-settled transport contract together with the existing method, route, directory, and response assertions.
3. Run only the focused non-UI service tests, Overlay typecheck, documentation check required by the repository, and diff hygiene checks.
4. Obtain mandatory independent read-only review of the complete diff and evidence; resolve every valid finding and rerun affected checks before commit.

### Implementation and verification

- `initializeProjectDirectoryGit` now wraps its canonical POST request with `serverSettledRequest`. The route, explicit directory identity, and response contract remain unchanged; the transport settlement boundary changes from the ordinary 15-second timeout to the authoritative server response or an explicit caller abort.
- `ApplyDirectoryOptions` now carries an optional caller-owned signal into Git initialization. Coding Chat selection propagates its existing activation signal. Mission, Task, startup, and manual project switching remain server-settled because they do not invent wall-clock or selection-epoch cancellation for a server mutation that has already started.
- The focused service test verifies that startup and manual Git initialization send `timeoutMilliseconds: null` together with the canonical method, path, and directory, and that direct callers can preserve an explicit abort reason. Existing transport tests verify that a server-settled request stays pending without allocating a timer and settles on explicit caller abort.
- Focused non-UI tests passed: 9 tests, 41 assertions across `git-init-current.test.ts`, `server-settled-request.test.ts`, and `tauri-transport-error-body.test.ts`.
- Overlay typecheck passed with `tsc --noEmit`.
- Documentation check passed with 329 operations across 25 groups.
- Scoped `git diff --check` passed. No UI source or UI automation was added, modified, or run.
- Independent read-only review: passed after the explicit-cancellation finding was resolved and the pending-request test was strengthened; final review found no unresolved issue.
