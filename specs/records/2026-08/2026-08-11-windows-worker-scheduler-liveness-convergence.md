# Windows worker scheduler liveness convergence

Status: implementation, focused verification, and three-round independent stable-diff review complete; no unresolved P0/P1/P2 findings.

## Recall

| Item | Record |
| --- | --- |
| User request | Lead independent agents to audit every plausible OpenCorvus scheduling defect, mechanism failure, deadlock, state corruption, tangled control path, excessive gate, and resilience gap; analyze depth and blast radius before repairing and independently reviewing the complete result. |
| Triggering incident | Task `tsk_g00VRzIXqH00UWPUwrlX` remained `active` while its Orchestrator was `idle` and an Integrity Reviewer remained `streaming`. The exact `run_command` Tool Part `prt_g019ff1163242000000000000J5A8zhhrPg2DcM` declared `timeout_ms=10000` but remained `running`; its isolated Windows Python descendants survived after their parent exited and retained output/lifecycle resources. |
| Required output | One end-to-end physical and durable execution authority from worker/reviewer dispatch through Tool process spawn, timeout/abort, output settlement, lifecycle publication, root delivery, Orchestrator continuation, shutdown, and restart recovery. Proven defects must be repaired at their shared authority roots without fallbacks or a second scheduler. |
| Acceptance | A real Windows foreground command whose shell launches a long-lived Python descendant must reach a typed bounded Tool outcome, leave no owned descendant or output wait, terminalize the exact worker occurrence, and allow the same Task Orchestrator to continue. Background preview timeout must settle the same physical process tree. Restart must reconcile the exact interrupted occurrence once. Synthetic progress cannot substitute for real execution activity or keep a dead worker alive. |
| Hard constraints | Preserve streaming Large Language Model interaction and natural participant messages. Use one current fact source per execution occurrence. No hidden/synthetic completion, host workflow gate, compatibility path, dual read/write, process kill by unrelated PID, or timeout that abandons a still-owned writer. Do not mutate the operator's live Task database or kill its surviving processes without explicit authorization. Do not add, modify, or run User Interface automation. |
| Environment | Source and isolated test/runtime roots may be changed after analysis. The live runtime at `C:\Users\hengu\AppData\Local\opencorvus` and project `D:\myhexin-local\demos\long-absa-task` are read-only forensic sources. |
| Sources read | `AGENTS.md`; `specs/current/architecture/task-control-plane.md`; `task-runtime-directory.md`; prior scheduler systemic/liveness records; Windows Mission recovery and debug-truth records; current `integrity`, `agent`, `orchestrator`, `session`, `shell`, native process-supervisor, runtime-settlement, queue, shutdown, and recovery source/tests. |
| Whole-repository search | Completed across `run_command`, `browser_preview`, guarded commands, `Shell.run`/`launch`, `ProcessSupervisor`, Job Object flags, output settlement, worker progress, inactivity, lifecycle occurrence, Orchestrator wait/wake, process/runtime shutdown ownership, Task Queue progress attribution, Event/Automation leases, Instance disposal, review dispatch lineage, domain Artifact settlement, Visual Review registration, and restart recovery. |
| Independent agent feedback | Three independent read-only audits completed. Windows/process audit confirmed end-to-end timeout, Job containment, registry, durable reaper, request-secret, parent-death, and workspace lifecycle gaps. Reviewer audit confirmed domain Artifact settlement, exact dispatch identity, parallel Visual Review registration, and synthetic-progress gaps. Cross-scheduler audit confirmed Task Queue causal-progress pollution, Event/Automation progress-free lease renewal, ChildProcess control-error/physical-exit conflation, and unbounded Instance disposal. No audit agent modified source or tests. |
| Prior boundary correction | The previous systemic audit explicitly excluded Windows process-tree/resource-manager and isolated background-workspace cleanup. This incident proves that exclusion crossed the scheduler liveness boundary: an escaped child can retain output, prevent Tool settlement, keep a reviewer occurrence open, and indefinitely block Orchestrator completion. The new audit includes that physical layer. |

