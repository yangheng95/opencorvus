# Orchestrator wake Turn serialization repair

## Recall

| Field | Recalled fact |
| --- | --- |
| User request | The previously repaired scheduler has stranded another real Task. Diagnose the supplied Debug Info as persisted evidence, repair the systemic scheduling defect, and prove the result rather than treating another stall as model latency. |
| Incident input | Debug bundle `opencorvus.debug.v2` for Task `tsk_g00VRzIXqH00UWPUwrlX`, rooted at `D:\myhexin-local\demos\long-absa-task`, plus read-only queries against the referenced SQLite database. |
| Qualified output | One root wake owns one exact visible input Message and one runtime-contract Turn until that Turn is physically back at standby/terminal; a failed older wake blocks later wake delivery; restart and same-runtime retry preserve that order; no occurrence remains `streaming` after its physical Turn settles. |
| Environment | Repository tests use `packages/opencorvus/script/run-tests.ts`. Real acceptance uses an isolated temporary database/project and the existing real Task-control checker with an activity-resetting inactivity timeout. No credentials or message/tool bodies enter diagnostics. |
| Acceptance | A deterministic regression reproduces both the standby race and the `delivery_failed` FIFO overtake, then proves exact Message parent/ingress binding, ordered wake disposition, and terminal/idle occurrence convergence. Focused scheduler tests, typecheck/build/docs checks, a real provider recovery run, and an uninvolved final read-only review must pass. |
| Hard constraints | Preserve the visible Orchestrator-authored control Message, exact durable wake identity, streaming LLM interaction, and one queue/runtime contract authority. Do not add a Host workflow gate, watchdog state machine, hidden/model-only message, replacement wake, or fallback scheduler. Do not touch the unrelated dirty Overlay/Web/icon worktree changes. Do not restart the user's application without explicit authorization. |
| Read before change | `specs/current/architecture/task-control-plane.md`; `2026-08-11-scheduler-liveness-and-control-convergence.md`; `2026-08-11-windows-worker-scheduler-liveness-convergence.md`; `orchestrator/agent.ts`; `engine/queue.ts`; `session/loop.ts`; `session/prompt/state.ts`; `session/runtime-contract.ts`; current focused scheduler tests. |
| Search/impact audit | Searched every control-Message constructor/caller, `reply_to_message_id`, root-wake queue and cancellation path, runtime-contract wake/claim/consume path, exact-terminal retry/reset path, queue selection and startup reconciliation, and execution-occurrence publication. |
| Independent agent input | State/protocol review confirmed that a typed wake carried only in system context is not a current visible input, required a durable Orchestrator-authored control Message, staged/armed runtime publication, exact input binding, and terminal error settlement. Recovery/FIFO review confirmed that every `delivery_failed` row must remain a durable head barrier, every active/startup/delayed path must use the same head selector, cancellation must terminalize failed heads, and already-overtaken history requires an explicit idempotent recovery fact rather than replay. |

## Observed facts

- The Task is durably `active` with four unaccepted Goals, no active Goal Session, no cancellation authority, and no terminal Task fact.
- The supplied projection contains 11 Orchestrator execution occurrences still reported `streaming`, despite completed assistant Messages and drained wake artifacts for those same historical epochs.
- For multiple lifecycle wakes, SQLite order is: an assistant tagged with the new wake's `taskIngress` but parented to the previous control Message; only afterward is the new visible control Message persisted. Later assistants are parented correctly.
- Wake `art_g019ff2102cf6000000000000N3lCqhMGn3Rdwy` reached `delivery_failed` after shutdown. Later wakes were allowed to drain. A later assistant tagged with that older wake was then parented to the newer control Message `msg_orchestrator_control_art_g019ff2149542000000000000sub1DVTpnvWdBs`.
- The incident log separately records a queued wake cancelled with an `untyped cancellation reason` and a `QueuedWakeSettlementError` claiming the returned assistant was not the final assistant for its invocation.
- The backend was not listening on port 7878 during this investigation. Runtime-local owners are therefore unavailable, not zero.

## Root-cause model

