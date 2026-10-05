# Windows restart ownership transfer: qualified failure and proposed repair

## Recall

- Original user intent: deeply exercise the product, repair real problems, use the authorized three-agent audit, and continue autonomous iteration until stopped. This investigation follows the actual Windows restart failure found during owned UI verification.
- This is the **next iteration, pending implementation approval**. It does not extend the repaired scope of [authoring admission](2026-10-05-authoring-admission.md). That record, current architecture and production source remain unchanged by this document.
- Delegation: root authorized functional_audit to investigate independently, write this one record and update its indices. No further delegation, production edits, Git mutation, credentials, model calls, user-process operations or UI automation are authorized here. Root is coordinating the two index edits and owns final integration.
- Required outcome: a real standalone Windows POST /restart must leave the exact replacement serving after the predecessor exits. Ordinary managed process death/cancellation and existing Task, Mission and Session ownership must remain correct. Admission must respect the actual launcher and containment boundary.
- Acceptance: use the retained credential-free Windows baseline and real HTTP/process/native artifacts; verify precise positive receipts, contents and states, including consecutive restarts and crash windows. No source hash, mock-only result, zero-error history gate or model invocation substitutes for actual restart qualification.
- Read: root AGENTS; current [server readiness](../../current/architecture/server-runtime-readiness.md), [control ownership](../../current/architecture/03-control.md), [Task control plane](../../current/architecture/task-control-plane.md), [process facade](../../current/architecture/04-extensions.md); [Windows owner-death history](../2026-08/2026-08-11-windows-worker-scheduler-liveness-convergence.md); serve, restart/lifecycle/shutdown, native supervisor, core ProcessSupervisor, util NodeProcess, managed parent watchdog, SDK launcher, Tauri lifecycle, container entrypoint, host recovery and focused lifecycle tests.
- Whole-repository searches covered restart admission/registration, detached command callers, native request/ready/cancel/settlement codecs, orphan reconciliation, startup receipts, parent occurrence arguments, runtime settlement, launcher Job ownership, and build/test helper packaging. Searches found one production core detached command caller: restart-handoff. Browser and system-terminal launchers use util NodeProcess detached ownership instead.
- Previous proposals withdrawn: no new lifecycle-owner command-line configuration, general POSIX keeper, relaxed Job breakaway, direct NodeProcess swap, or unconditional owner-death exemption. The intended scope is the existing Windows native exact-HANDLE layout plus a committed transfer fact. Shared file handshake changes must preserve other platforms' existing restart behavior; stronger POSIX pre-Ready crash guarantees remain unverified.
- Resume point: production is still unchanged. Root requested closure of the remaining engineering choices, which is recorded below under implementation decisions. This is an implementation-ready proposed contract, still awaiting root's source-edit authorization; no user preference decision is needed. Toolchain presence is verified; no new native build or restart run was performed for this record.

## Qualified observation and causality

The public route describes spawning a new process with the same arguments and then exiting. Its HTTP 200 means lifecycle admission, not completed restart. A standalone serve process registers the concrete restart handler; it is not waiting for an external launcher to restart it.

The credential-free Windows reproduction used only owned port 17888 and an isolated home. Its permanent [before evidence](../../artifacts/2026-10-05-product-data-integrity/windows-restart-before.json) records:

| Fact | Actual observation |
| --- | --- |
| Original server | PID 76236, listening at 127.0.0.1:17888 |
| Admission | cal_g0VX8Vjlw00r0peCwjQJ, ok=true |
| Replacement | PID 45284, a new listening startup receipt for the same URL |
| Native request | detached=true; owner PID 76236; request 109e773d-3620-40de-b955-86f577ad6614 |
| Native helper | PID 49644, exact helper process-instance marker |
| Old runtime settlement | sessions=0, toolParts=0, then internal-restart exit |
| Native terminal fact | same target PID 45284, active_processes=0 |
| Explicit cancellation | no cancel file was present in the retained observation |
| Final availability | all four owned lineage processes had exited and port 17888 had no listener |

Raw diagnostic files remain in `.tmp-product-iteration/data-integrity/restart-audit-02`: review.json, stdout.log, stderr.log, startup-before.json, startup.json and home/tmp/supervisor-jwoNFG. The preceding restart-audit-01 failed before startup because the diagnostic environment omitted TEST_PROCESS_ROOT; it is a harness setup error, not a product failure.

The direct source chain is:

1. `server/routes/app.ts` -> `admitServerRestart` -> serve's registered handler.
2. `beginRestartHandoff` quiesces the listener, settles execution, releases runtime state and waits for the socket, then starts `ProcessSupervisor.spawnHostCommand({ detached: true })`.
3. The replacement sends waiting, receives bind, obtains the runtime lease, publishes its listener and reports ready.
4. The predecessor calls child.unref and exits through internal-restart.
5. Native `run_request` observes its original owner HANDLE signaled. Its owner-dead branch terminates the exact target even when detached=true, then publishes active-zero.

`unref` only drops JavaScript event-loop references and core registry ownership. It does not change the native watchdog's owner. The empty runtime reproduction excludes a Task recovery wait as the cause. It does not prove that a durable Task fact was corrupted.

The historical Windows repair deliberately required owner-death termination for both Jobs and exact detached targets. Tests qualified managed parent-death cleanup, physical settlement and recovery; other tests covered a mocked lifecycle failure or replacement environment cleanup. They did not prove ready successor survival after predecessor exit. The conflict therefore crossed two individually described lifecycle contracts.

## Current owners, callers and impact

| Surface | Current owner and finding |
| --- | --- |
| CLI default and serve, compiled entrypoint | Same serve handler; actual Windows standalone failure established. |
| HTTP and generated SDK server.restart | Same public admission. A returned occurrence is not proof of eventual listener availability. |
| Tauri settings/menu restart | Native stop_server_state/start_prepared_server owns replacement. It does not use this HTTP handoff. |
| Direct HTTP to Tauri sidecar | The sidecar has parent PID/fingerprint and an outer kill-on-close Job. Tauri's observer clears that Job after the tracked child exits. A detached successor cannot silently replace the child that Tauri owns. |
| SDK-created backend | NodeProcess owned_tree owns the service and close(). Windows uses a native Job. A self-handoff must not escape that existing owner or invalidate close(). Actual managed HTTP qualification remains pending. |
| Docker | The existing entrypoint execs the backend. Container PID 1 exit has an external lifecycle consequence; a child listener alone is not a container restart receipt. Actual container qualification remains pending. |
| Browser/system terminal | util NodeProcess detached with independent stdio; these are not current callers of the faulty core native detached request. |
| Core host and Task commands | Managed request/Job, cancellation, physical/output settlement and Task lease ownership remain in scope for regression checks, not migration. |
| Task/Mission/Session | All depend on the replaced physical server. Their accepted occurrences and immutable facts retain their existing owners; no alternate restart input or message is to be synthesized. |
| Multiple Projects | Runtime lease is database-scoped. Shutdown fences all current physical owners; recovery initializes affected Projects independently. A dead replacement removes availability for all Projects in that runtime. |
| Separate databases/homes | Existing runtime lease and exact process identities must keep a restart from cancelling another runtime. Parallel development still uses isolated homes. |

`Server.settleCurrentProcessExecution` closes Task activation, scheduler fire, Session wake and detached-dispatch admission before physical cancellation. Terminal publications and database effects drain before release. `terminateCurrentProcessOwnedExecution` captures actual prompt owners, records applicable active Task handoffs, cancels siblings before joining them, and does not rewrite terminal Task satisfaction. Host recovery restores started incomplete Tasks, Mission closing/delete-retention/opened-process occurrences and durable scheduler delivery under the existing Project owners. Normal terminal Tasks, closed Missions and settled Sessions must retain those facts across restart.

Repeated same-kind lifecycle requests currently coalesce; conflicting shutdown/restart receives 409. This admission remains one owner. Failure before transfer must restore the original listener through the same readiness/recovery path. None of these control contracts authorizes a late old-owner cleanup to terminate a committed successor.

## Proposed minimum implementation boundary

Keep core `detached` as the explicit restart target layout: native helper holds an exact target HANDLE outside its ordinary cleanup Job. Add an explicit ownership transfer operation to that detached handle. Do not make generic unref perform a hidden transfer, and do not repurpose util NodeProcess.releaseControls: SDK uses it only to release the startup deadline/signal while retaining close ownership.

The ordinary core Handle remains unchanged in meaning. A detached handle exposes a capability with this proposed shape:

```ts
type ProcessOwner = {
  occurrenceID: string
  pid: number
  processInstanceID: string
}

type OwnershipRelease =
  | { kind: "native_transfer"; receipt: NativeTransferReceipt }
  | { kind: "local_detached_release"; previousOwner: ProcessOwner; successor: ProcessOwner }

transferOwnership(successor: ProcessOwner): Promise<OwnershipRelease>
```