## Observed incident facts

- At `2026-08-11T13:49:25.735Z`, the Integrity Reviewer started a `browser_preview` on port `8011`; the Tool returned an error at `13:49:34.623Z`, but Python descendants `9920 -> 39036` remained alive and the latter retained the listener.
- At `13:49:51.554Z`, the same reviewer started a foreground `run_command` on port `8011` with a declared ten-second timeout.
- The exact isolated check workspace was created at `13:49:52Z`. Its Python descendants `40580 -> 22624` started at `13:52:35Z`; their parent `34872` later disappeared while both descendants remained alive.
- The Tool Part still has `status=running`, no end time, no output, and no failure. The owning assistant Message has no finish or completed timestamp.
- Production logs repeatedly record `output did not settle within 1000ms after disposal was requested` for leaked preview servers, including the same reviewer and port.
- The Integrity Reviewer's last real stream content was at `13:49:49Z`. A fixed ticker continued emitting `review.stream.progress` with `summary=integrity review running` every twenty seconds.
- The root Orchestrator's latest occurrence became `idle` at `13:54:35Z` while the Task remained active, all Goals remained unaccepted, and no cancellation or process incident existed.
- At least eighteen surviving Web-server processes from the project were observable. This record treats the exact count as a point-in-time observation, not a durable total.

## Initial root model

The direct trigger is a long-lived server invoked in foreground mode after a failed preview already retained the same port. That operator/model error should have produced a bounded typed failure; it is not sufficient as the platform root cause.

The current physical chain separates helper exit from descendant and output settlement, but `Shell.run` still contains an unbounded `await supervisor.outputSettled`. The Windows native Job sets both `KILL_ON_JOB_CLOSE` and `BREAKAWAY_OK`; the observed dead parent/live descendants are consistent with a child escaping the Job and retaining inherited output handles. The exact Job membership remains to be confirmed and is not yet recorded as fact.

The logical chain has no worker/reviewer inactivity authority that can terminalize or hand off the exact stalled occurrence. Its periodic progress event reports elapsed wall time rather than observed physical/model activity. The Orchestrator therefore waits on a logical occurrence whose underlying Tool can no longer settle.

## Analysis gates before implementation

For every proposed change, record:

1. observable symptom and exact persisted/runtime identities;
2. direct trigger and physical/data/control-flow root cause;
3. why existing timeout, cancellation, shutdown, restart, and tests did not converge it;
4. all definitions, callers, public contracts, process kinds, Task/Mission/reviewer surfaces, and cross-platform effects;
5. one authoritative state and recovery owner, with lock/lease ordering;
6. crash windows and successor-runtime behavior;
7. focused positive tests that prove current correct outcomes rather than absence of old calls.

Implementation begins only after the three audits are reconciled into one defect register and repair order.

## Frozen defect register

