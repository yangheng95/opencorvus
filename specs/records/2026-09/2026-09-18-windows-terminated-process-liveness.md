# Windows terminated-process liveness recovery

## Recall

- User asks why Task `tsk_g00VVV3aTZ00OEys60w9` hung and retains the standing requirement that no Task may remain permanently active after a worker or backend is interrupted.
- Acceptance: distinguish the direct interruption from the recovery defect; a terminated Windows process must project `dead_or_reused` even while another process still holds a query handle to its kernel process object; a restarted Session prompt peer must be able to take over rather than wait forever; all shared consumers of physical process occurrence receive the corrected result; the historical Task evidence remains unmodified during diagnosis.
- Hard constraints: read production data only; unavailable evidence stays unknown; do not attribute the failure to the model without transport evidence; fix the shared process-occurrence primitive rather than adding a Task/Session-specific timeout or fallback; all LLM calls remain streaming; no UI automation tests.
- Sources read: the supplied `opencorvus.debug.v2` bundle, runtime logs for backend PIDs 43696 and 31428, live SQLite rows for the Task/ingress/Session prompt owners/control leases, `runtime/process-occurrence.ts`, `session/prompt/owner.ts`, `session/prompt/state.ts`, `session/loop.ts`, abandoned-dispatch reconciliation, current data/control/Task-control architecture, and Microsoft's official `GetProcessTimes`, `WaitForSingleObject` and process-access-rights contracts.
- Whole-repository search: `observeRuntimeProcessOccurrence` is the shared operating-system authority used by Session prompt ownership, Project/Workspace creation and deletion recovery, Session deletion, process watchdogs, shell/process execution recovery, and tests. The defect is therefore cross-subsystem; it is not local to the implementation engineer, DeepSeek, or one Expert Squad.
- Independent agent feedback: the first review found a P1 in the initial exit-FILETIME repair because Microsoft defines that field as undefined before process exit. The final implementation uses `WaitForSingleObject(handle, 0)` with `SYNCHRONIZE`; re-review confirmed correct rights/constants, handle cleanup, fail-closed behavior and retained-handle coverage, with no remaining findings.

## Observed incident facts

- The implementation worker was streaming at 2026-09-17 18:21:49Z. Its last model context contained 289 messages, 408 tool calls and an estimated 337,567 tokens; no Provider error is recorded.
- Backend PID 43696 stopped while the worker and its Orchestrator prompt owner were live. The replacement backend recovered the worker at 18:23:47Z as `AbandonedDispatchError`, persisted a replacement root ingress, and started an Orchestrator decision pass at 18:23:49Z.
- The replacement control Message was persisted with `pendingDelivery:true`, but no assistant occurrence or decision followed. The ingress remained leased and renewable for hours, so the rendered Task stayed `active` while its recovery turn made no progress.
- Both durable prompt-owner rows still name exited PID 43696. Windows `GetProcessTimes` for PID 43696 succeeds because a kernel process object remains referenced; its creation time still matches, its exit time is nonzero, and `process.kill(43696, 0)` returns `ESRCH`.
- Current `windowsProcessInstanceID` reads only creation time. `observeRuntimeProcessOccurrence` therefore returns `exact_live` before checking process liveness. The Session peer wait loop sees the old owner as permanently live and sleeps in 25 ms intervals without a terminal or wake boundary.

## Diagnosis

- Direct trigger: stopping backend PID 43696 interrupted the active implementation worker and Orchestrator prompt owner.
- Recovery trigger: the new backend correctly converted the abandoned worker into a durable infrastructure outcome and queued ingress `art_h1Cna3D8K1awNvf5O4Rm`.
- Root cause: the Windows process identity reader treats a terminated-but-still-queryable kernel process object as live because it compares only creation identity and never tests whether the process object is signaled. This violates the current `dead_or_reused` contract and traps every peer waiter behind the stale owner.
- Confidence: high. The exact historical owner reproduces the contradictory observations in the live environment: `GetProcessTimes` succeeds with matching creation identity, exit time is nonzero, the PID is absent from the active process list, `kill(pid, 0)` reports `ESRCH`, yet the production observer returns `exact_live`.

## Benchmark

- Task: verify Windows physical process liveness at the ownership boundary used by restart recovery.
- Input: a real child process occurrence whose process query handle remains open after the child exits.
- Required output: while alive, the occurrence is `exact_live`; after exit, while the retained handle still makes `GetProcessTimes` readable, the same occurrence is `dead_or_reused`.
- Environment: repository Bun runtime on Windows, using the existing test preload and no Provider credential.
- Timeout: wait on the child's actual exit and fail after 30 seconds without exit/progress; do not use a process-start absolute timeout as a substitute for liveness observation.
- Acceptance: the focused real-process test fails on the current implementation and passes after the shared primitive checks the process handle's signaled state; existing cross-process Session prompt takeover and process-occurrence tests pass; package typecheck, documentation check and diff check pass; an independent read-only review reports no unresolved finding.

## Plan

1. Add a Windows real-process regression that retains a native query handle across child exit and asserts the positive `dead_or_reused` contract.
2. Change the sole Windows process-instance reader to request `SYNCHRONIZE` and return an identity only when a zero-timeout process-handle wait reports `WAIT_TIMEOUT`.
3. Update the current data architecture to state that queryable terminated Windows objects are dead ownership authorities.
4. Run the focused reproduction first, then the existing Session cross-process takeover and shared occurrence checks. Review the complete diff independently before commit and merge.

## Status

The shared Windows reader now requests the minimum query plus synchronization rights and accepts a process instance as live only when `GetProcessTimes` succeeds and a zero-timeout wait reports `WAIT_TIMEOUT`. The retained-handle regression failed against the old implementation with `exact_live` after child exit. The first repair used exit FILETIME, but independent review correctly found Microsoft documents that field as undefined before exit; the final implementation uses the process object's signaled state instead.

Focused validation completed:

- process-occurrence evidence: 4 tests, 9 expectations;
- durable cross-process Session prompt ownership and takeover: 5 tests, 44 expectations;
- abandoned-dispatch recovery: 5 tests, 112 expectations;
- OpenCorvus typecheck, documentation check and diff whitespace check passed;
- the production Overlay/backend build and credential-free first-run check passed after stopping the running executable that initially locked the linker output.

The rebuilt runtime took over the historical Orchestrator prompt owner with backend PID 22836, consumed the previously pending control Message, streamed a new Orchestrator response and reopened the exact implementation worker Session. This confirms the stale-owner deadlock is gone. That old worker then reached a separate `ENOENT` for an attachment metadata file removed under the previously authorized no-data reset; this is a terminal input-data failure of the historical Task, not another liveness wait or evidence that the Provider hung.

After the P1 correction, all focused tests, typecheck, documentation and diff checks passed again. A final full Overlay/backend build completed, including the credential-free first-run check. The launched extracted sidecar SHA-256 `60C3999A20956520F37A32832F27C63436D11371F03D10426B69616119642E92` exactly matched the built backend; health returned HTTP 200, the historical Orchestrator prompt owner moved to the new backend, and no attachment authority marker reappeared. Final independent re-review reported no findings. Commit and delivery remain pending.