The current platform adapter selects the result, not a failed-operation fallback. Windows waits for the native committed receipt. POSIX keeps its current detached physical behavior and releases local caller ownership after exact Ready validation; it does not fabricate a native receipt or claim Windows parent-death guarantees. New POSIX infrastructure is excluded.

The successor must match the target PID and actual process-instance fingerprint from spawn. Same-identity repeated transfer returns the same committed receipt. A changed identity returns a typed conflict. `exited`, terminalFact, outputSettled and settled keep their physical meanings. After native commit, old-caller terminate/dispose reports ownership transferred rather than issuing cancellation. The registry release is a projection of the receipt, not a new ownership store.

The request root and request ID must exist before spawning so the successor can receive their locator. Extend the existing detached spawn preparation to use that one context; do not allocate a second restart receipt directory alongside the native request. Other managed commands retain their existing request preparation. The exact interface is selected under implementation decisions below; there remains one request writer and one spawn path.

## Native wire facts and validation

Keep the existing request's original owner fields and its ready/helper/settled facts. The two added transfer files are derived fixed siblings under that exact root. They do not replace the startup occurrence receipt owned by an external launcher.

```ts
type NativeTransferRequest = {
  protocol: 1
  request_id: string
  expected_owner: ProcessOwner
  successor: ProcessOwner
}

type NativeTransferReceipt = {
  protocol: 1
  request_id: string
  outcome: "committed"
  previous_owner: ProcessOwner
  successor: ProcessOwner
  helper: { pid: number; processInstanceID: string }
}
```

`transfer-request.json` is written by the existing controller. `transfer-receipt.json` is written only by the native helper and is the sole commit point. A request/intention or application-ready file is not a transfer receipt. Timestamps may be diagnostics, never ordering authority. Malformed or contradictory facts produce an explicit evidence error and retain their artifact.

Validation before commit must establish all of the following:

1. The native command is detached and the controller matches request.owner_pid, owner_process_instance_id and runtime_occurrence_id.
2. request_id matches request.json, helper.json and ready.json; the helper identity is the exact live helper for this request.
3. successor.pid and successor.processInstanceID match the native target HANDLE/ready marker, and its runtime occurrence matches the successor's application handshake. An arbitrary process is not an admissible successor.
4. The target is live, cancellation has not already entered physical settlement, and a committed transfer for a different identity does not exist.
5. File paths are fixed siblings of the canonical request root. No absolute control path supplied by an HTTP caller is trusted.

Use existing same-directory atomic marker publication: create a unique temporary file, write complete JSON, flush, close and atomically publish. The native loop is the single writer. Repeated matching facts are read idempotently; different content is never overwritten as a retry. The selected native ready marker is protocol 3 with required detached acknowledgement, as specified below. An older packaged helper fails explicitly rather than silently ignoring transfer control; there is no legacy-codec fallback.

Cancel and transfer are serialized by the helper. The existing cancel file is the original request controller's authority. A cancel already accepted before commit settles the target and prevents transfer. Once a transfer receipt commits, that old cancel authority no longer controls the target. A caller racing cancellation against transfer must observe the winning receipt/physical settlement and return its explicit result. No second cancellation protocol or mutable effective-owner file is needed.

## One readiness handshake, independent stdio

Replace, rather than supplement, the stdout prefix/parser and stdin bind token with these files in the same request root:

| File | Writer | Required binding |
| --- | --- | --- |
| restart-waiting.json | Successor | protocol, request_id, predecessor owner, full successor occurrence |
| restart-bind.json | Predecessor | protocol, request_id, exact successor, hostname and port |
| restart-ready.json | Successor | protocol, request_id, exact successor and actual listener URL |
| restart-failed.json | Successor, only before ready | protocol, request_id, exact successor and typed startup error |

The environment carries only the exact root/request locator and required immutable handoff input. Preserve replacement-environment cleanup of launcher-minted current/predecessor/shutdown occurrence variables; a successor must obtain a fresh runtime occurrence rather than inherit the old process identity.

The predecessor still quiesces, settles process execution, releases the final database runtime lease and proves socket release before granting bind. Listener readiness retains the current distinction from application recovery completion. After validated application Ready it calls transferOwnership; after committed release it exits. Ordinary logs have no readiness authority.