| Priority | Defect | Direct trigger | Root authority failure | Blast radius |
| --- | --- | --- | --- | --- |
| P0 | Guarded command timeout is not end-to-end and output drain is unbounded | A foreground server exceeds ten seconds after a multi-minute workspace copy; a descendant retains stdout/stderr | The deadline starts after setup, `exited` denotes helper/root exit rather than owned tree settlement, and `Shell.run` awaits `outputSettled` without a bound | Integrity commands, Shell callers, reviewer slots, Task terminalization, shutdown, disk cleanup |
| P1 | Managed Windows Job permits descendant escape | A target requests breakaway while inheriting stdio | `BREAKAWAY_OK` contradicts managed containment; helper waits only for the target root, not Job active-process zero | Ports, files, GPU writers, output pipes, restart successors |
| P1 | Process registry/control errors do not represent physical settlement | Helper/root exits or ChildProcess emits `error` while descendants still run | `liveHandles` and mandatory Task lease are released from `exited`; background cleanup failures have no durable owner | Cancellation can commit terminal state while writers remain; restart cannot discover them |
| P1 | Process/workspace/request cleanup is not crash durable | Runtime crashes or consumer never reaches `dispose` | Process, supervisor request, and isolated workspace ownership are process-local; request JSON also persists full environment values | Orphaned side effects, multi-GiB workspaces, credential exposure, restart conflict |
| P1 | Review dispatch success is derived from Session completion before domain delivery settles | Review Turn completes, then Artifact persistence fails | Session physical lifecycle and domain dispatch settlement are conflated; `partial` is discarded and workflow projection reads lifecycle | Integrity/Visual Review dependencies can advance on missing evidence |
| P1 | Integrity singleflight merges distinct dispatches | Two calls for the same Task/agent overlap | Process Map key omits exact tool call, tool part, input, Session, and continuation lineage | Tool result, cancellation authority, workflow occurrence, and recovery lineage diverge |
| P1 | Visual Review parallel tool registration has an await-before-register race | A dependent tool call runs while locator validation is pending | Per-call mutation is treated as ordered although provider tool calls are parallel | Valid coverage/evidence/finding facts fail nondeterministically |
| P1 | Task Queue progress is attributed from the full historical Session subtree | An old child streams while the current queue prompt is stuck | `time_updated` is refreshed without exact queue occurrence/input lineage | Permanent running rows, capacity loss, same-Session starvation |
| P1 | Event/Automation leases renew without real activity | A wake/preflight/target Promise never settles | Heartbeat proves owner liveness, not occurrence progress; downstream abort settlement is not the lease clock | Same-job tail poison, permanent running job, shutdown rollback loops |
| P2 | Instance disposal can wait forever without identity or cancellation | A tracked activity ignores shutdown | Global shutdown awaits unlabeled `closedSignal`/activity promises outside an inactivity authority | Fail-closed global shutdown outage and project starvation |
| P2 | Synthetic Review ticker/render cache reports false liveness | Review Tool stalls or terminal progress arrives late | Wall-clock ticker is independent of model/tool/durable activity; cache lacks terminal tombstone | Misleading operator state and memory retention; not itself a durable scheduler heartbeat |
| P1 | In-process CLI settlement waits on its own Project Instance lease | A CLI callback returns and starts process-wide settlement from inside `Instance.provide` | The new Instance settlement gate correctly waits for every lease, but the caller still owns the lease it asks the gate to drain | CLI completion/retry hangs, retained runtime ownership blocks later startup, and unrelated gate errors can mask the cycle |
| P1 | In-process CLI ownership rollback can lose its recovery authority | Ownership release fails and the subsequent runtime-gate rollback also rejects | A throwing `finally` replaces the operation error and skips `retainForRecovery`; the still-live owner is neither recoverable nor safely released | Same-process CLI startup is permanently poisoned, the original failure is hidden, and later runtimes remain blocked |

Observed values are never treated as absent or zero when unavailable. The incident proves the P0 end-to-end timeout failure. Exact Job membership of the historical descendant is unavailable; the breakaway mechanism remains a code-proven P1 capability and is tested prospectively rather than claimed as the sole historical cause.

## Single-authority repair order

