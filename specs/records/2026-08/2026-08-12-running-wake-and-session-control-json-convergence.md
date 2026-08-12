# Running wake and Session control JSON convergence

## Recall

| Field | Recalled fact |
| --- | --- |
| User request | Investigate why Task `tsk_g00VS16IN200keJNfzy5` is suspended, analyze the failure depth, and repair the scheduling system rather than applying another local unblock. |
| Incident input | `opencorvus.debug.v2` generated at 2026-08-12 00:23:34Z for `D:\myhexin-local\demos\long-absa-task`, followed by read-only queries against `C:\Users\hengu\AppData\Local\opencorvus\data\opencorvus.db`, the live `/global/health` response, and the installed sidecar executable metadata. |
| Qualified output | An ownerless durable `running` ingress converges from its exact persisted assistant or returns to `pending` before a younger ingress is admitted; automatic compaction persists one valid JSON control without a false semantic-identity conflict. |
| Environment | Focused tests run through `packages/opencorvus/test/isolated-test-entry.test.ts`; the existing real Task-control checker uses activity-resetting inactivity timeout and isolated data. The live user application is read-only evidence and is not restarted. |
| Acceptance | Positive regression proves active same-runtime admission settles the exact old running ingress and then drains the younger wake in order; a real SQLite-backed compaction regression proves omitted optional fields round-trip as one pending control; focused scheduler/control suites, package typecheck, docs check, real checker, and independent read-only review pass. |
| Hard constraints | Keep `queued_operator_wake` and `session_control_record` as their single durable authorities. Do not add a watchdog, Host workflow gate, replacement wake, hidden message, fallback scheduler, or rewrite immutable lifecycle history. Preserve unrelated shared-worktree changes. |
| Read before change | `specs/current/architecture/task-control-plane.md`; `2026-08-12-orchestrator-wake-turn-serialization-repair.md`; `engine/queue.ts`; `session/control.ts`; `session/compaction.ts`; `session/loop.ts`; `session/processor.ts`; focused scheduler and memory tests. |
| Search/impact audit | Searched all running-ingress recovery, active/startup/delayed dispatch callers, root-wake process ownership, completion hooks, Session control writers/readers, compaction creators, JSON persistence schemas, execution occurrence projection, health/version surfaces, and historical implementation commits. |
| Independent agent input | None before implementation. A previously uninvolved agent will perform the required final read-only review after verification. |

## Observed facts

- The Task is durably `active`; all four Goals are unaccepted and have no active Session. No Task cancellation or terminal authority exists.
- The durable wake order is ten `drained`, then `art_g019ff290f7830000000000001xn9KHJeW0mDxp` in `running`, followed by four `pending` lifecycle/infrastructure wakes. This old running row is the FIFO head.
- The running head has final assistant `msg_g019ff2936dd9000000000000gxKR4gIG5HZjdD`, completed at 2026-08-11 20:46:26Z, carrying the exact ingress identity and parented to `msg_orchestrator_control_art_g019ff290f7830000000000001xn9KHJeW0mDxp`.
- No process-local root-wake position can survive a backend process boundary. The current database row nevertheless remains `running`, so its physical owner is unavailable rather than known active.
- Backend PID 30464 started at 2026-08-12 02:27:19+08:00. Scheduler commit `b83e1bc8` was created at 04:26:38+08:00. The installed sidecar does not contain the exact-input/FIFO repair strings, while repository HEAD contains that commit. The incident therefore ran on the older binary.
- Worker Session `ses_-fe600da99684ffffffffffffE2p5pdaWWOiokE` emitted ContextOverflow and then failed with Session control `sctl_g019ff274bcfd000000000000nTg4cLXJqRzdAn` claiming different persisted semantics. The persisted row is a valid `compaction_request` whose payload contains only `source_user_message_id` and `overflow`.
- `SessionCompaction.create` constructs the same payload with `model: undefined` and `focus: undefined`. SQLite JSON serialization omits those properties, but `SessionControl.createInTransaction` compares the round-tripped object against the pre-serialization object with `isDeepStrictEqual`, producing the observed false conflict after the insert has committed.
- The later `ProcessorUnsafeRetryError` occurred after a provider connection failure once tool execution had begun. Refusing an in-message retry is the intended side-effect-safety contract; its infrastructure wake became pending and was blocked by the older running head.
- Ten historical Orchestrator occurrences retain `streaming` as their latest immutable protocol event. This is old-runtime evidence, not proof of ten live physical owners; the latest exact occurrence reached `idle`.