The helper/replacement must use independent stdio for long-term life. Reuse the application's runtime logging; retain native startup diagnostics in the owned request root. Do not merely ignore stderr and lose the only failure detail. Node's detached documentation explains why unref alone with parent-connected stdio is insufficient.

Windows retains the root until exact native settlement/orphan cleanup. On POSIX, after the parent has read Ready and completed the existing local release, neither side needs the finished handshake files and that parent removes the ended control root. Independent diagnostic output belongs to the existing runtime log directory, not to that removed root. Failure cleanup removes the control root only after the owned child settles. Abrupt death of both participants can leave diagnostic residue; current POSIX strong crash cleanup is not claimed or expanded here. Exact preparation, log-descriptor and disposal boundaries are selected below.

## Crash and retry matrix

| Window | Authoritative state and required behavior |
| --- | --- |
| Old host dies before transfer intent publication | Original owner remains; Windows helper terminates exact target and publishes actual settlement. |
| Successor fails before waiting/bind/Ready | Exact target settlement and error; live predecessor restores its listener through current recovery owner. |
| Transfer intent is partially written | Temporary file is not a fact. Original owner applies. |
| Valid transfer intent exists, no receipt yet | Native loop alone arbitrates transfer against cancellation/death. Caller cannot claim transfer success or independently restore while outcome is unresolved. |
| Receipt published, caller has not observed it | Successor owns lifetime. Re-read the same receipt; do not dispose target or restore another listener. |
| Predecessor exits after commit | Successor remains live; old-owner death and old cancel authority have no physical control. |
| Successor exits after commit | Native target HANDLE signals; publish real settlement. Current application startup recovery remains responsible for interrupted work. |
| Response/read failure after possible commit | Retain explicit ownership-uncertain evidence and resolve the same native result; a timeout is not proof that transfer did not happen. |
| Helper dies without conclusive transfer/settlement evidence | Preserve exact artifact/unknown classification. The detached target lacks managed Job kill-on-close proof; no numeric-PID cleanup or invented active-zero. |
| Duplicate restart while predecessor owns admission | Same lifecycle occurrence; conflicting shutdown remains the current 409 contract. |
| Second restart of the first successor | New exact request/owner identities; prior transferred root is retained while its target is live and becomes reclaimable only after actual settlement. |

The native loop's selected arbitration is specified below: target termination first, then an already committed transfer, then observed cancellation/old-owner death, then a new transfer. A complete transfer intent observed together with old-owner death therefore loses to cleanup. A transfer already being committed is one serialized operation; a later cancellation/death observation cannot reverse its published receipt. The positive crash-cut test must exercise both sides of that boundary rather than relying on elapsed time.

## Orphan reconciliation

For a valid committed transfer, effective owner is receipt.successor; otherwise the original request owner applies. This is the current occurrence's commit state, not a compatibility reader. The reducer must read the receipt before deciding whether the original owner's death permits cancellation.

- exact-live effective owner: retain its request.
- unknown-live effective owner: retain and report unknown; do not reinterpret it as dead.
- committed successor dead/reused: the target is the same exact process, so consume/await native physical settlement. Do not send the old controller's cancel to a different runtime.
- helper dead and target live/unknown: retain with explicit evidence classification; absence of a helper is not active-zero for a detached target.
- physical settlement proven: remove only the matching root, including its ended handshake facts.
- malformed identity or contradictory marker: use the existing unknown/quarantine contract; never start a second ownership interpretation.

Ordinary managed request recovery and pre-target failure cleanup keep their existing contracts. Same-DB runtime leasing continues to fence startup/recovery, while independent databases remain isolated.

## Launcher admission without another policy surface

Reuse existing managed parent PID/fingerprint and actual containment. Do not introduce lifecycle-owner flags or infer ownership from command names, titles or startup receipt presence alone.

- Tauri: existing managed arguments identify the launcher. The HTTP handler must expose an explicit unavailable reason before self-handoff; settings/menu still use the native launcher restart path.
- SDK Windows: use current owned_tree native Job containment as the admission authority. Direct HTTP must not break out of that Job. The minimum repair does not change SDK spawn arguments, add another identity probe, or change releaseControls/close. Existing managed parent arguments remain available to actual launchers; this repair does not need to duplicate them in SDK. Actual SDK containment admission and close remain required qualification.
- Standalone Windows: check the exact current process's Job containment before quiesce and enforce native creation constraints at admission. A containing Job means typed refusal, not enabling BREAKAWAY_OK.
- Docker/init: PID 1 is an objective self-exit boundary. Any typed refusal must describe that actual boundary; do not claim a generic container detector. Existing external restart behavior and container restart-policy interaction require an actual container check before a broader claim.
- Other platforms: shared file handshake and local release must retain current standalone restart behavior. This Windows repair does not introduce a new POSIX keeper or claim stronger pre-Ready sudden-parent-death behavior.