1. Make managed Windows process containment and physical settlement truthful: no breakaway, Job active-process-zero proof, control errors separate from physical exit, registry and Task lease retained through settlement.
2. Introduce one absolute operation deadline from Tool entry through workspace preparation, spawn/readiness, execution, tree termination, bounded pipe drain, request cleanup, and workspace disposal. A short cleanup budget may outlive the user deadline, but cleanup failure remains an exact recoverable occurrence rather than an abandoned Promise.
3. Make process/request/workspace ownership restart-recoverable and remove environment secrets from request files. Managed execution, detached execution, and restart handoff remain distinct typed modes.
4. Make review dispatch occurrence the only domain-delivery settlement: exact lineage, physical Session terminal, Artifact persistence, and final outcome reconcile under one durable identity. Delete the broad Integrity Promise singleflight.
5. Make Visual Review parallel registration a turn-local fact collection followed by one graph validation/commit; delete synthetic ticker and terminate the render cache from canonical lifecycle.
6. Bind Task Queue progress to exact causal lineage; add real-activity inactivity authorities to Event/Automation only after their physical operations support abort-and-join.
7. Add labeled, cancellable, activity-resetting Instance disposal joins that remain fail-closed and preserve RuntimeServerOwnership on failure.

This order is dependency-sensitive: logical leases cannot safely expire until physical settlement is truthful, and workflow projection cannot be corrected by adding a second success state beside the existing lifecycle-derived path.

## Planned verification

- Native Windows positive test: a managed shell launches a real descendant that inherits output; timeout/abort produces one bounded result and all owned PIDs reach physical exit.
- `Shell.run` positive test: timeout covers the complete guarded operation and never waits indefinitely on output; output failure is surfaced as a typed result/error after bounded physical cleanup.
- Guarded-command positive test: isolated workspace setup, command execution, physical cleanup, and workspace disposal share one deadline/abort authority.
- Reviewer positive test: stalled Tool activity reaches a typed worker lifecycle outcome; elapsed-time ticker does not count as execution activity; the exact Orchestrator delivery resumes and produces a durable assistant anchor.
- Restart test: an interrupted worker Tool/assistant occurrence is reconciled once under the successor runtime without a replacement fact or duplicate command.
- Cross-scheduler focused tests for any additional independently confirmed lease, gate, lock, or recovery findings.
- `bun run typecheck`, `bun run docs:check`, relevant native checks, focused non-UI suites, and `git diff --check`.
- After the first green pass, a new uninvolved read-only agent reviews the complete stable diff and evidence; every valid finding is repaired and re-reviewed.

## Windows parent-death and orphan-artifact recovery design

### Impact analysis and current evidence

- Observable failure: a Node runtime can die after writing a Windows supervisor request or creating an isolated check workspace but before its process-local `dispose` runs. The native helper currently observes only target-root exit and the cancel file; isolated workspace ownership exists only in an in-memory `cleanupOwners` Map.
- Direct trigger: physical death of the runtime owner while a managed helper/Job or workspace is active. A normal exception is already covered by current `settled`/`dispose` paths and is not a restart-recovery trigger.
- Root cause: neither durable artifact carries the exact runtime owner PID, process-start fingerprint, and runtime occurrence. Consequently the helper cannot distinguish owner death from a live slow caller, and a successor cannot distinguish a prior orphan from current/live work.
- Existing timeout and shutdown do not close this window because both are executed by the dying process. `KILL_ON_JOB_CLOSE` covers helper death, but not parent death while the helper remains alive; workspace deletion has no out-of-process owner at all.
- Definitions and callers in scope: native `process-supervisor`, TypeScript `ProcessSupervisor` request creation/marker validation, `RuntimeServerOwnership` process-instance authority, isolated check-workspace create/dispose, and the shared server startup acquire/recover/bind entrypoint. Guarded commands consume these contracts but do not become a second recovery owner. Non-Windows process launch remains unchanged.
- Public contract impact: Windows request/ready/settlement protocols gain exact owner/runtime occurrence fields. Isolated workspace roots gain one strict owner record. No environment payload is reintroduced. Existing request and workspace layouts without this authority are unknown, remain untouched, and are not compatibility-read.

### Single fact source and ordering