## Root causes and impact

1. The old deployed runtime contained the control-Message/physical-Turn race repaired by `b83e1bc8`, so it could finish an assistant without completing the wake transition.
2. Current source startup recovery can reconcile an ownerless `running` wake, but active admission and the loop completion path treat a `running` head with no process-local queue entry as already started or merely blocked. The durable state can therefore remain an absorbing same-runtime head until process restart, starving every later wake and the entire active Task.
3. Session control accepts values outside the persisted JSON domain. Optional `undefined` fields change shape across the SQLite boundary, and the post-insert equality check misclassifies serialization normalization as an identity collision. Any control writer with undefined-valued properties can fail after committing its row; automatic compaction is the confirmed production trigger.

Impact is project-workflow liveness rather than only presentation: the orphan head prevents lifecycle failures, completed reviews, and later scheduling decisions from reaching the Orchestrator. The control bug converts recoverable context overflow into a worker infrastructure failure and may duplicate higher-level work. The immutable historical `streaming` events make diagnosis noisier but are not rewritten or used as a second liveness authority.

## Repair design

- Extract one exact ownerless-running reconciliation primitive used by startup, active admission, and completion settlement. It first checks the process-local root-wake owner. With no owner, it validates and drains an exact durable final assistant; otherwise it conditionally returns the same row to `pending`. It never creates a replacement wake.
- Before active admission decides the FIFO head is blocked, reconcile its exact ownerless running head and then use the existing durable head/drain path. The completion hook applies the same reconciliation before advancing the Task or directory queue.
- Define Session control payload as a persisted JSON object. Optional compaction fields are omitted before creation. Invalid non-JSON values fail before the insert; equality is then between values in the same persistence domain.
- Preserve `ProcessorUnsafeRetryError`, historical protocol events, and strict FIFO. They are evidence/safety contracts, not causes to suppress.

## Verification ledger

- Focused ownerless-running/persisted-dispatch regressions through the isolated test host: `3 pass / 0 fail / 9 expect` after independent-review corrections; the original two incident regressions also passed together (`2 / 0 / 8`).
- Full `active-operator-wake-settlement.test.ts` before the review correction: `42 pass / 0 fail / 180 expect`. After adding the three persisted-dispatch cases, the full file produced `43 pass / 1 fail / 182 expect`; the sole failure was a Windows process-supervisor missing settlement marker in an existing terminal-checkpoint test, and its exact isolated rerun passed (`1 / 0 / 3`).
- Full `memory/session-memory.test.ts`: `10 pass / 0 fail / 31 expect`.
- `packages/opencorvus` TypeScript typecheck: passed.
- `git diff --check`: passed for the shared worktree.
- `docs:check`: currently blocked by concurrent, unrelated permission-API source changes whose regenerated `/interaction` and `/permission` tables have not yet been committed to the API reference.
- The first DeepSeek real Task-control run proved its 180-second activity deadline but stopped at an operator permission interaction. The checker now explicitly selects the product's canonical `permission_mode: full_access` for its isolated automated runtime. Its complete production-path rerun passed lifecycle convergence, live-worker progress, restart recovery, cancellation, checkpoint/auxiliary settlement, and zero surviving old processes; all six ingress rows finished as `drained` or cancellation `terminal_inapplicable`.
- The passed real run observed operator-progress ingress admission in `160.96 ms`, terminal cancellation in `10,468 ms`, completed checkpoint and auxiliary settlement Artifacts, and an empty final process-owner snapshot.
- Independent read-only review found one P1 in persisted-dispatch handling after reconciliation. The implementation now covers sole-head idempotent settlement, older pending-head physical reattachment when a younger wake is expected, and advancing a younger head when an older exact replay settles; all three focused corrections pass. Final re-review reports no unresolved findings.