Public errors should distinguish managed-parent/containing-Job/init-process unavailability from an already-admitted execution failure. The exact response schema and operation description need root review and canonical API generation if changed. A successful admission stays an occurrence receipt, not a completed-restart result.

## Proposed source scope and excluded work

Expected production scope after approval: server/restart-handoff.ts; cli/cmd/serve.ts; server restart/lifecycle/routes admission for typed availability; runtime/process-occurrence.ts for the existing Windows identity reader's containment query; shell/process-supervisor.ts and its current marker codec; native/process-supervisor/src/main.rs; util/process-node.ts for the protocol-3 managed acknowledgement. SDK production launcher changes are excluded: existing containment is sufficient for this Windows admission rule. No broad NodeProcess migration, second process registry, TLS change, LLM workflow rule, Task scheduler rewrite, credentials or database schema change is proposed.

The ordinary NodeProcess releaseControls/close separation must remain intact. Browser, terminal, MCP and Task command ownership are regression boundaries, not additional redesign targets. Do not remove historical wrong outcomes or treat this record as permission to operate a running user server.

Current toolchain facts: cargo/rustc 1.98.1, stable-x86_64-pc-windows-msvc and VS 2022 Community C++ tools are present. The current source helper under native/process-supervisor/target/runtime-fe73559fd1d31dc1/debug actually executed the baseline. `prepare-test-process-supervisor.ts` rebuilds the isolated test helper; build.ts packages the Windows release helper. Fresh compilation of the future protocol and packaged helper coherence remain required acceptance, not completed work.

## Concrete positive qualification

Add one focused credential-free real HTTP checker, proposed `script/server-restart-e2e.ts`, using the existing isolated-runtime and native-helper preparation primitives. It must launch actual source serve, use actual startup receipts and POST /restart, and retain exact native/HTTP/SQLite evidence. It must not substitute handler hooks for the main availability proof. Port 17888 is the baseline reference, not a reusable entitlement: probe availability before using any owned port, or allocate a free one. Never touch root/UI/proxy/user services.

1. Publish a real first listening receipt and an exact local data fixture. Admit restart; observe the matching native committed transfer, predecessor terminal state, successor identity, same URL, and actual health plus fixture read/write responses after predecessor exit. Repeat from that successor for a second full restart. Exercise actual log output after each handoff.
2. At controlled native boundaries, end only checker-owned predecessors before transfer and after commit. Assert exact physical settlement in the first case and successor HTTP/data success in the second. Fault injection qualifies the crash boundary; the normal case remains uninstrumented production HTTP.
3. Exercise wrong successor/owner identity and post-transfer old-controller cancellation through the current primitive; assert precise typed error/committed receipt. Duplicate matching transfer returns that same fact. Startup failure returns its exact failed occurrence and the restored original HTTP listener.
4. Run the existing orphan reducer with actual artifacts while the transferred target lives, then after its deliberate normal shutdown. Assert retained effective-owner disposition followed by matching settlement/reclamation. Separately verify unknown identity and malformed fact error contracts.
5. Use existing managed-parent and owned-tree native fixtures to prove real parent-death physical settlement remains correct. Qualify Tauri-style existing parent arguments and actual SDK containment admission; do not create UI tests or operate a real desktop window.
6. Run focused positive runtime-startup-recovery, runtime-execution-settlement, process-shutdown-task-lifecycle and process-supervisor contracts for Task/Mission/Session terminal and active siblings, application recovery held in one Project, and independent Project progress. Add only missing precise positive cases. This local process work does not require a Provider credential or model response.
7. Run two independent owned homes concurrently and prove their own HTTP/data/identity facts through one restart. Same-database competing-owner admission remains its explicit ownership-conflict contract.
8. Run backend/explicit checker typechecks, native tests/build and affected docs/API checks. Package/helper protocol mismatch must return an explicit admission error; source-only success cannot qualify a stale packaged helper.