1. `RuntimeServerOwnership` supplies the current process occurrence: exact PID, process-start fingerprint, and occurrence ID. A public runtime uses its acquired server occurrence; a non-server test/control process uses one process-lifetime occurrence with the same physical identity contract.
2. Every managed Windows request persists that occurrence. The helper opens the exact owner process while it is still the direct child, monitors the owner handle together with target/cancel, and on owner physical death terminates its Job (or exact detached target), waits for active-process zero, then atomically publishes the only settlement marker.
3. Every isolated workspace persists the same occurrence before copying source bytes. Normal disposal removes the whole root, including its owner record.
4. A successor first acquires `RuntimeServerOwnership`. Before Automation initialization, started-Task recovery, or listener bind, it scans only current supervisor-request and check-workspace roots. Current-occurrence artifacts are retained. A prior artifact is removable only when the recorded process-start fingerprint proves the owner process has died or the PID has been reused by another process.
5. Process-owner observation is tri-state. Exact live and unknown-live are retained. Unknown is never converted to dead. One startup recovery transaction shares a `(PID, process-start fingerprint)` observation cache across request and workspace scans, so many artifacts from one physical owner launch at most one Windows identity probe. No numeric PID is killed by successor recovery: it writes only the exact request's secret-bearing cancel file and accepts only that request's exact active-zero settlement marker.
6. Supervisor requests recover before workspaces so a workspace cannot be removed while an unresolved prior request may still use it as `cwd`. Every discovered `supervisor-*` or check-workspace directory counts as an artifact occurrence. Missing, malformed, foreign-layout, unreadable, or unconfirmed occurrences are retained and reported through typed aggregate recovery failures, preventing bind; there is no legacy fallback or second cleanup path. A registered project/worktree path that is physically absent yields an empty scan because there is no on-disk artifact to classify, while any non-`ENOENT` enumeration failure remains a typed unknown and blocks startup.

### Crash windows

- Owner dies before helper spawn/ready: successor writes the exact cancel authority and waits for the helper's exact marker; without a marker it preserves the request and startup fails closed.
- Owner dies after target spawn: helper's owner handle becomes signaled, so helper terminates the Job and proves active-zero without successor PID targeting.
- Helper dies before marker: Job close terminates managed members, but the successor still preserves the request because marker absence is not active-zero evidence.
- Owner dies during workspace copy: the strict owner record already exists; after supervisor reconciliation a successor may remove only that proven prior/dead occurrence root.
- PID reuse: a different process-start fingerprint proves the recorded owner occurrence ended but never authorizes terminating the reused PID.
- Current/live overlap: the acquired successor occurrence and every exact-live/unknown-live foreign occurrence are retained, preventing cleanup of current or unrelated work.

### Positive verification matrix

- Native Windows parent-death test: an owner process starts the helper and a descendant retaining a listener, then exits without cancellation; helper terminates the Job, publishes exact active-zero settlement, exits, and the port is reusable.
- Startup request recovery test: exact prior/dead request plus valid settlement is removed before recovery/bind; current-occurrence and exact-live request artifacts remain.
- Workspace recovery test: exact prior/dead workspace is removed after request reconciliation; current-occurrence and exact-live workspace roots remain.
- Startup ordering test: ownership acquisition precedes orphan recovery; orphan recovery precedes Automation/Task recovery and listener bind.
- Observation-cache test: several request/workspace artifacts sharing one physical owner identity invoke the underlying process observer once, and both recovery phases receive the same transaction observer.
- Unknown-artifact test: missing/malformed owner facts produce typed aggregate recovery failure with retained occurrence counts; a physically absent registered worktree produces an explicit empty scan rather than an invented orphan.
- Existing focused process-supervisor, runtime-startup, guarded-command, typecheck, native tests, and `git diff --check` remain green.

## Implemented convergence