1. `Orchestrator.Agent.run` installs a `runOnce` runtime contract before persisting the exact visible control Message. Installing that contract wakes an already-standby Session loop immediately. The loop can begin a new assistant Turn against the previous durable user Message while stamping the new ingress identity.
2. `SessionPrompt.loop()` resolves its attached reply callback when the assistant reply is persisted, before the continuous Session loop has consumed the runtime wake and returned to standby. The Task root queue can therefore admit the next wake while the prior physical Turn is still crossing its settlement boundary.
3. `findNextPendingQueuedOperatorWake()` selects the oldest `pending` row but ignores an older `delivery_failed` row. During delayed exact-terminal retry, later wakes can overtake the failed durable head. Retrying the old control occurrence after a newer control Message exists cannot naturally make the old Message the conversation tail, producing ingress/parent drift.
4. The cancellation reason used by the root queue is structurally typed but recognized only with `instanceof`. The observed `untyped` failure is consistent with a duplicated module/realm prototype boundary; this remains a separate confirmed protocol-recognition defect until a structural contract test proves or falsifies it.

## Repair boundary

- Couple runtime-contract notification to the exact visible Message commit: install the contract without waking the standby loop, persist/strictly validate the Message, then publish the runtime wake. This is one atomic ownership handoff, not a second ingress.
- Keep the root wake's physical owner until the exact runtime contract Turn is consumed and the Session has returned to standby or terminated. The assistant receipt remains transport evidence; physical Turn settlement is a separate existing ownership fact.
- Treat the oldest nonterminal wake (`pending`, `running`, or `delivery_failed`) as the FIFO head. Only a `pending` head is claimable. A failed head retains recovery ownership and blocks younger delivery.
- Recognize `ExecutionCancellationError` by its strict named structural protocol as well as prototype identity, preserving exact origin validation across module/realm boundaries.
- For databases already containing an overtaken failed wake, do not silently claim semantic success or replay conflicting history. Under a quiescent exact-head precondition, atomically terminalize the failed occurrence with typed provenance evidence and create one idempotent `infrastructure_recovery` occurrence through the existing queue authority.

## Verification ledger

- `active-operator-wake-settlement.test.ts`: 41 passed, 0 failed, 175 assertions. This includes same-runtime exhausted-ingress retry, younger-wake head blocking and later ordered drain, startup recovery, failed-head cancellation, idempotent historical provenance-conflict convergence, and bounded settlement when post-commit housekeeping fails after an exact control Turn is armed on a persistent standby owner.
- `dispatch-agent-managed-lifecycle.test.ts`, `agent-runner-fresh-session-authority.test.ts`, `scheduler-event-durable-fire.test.ts`, `scheduler-claim-and-fire-identity.test.ts`, and `task-queue-child-progress.test.ts`: 72 passed, 0 failed, 289 assertions. This rechecks lifecycle delivery, Event fire lease recovery, shared project concurrency, Automation ownership, and coalesced Task Queue progress.
- `orchestrator-control-message.test.ts` plus `execution-cancellation-protocol.test.ts`: 3 passed, 0 failed, 11 assertions. The control Message is visible, deterministic and reused; its runtime arm effect precedes Message visibility; strict cancellation identity survives a structured module/realm clone.
- `bun run docs:check`: passed with 331 operations in 25 groups.
- Package typecheck initially exposed a stale local `@opencorvus-ai/sdk/dist` declaration that lacked the already-committed `cost.available` field. Rebuilding the SDK repaired the local toolchain; the original package typecheck then passed (`TYPECHECK_OK`).
- Real DeepSeek Task-control checker: passed. The run exercised both `pending_ingress` and `pending_cancellation` restart phases; every accepted ingress became `drained` or `terminal_inapplicable`, terminal cancellation was emitted once within 10,590 ms, checkpoint and auxiliary settlement completed, no old child PID survived, and final process ownership was `live: 0`.
- Independent final read-only review: no unresolved findings. The reviewer specifically rechecked exact visible control-Message binding, staged/armed wake publication, physical Turn settlement, durable FIFO recovery, cancellation identity, and the final post-commit housekeeping failure regression.