Existing relevant suites: process-supervisor-control-plane.test.ts, windows-orphan-artifact-recovery.test.ts, managed-parent-lifecycle-process.test.ts, runtime-startup-recovery.test.ts, runtime-execution-settlement.test.ts, process-shutdown-task-lifecycle.test.ts and server-lifecycle-occurrence.test.ts. Use the package's isolated runner with explicit file arguments, not a full bun test. Existing task-control phase restart checks are useful recovery evidence but do not exercise HTTP self-handoff and cannot replace this checker.

All new assertions must target actual receipts, response bodies, exact ownership, retained/reclaimed dispositions or typed errors. A boolean absence/zero-error history is not the core acceptance. Dispose only owned runtime resources and preserve failed evidence. Root owns eventual architecture/API documentation, integration review, commit and push.

## External authority and outstanding facts

- [Microsoft Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects): Job association cannot be broken after assignment; children normally inherit containment; breakaway requires the containing Job's permission. This supports preserving containment rather than relaxing it for restart.
- [Node child_process detached](https://nodejs.org/api/child_process.html#optionsdetached): unref releases the parent's event-loop reference; a long-lived detached process also needs stdio independent of the parent. These are necessary platform conditions, not evidence that this repository's native transfer succeeded.
- Unmet verification: implementation approval and code; real restored-listener and transfer crash cases; actual SDK/Job and Docker admission; post-change native/package checks; POSIX runtime regression qualification. The engineering choices below resolve the earlier protocol/admission questions; platform/runtime verification remains distinct from design. None is claimed complete by the Windows baseline or this document.

## Implementation decisions after root review

### 1. Serialized arbitration and rollback

The helper remains the sole physical owner until its committed transfer receipt changes authority. Its detached loop uses this order on every iteration:

1. Observe the exact target HANDLE. A terminated target is settled through the existing physical marker and exit result; it cannot be newly transferred.
2. If transfer is already committed, observe target lifetime only. The original owner's HANDLE and original cancel file no longer authorize termination. A successor is the same exact target, not a separately looked-up PID.
3. Before beginning a new transfer, observe the original owner HANDLE and the original cancel file. If either requests cleanup, enter physical termination irreversibly for this target, await actual exit and publish settlement. A concurrently present transfer request is not accepted.
4. Otherwise validate a complete transfer request and the exact target. From this validation through atomic receipt publication, process one operation without polling another control transition. The successful atomic publication is the durable commit point. A cancellation or owner death that becomes observable during this operation is processed afterward and cannot reverse a committed transfer.
5. If publication fails, ownership has not committed. Preserve the primary error, settle the still-owned target and report the exact settlement/error. Never mark it transferred in memory before the durable publication succeeds.

This defines ordering by the one helper's operation admission, not by incomparable filesystem timestamps. It does not promise that a cancellation written during an already admitted commit will win. Native crash-cut tests must place a real boundary before step 3 and during step 4 and assert the actual terminal/committed receipt selected by this rule.

`transferOwnership` publishes its intent once, then reads the immutable receipt or physical terminal fact. If its bounded wait fails, it requests cancellation through the existing original cancel authority and resolves the **same** native decision: uncommitted helper cleanup yields settled; committed transfer yields the same committed receipt and the cancel is stale. A typed ownership-transferred result is success for the handoff, not a cleanup error.

`beginRestartHandoff` uses a closed disposition set: `not_spawned`, `settled_before_transfer`, `transferred`, `unknown`. Restore the predecessor listener only for the first two. On transferred, complete the same successful handoff even if an earlier file-read attempt failed. On unknown, retain artifacts and throw `ServerRestartOwnershipUncertainError` with request/owner/helper/target identities; do not restore a competing listener, exit successfully, delete the root or target numeric PIDs. The already quiesced predecessor stays available as a physical diagnostic owner until its own explicit shutdown. This is an honest failed lifecycle, not a completed restart claim.

This also repairs the existing catch-path hazard: currently cleanup failure is combined into an error but restoreListener is still attempted. The new conditional rollback requires positive target settlement, not merely a rejected spawn/dispose Promise.

### 2. One native ready version and all readers

Select native `ready.json` **protocol 3**, adding a required Boolean `detached` echoed from the admitted request. Existing identity fields and optional foreground-lifetime acknowledgement retain their meanings. A detached=true marker from protocol 3 acknowledges the transfer operation; managed callers require detached=false. Do not add a capabilities list or accept protocol 2 as another successful interpretation.

The new transfer-request and transfer-receipt records use their own initial protocol 1 because they are new record kinds. Existing helper, pre-target-failure and physical-settlement record protocols remain unchanged; changing unrelated record shapes is unnecessary. The full ready parser must enforce the current identity and exact expected detached/foreground flags before bind can be granted.

Reject a stale helper **before quiesce**: add a read-only native `--protocol-version` query returning the same constant 3 used by ReadyMarker, with no target creation. Restart availability invokes the selected helper directly through the existing low-level owned-process adapter under the existing bounded handoff timeout. Unsupported operation, another version or unreadable output returns `helper_protocol_unavailable`; no compatibility probe or alternate helper is tried. Keep the human package `--version` meaning unchanged. The actual post-spawn ready marker still validates capability and target identity, so a binary replaced between checks fails explicitly. This preflight prevents a known old helper from spawning a target whose old settlement codec the new reader deliberately cannot accept.

Source/packaging inventory:

| Owner | Required action |
| --- | --- |
| native/process-supervisor/src/main.rs: ReadyMarker/publish_ready_marker | Emit protocol 3 and detached for every command/shell request; implement detached transfer operation. |
| core shell/process-supervisor.ts: WindowsReadyMarker/parser/waitForReadyMarker and recovery | Require protocol 3 and matching flags for a new admission; use the same parser for its durable recovery fact. |
| util/src/process-node.ts: WindowsReadyMarker/parser | Require protocol 3 and detached=false for owned_tree; retain exact helper/request/target validation. |
| script/prepare-test-process-supervisor.ts + test-process-supervisor.ts | Rebuild the existing source-addressed helper. Keep Rust changes in the currently indexed main.rs, or extend that existing dependency inventory if a Rust module is actually added. |
| script/build.ts and build.local.ts | Both already cargo-build and copy the Windows helper; verify both delivery paths use the new binary. Do not edit version metadata solely to imply protocol qualification. |
| script/build-artifact.ts and check-work-artifact-profile.ts | Existing executable presence/selection remains; real packaged spawn must prove protocol-3 acknowledgement. |
| core/util process tests, SDK server tests | Update touched codec expectations and run real current-helper transport; an old-helper marker returns an explicit protocol error followed by exact cleanup. |

The TypeScript parsers have different caller context today; both must be updated together. This repair does not broaden into unrelated marker-parser consolidation. A historical protocol-2 artifact encountered during orphan recovery becomes the existing explicit unknown/quarantine disposition; it is not decoded by a compatibility branch. The existing startup reporter exposes such artifacts rather than fabricating settlement. Native request environment secrets remain excluded from durable files.

### 3. Exact availability and the minimal SDK choice

Replace the restart registry's bare function with one registered object containing asynchronous `availability()` and `execute(reason)`. `admitServerRestart` first handles an existing same/conflicting lifecycle, then awaits availability and rechecks that same admission owner before creating/coalescing an occurrence. Capture the exact registered execution capability for the admitted occurrence. This fixes the mismatch between the current admission comment and its later handler re-read without adding another lifecycle registry. Shutdown ownership is not redesigned. The asynchronous check accommodates the bounded read-only native protocol probe; concurrent shutdown/restart admission still resolves through the existing single live occurrence after the probe.

Availability order is: no handler -> unavailable; existing complete managed parent arguments -> `managed_parent`; PID 1 -> `init_process`; Windows exact-current-process containment -> `containing_job`; then the Windows protocol-3 probe -> available or `helper_protocol_unavailable`. A failed containment observation returns `ownership_unobservable`, never available. These refusal reasons return a dedicated typed restart-unavailable HTTP 503 body before quiesce. Existing conflicting lifecycle remains 409; an admitted execution that later fails remains the occurrence's failed state. POSIX does not invoke the Windows helper probe.

Add only a read-only Windows containment query beside the existing current-process identity implementation: query IsProcessInJob on the current exact process HANDLE. It is not an environment policy or a launcher-name heuristic. Native run_request already opens and validates the original owner's HANDLE; detached target creation must query that same handle again and reject a containing Job before target creation. This closes a containment change between public availability and native spawn without altering Job limits or CREATE_BREAKAWAY permissions. A late rejection uses the normal pre-target/restore path.

This is sufficient for SDK Windows: util spawnWindowsOwnedTree writes detached=false and creates the backend inside its native Job before target execution. Keep SDK source unchanged. The actual checker must call createOpenCorvusServer against real backend source or a current packaged binary, receive its real startup receipt, observe `containing_job` on POST /restart, perform another real health/data request, then call SDK close and verify its physical terminal receipt. A transport-only fake startup server is not this qualification.

For a source-mode SDK check, a temporary `serve` bootstrap file can import the actual backend entrypoint in the same Bun process while SDK uses its existing executable override; it must preserve the spawned PID and real startup receipt, not spawn another server or manufacture a response. Prefer a current packaged binary when available. Tauri's existing parent arguments are already sufficient for managed refusal, and its native restart path remains unchanged. Default Docker entrypoint execs the backend, so PID 1 refusal addresses that repository-defined path. Docker --init or third-party service-manager policies are residual deployment qualification, not guessed from environment strings.

### 4. Request context, file handshake and disposal

Select a small prepared context in the existing ProcessSupervisor namespace:

```ts
type DetachedCommandContext = Readonly<{
  requestID: string
  root: string
  owner: RuntimeProcessOccurrenceInfo
}>

createDetachedCommandContext(): Promise<DetachedCommandContext>
// The current detached Boolean becomes this explicit context for the one
// production detached caller. Ordinary omitted ownership stays managed.
spawnHostCommand({ detached: context, executable, args, cwd, env })
```

The factory uses Global.createTemporaryDirectory("supervisor-") and currentRuntimeProcessOccurrence once. It allocates identity/root only; the existing spawn adapter remains the single request.json writer. Validate that the context belongs to this exact current process and that the canonical root is the expected owned temporary child before admission. Remove the Boolean-true detached input, rather than retaining an untracked alternate launch mode. This is preparation for the current spawn path, not a second spawn implementation.

`beginRestartHandoff` allocates this context before child spawn and serializes `{protocol:1, requestID, root, owner, hostname, port}` into the existing restart environment key. Replace its independent token with requestID. Managed launcher occurrence environment fields are still cleared by restartReplacementEnvironment. Windows and POSIX read the same waiting/bind/ready/failed codec and fixed paths; application handshake decoding does not branch by platform.

Application facts are atomically published. Waiting is accepted only for this native/child target; bind names that exact successor and requested socket; ready names that successor and the exact requested URL. Failed is terminal for application startup and cannot coexist with a successful ready for that attempt. File waiting reads facts before/after each bounded polling wait and races the actual child terminal result; filesystem notifications and console text are not authority.

For independent output, the prepared detached adapter opens a request-ID-qualified diagnostic log in the existing runtime log directory and passes the file descriptors to the helper/target at spawn. Parent copies close after OS admission; child copies outlive predecessor exit. stdin is ignored because bind is now a file fact. Core Handle streams may be null for this explicit detached path, while ordinary managed pipe collection remains unchanged. Read a bounded diagnostic tail for startup failure. Logs follow the existing runtime log ownership/retention and are not embedded in transfer state.

Root cleanup is owned as follows:

- Context created but physical spawn never attempted: the caller removes its empty owned root.
- Spawn attempted: the adapter owns cleanup; an admission/cleanup error cannot authorize the caller to delete an uncertain request.
- Windows committed transfer: retain the root for its existing exact-effective-owner orphan reducer and eventual native settlement.
- POSIX success: after parent reads ready and validates the child identity, local transfer releases its current caller handle; parent removes the ended handshake root. The child has completed its atomic ready write and does not read that root again. Its independent log descriptors and runtime logging remain usable.
- POSIX pre-transfer failure: parent requests the existing physical cleanup, awaits child settlement, then removes the root before restoring its listener. An abrupt parent death can leave the diagnostic root; this is retained residue, not a reason to introduce a keeper or claim stronger crash cleanup.

No durable POSIX native-transfer receipt is synthesized. The local-detached-release result accurately labels its existing adapter guarantee. The strong parent-death and orphan-transfer assertions are Windows qualifications; ordinary successful POSIX restart remains a mandatory regression check on an available POSIX host.

### 5. Residual verification rather than unresolved design

The decisions above close the arbitration, version, SDK admission and context/disposal choices. Remaining items are empirical: current-helper native/HTTP crash cases; actual SDK Job refusal/continued health/close; actual managed-parent refusal and launcher restart; current package/helper coherence; successful POSIX restart with the shared file handshake; and default Docker PID-1 refusal in a real container. The helper-itself simultaneous-death unknown boundary and third-party service-manager behavior remain explicit limits. None requires a new user preference or credential/model authorization.