- Managed Windows commands now use a non-breakaway Job. The native helper owns termination, waits for Job active-process-zero, and publishes the exact settlement marker. Child-process control errors no longer claim physical exit; process registry and Task leases remain until physical, output, request, and workspace settlement join.
- One absolute deadline covers isolated workspace copy, process readiness, execution, cancellation, output drain, and cleanup. Copy is abortable and preserves literal `.venv`/`venv` command semantics.
- Windows request files no longer serialize environment values. Requests and isolated workspaces persist exact runtime occurrence ownership. Startup performs request recovery before workspace recovery, then Automation and started-Task recovery, and only then binds a listener. Unknown artifact identity or physical settlement blocks bind with typed evidence.
- The Windows helper is launched in an independent process group and holds an exact owner-process handle. The parent-death positive test kills the owner, observes the descendant listener reclaimed, and validates the helper's active-zero marker before successor recovery is invoked.
- In-process CLI execution exits `Instance.provide` before process-wide settlement, so the Instance gate cannot wait on the caller's own read lease. Exact disposal then uses the process-wide `Instance.disposeAll` authority.
- Review domain delivery now has one durable exact dispatch settlement. Workflow projection no longer treats Session completion as review success; restart creates a fail-closed partial settlement for the same lineage when domain persistence is missing. Integrity singleflight is exact-dispatch scoped, Visual Review commits one turn-local graph, and synthetic review progress/cache resurrection were removed.
- Task Queue binds root progress to the exact queued input Message and admits a child only when its durable delegation metadata references an already-admitted assistant Message; historical and post-start parallel children cannot enter the live progress tree. It also uses slot-driven refill, durable terminal publications, and physical-owner settlement. Event and Automation leases now have real-activity inactivity fences. Instance process settlement reports exact lease/activity labels and retains runtime ownership on inactivity.
- Final review found and closed four cross-authority gaps: marker-missing helper exit can no longer delete the durable supervisor request; Task Queue no longer uses post-start time as causal identity; simultaneous CLI operation/settlement failure preserves both ordered causes; and ownership release/rollback failures retain one exact retryable cleanup receipt instead of poisoning the process-local owner.

## Verification evidence

- Windows/process integration: `18 pass, 0 fail` across `process-supervisor-control-plane`, `shell-deadline`, and `windows-orphan-artifact-recovery`. This includes a real long-lived descendant holding a TCP listener, bounded timeout, active-zero proof, environment non-serialization, literal relative virtual-environment execution, marker-missing durable request retention, and successor artifact recovery.
- Native process supervisor: `cargo test` reports `3 passed, 0 failed`; the process-tree readiness assertion now waits for the real descendant rather than relying on a fixed 150-millisecond scheduling delay.
- Runtime startup/recovery: `8 pass, 0 fail, 24 expect()`, including the CLI self-lease regression, ordered operation/settlement dual failure, exact retained ownership, bounded rollback receipts, partial Automation initialization, and pre-bind recovery. The final CLI ownership-release additions pass `2 pass, 0 fail, 10 expect()` and cover operation-plus-release failure as well as release-plus-rollback failure with successor exclusion until exact cleanup completes.
- Scheduler authority suites: `73 pass, 0 fail, 176 expect()` across Task Queue progress, durable Event fire, claim/fire identity, and runtime execution settlement.
- Reviewer/dispatch suites: `20 pass, 0 fail, 147 expect()` across exact dispatch recovery, managed lifecycle, Integrity occurrence singleflight, and Visual Review graph commit.
- OpenCorvus and Overlay typechecks pass. Documentation rendering check reports `330 ops, 25 groups`. Native format check and `git diff --check` pass.

## Explicit resilience boundary

The implemented parent-death contract proves ordinary owner-process death while the detached native helper survives long enough to publish active-zero. If an external host terminates the owner and helper simultaneously after Job assignment but before marker publication, `KILL_ON_JOB_CLOSE` still requests physical cleanup but no surviving authority can query and durably prove active-zero. Startup therefore retains the exact request and fails closed with a typed unknown instead of deleting it or targeting a reused numeric PID. Eliminating this boundary requires a process-tree-external native broker or a successor-verifiable named-Job receipt; neither is represented as completed work here.
