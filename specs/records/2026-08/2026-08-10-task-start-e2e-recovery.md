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
| `packages/opencorvus/dist/opencorvus-overlay-server-windows-x64/opencorvus.exe` | 154,295,808 | `24D200B573A36EDDF9B24AA4A6350A269FC41C2889C9066BD9D43966AA7A3D32` |
| `packages/overlay/src-tauri/target/release/bundle/msi/OpenCorvus_0.0.38-beta_x64_en-US.msi` | 187,576,320 | `74A317EAD93F40DC231871A8AC0D92BC21369F574DEEA43AA5583744A0ACE9F1` |
| `packages/overlay/src-tauri/target/release/bundle/nsis/OpenCorvus_0.0.38-beta_x64-setup.exe` | 186,461,585 | `DCA1150FBB42411866BC51A1F0505B2221B4EE001A549FA339D6D047C838328A` |

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
