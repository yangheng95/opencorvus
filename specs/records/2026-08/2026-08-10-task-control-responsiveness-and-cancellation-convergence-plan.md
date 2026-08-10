# Task control responsiveness and cancellation convergence repair plan

Status: proposed; investigation and implementation plan only. No product-code change is included in this record.

## Recall

### User requirements

- Explain why Task `tsk_g019fea125899000000000000J9GV1xoNAPUe46` accepted an operator message but produced no response.
- Trace the other incorrect control-flow and state-projection logic instead of stopping at the first symptom.
- Explain why repeated clicks on Cancel had no visible effect.
- Produce a root-cause repair plan, not a keyword patch, hidden acknowledgement, fallback path, or User Interface-only workaround.

### Acceptance metrics

- A task-level operator message is persisted once, immediately receives one truthful durable ingress receipt, and never reports `started` before its Orchestrator Turn actually begins.
- A long-running worker cannot retain the root Orchestrator prompt owner. When no earlier operator ingress owns the root control actor and only detached workers are active, a new operator ingress must acquire that owner and project `running` through Server-Sent Events (SSE) within 2 seconds. If an earlier operator ingress owns it, later ingresses remain truthfully `queued` with queue position/current owner and preserve first-in-first-out order; each must reach `running` within 2 seconds after its predecessor releases the owner. Real model output uses an activity-aware inactivity Service Level Agreement (SLA) and records time to first delta; it is not subject to an external-network wall-clock threshold.
- Status/progress questions may settle through an exact `read_task_message` plus a real visible assistant response; no host gate may require an unrelated scheduler mutation.
- Multiple operator messages are delivered in durable first-in-first-out order, each with one visible lifecycle: `queued -> running -> delivered`, or an exact terminal disposition tied to cancellation/failure.
- The first Cancel click durably records one canonical request and returns an accepted/cancelling receipt within 1 second. Repeated clicks reuse that request and do not append duplicate cancellation-request events.
- Cancellation stops the root prompt, descendant prompts, tool executions, scheduled wakes, and task-owned mutating processes exactly once. The Task reaches `cancelled` within 15 seconds in the real Windows Language Server Protocol (LSP) regression case.
- An auxiliary LSP stream-close defect cannot prevent the Task cancellation terminal event. Any final-checkpoint failure remains explicit durable evidence and never leaves an execution-stopped Task projected as active.
- Backend restart resumes a pending cancellation or pending ingress from its single durable authority without creating a second request or message.
- The real Overlay shows queued/running/delivered message state and cancelling/cancelled Task state from server facts. User Interface (UI) acceptance uses real interaction, screenshots, and manual visual review only; no UI automation is added or run.

### Hard constraints

- Preserve real user, Orchestrator, agent, and tool/result messages; do not synthesize assistant acknowledgements.
- Preserve streaming Large Language Model (LLM) interaction.
- Do not introduce a host workflow state machine, compatibility layer, dual read/write path, or hidden message channel.
- Use one current ingress authority and one cancellation authority. Historical records may remain immutable evidence but must not remain a current projection source.
- Focused non-UI tests must assert positive state/output contracts. The final checker must exercise the real server, database, streaming path, Windows process supervisor, LSP, Git checkpoint, and Overlay.

### Read evidence

- User-provided Task debug snapshots in the current conversation.
- `C:\Users\hengu\AppData\Local\opencorvus\log\2026-08-10T061206-25620-1.log`.
- `C:\Users\hengu\AppData\Local\opencorvus\data\opencorvus.db` (read-only queries).
- `packages/opencorvus/src/engine/queue.ts`.
- `packages/opencorvus/src/session/prompt/state.ts`.
- `packages/opencorvus/src/task-api/index.ts`.
- `packages/opencorvus/src/engine/state.ts`.
- `packages/opencorvus/src/engine/git.ts`.
- `packages/opencorvus/src/shell/process-supervisor.ts`.
- `packages/opencorvus/native/process-supervisor/src/main.rs`.
- `packages/opencorvus/src/lsp/client.ts`, `packages/opencorvus/src/lsp/index.ts`, and `packages/opencorvus/src/lsp/server.ts`.
- `packages/opencorvus/src/orchestrator/dispatch-agent-tool.ts`, `build-tool.ts`, `delegated-worker-tool.ts`, and `agent.ts`.
- `packages/opencorvus/src/server/routes/orchestrator.ts`.
- `packages/overlay/src/services/chat.ts`, `task.ts`, and `task-cancellation.ts`; `packages/overlay/src/main.tsx`.
- `packages/opencorvus/test/active-operator-wake-settlement.test.ts`, `lsp-initialize-lifecycle.test.ts`, and `process-authority-runtime.test.ts`.
- `specs/current/architecture/task-runtime-directory.md`.
- `specs/records/2026-08/2026-08-09-backend-algorithm-test-loop.md`.
- `specs/records/2026-08/2026-08-09-mission-random-port-e2e-loop.md`, including the earlier Pyright LSP disposal incident and F07/M08 wake-settlement work.

### Full-repository search results

- `dispatchTaskLoop`, `enqueueRootWake`, `queued_operator_wake`, `operator_message_wake`, `TaskMessageResult`, `wake_status`, and all Overlay consumers were searched.
- `cancelTask`, `task.cancellation.requested`, `task.cancelled`, `terminalTask`, `withTaskCheckpointLease`, every Task-cancel route/caller, and generated Software Development Kit (SDK) contracts were searched.
- Process-supervisor disposal, Windows native-helper readiness/job/kill-tree behavior, LSP spawning/disposal, and their focused tests were searched.
- The current architecture directory contains Task runtime-directory authority but no current scheduler/control-plane architecture. This repair must add that current architecture record when implemented.

### Independent agent feedback

Read-only reviewer `/root/review_task_control_plan` found four valid issues, all incorporated before delivery:

- the ignored new spec had to be explicitly included in Git so the two index links could not become broken;
- the 2-second threshold had to cover host-controlled ingress/prompt-owner/SSE transition rather than external-model response time;
- terminal cancellation had to depend only on the mandatory execution-stop barrier, with LSP cleanup and Git checkpointing moved to durable non-blocking post-terminal settlement;
- `agent.execution.lifecycle` had to remain the only child-terminal truth, with terminal ingress defined only as an event-ID-keyed reconstructible delivery record.

## Incident reconstruction

All times below are Coordinated Universal Time (UTC).

1. At `06:55:02`, `POST /task/tsk_g019fea125899000000000000J9GV1xoNAPUe46/message` returned HTTP 200. The exact visible user message was persisted as `msg_g019fea740da8000000000000sh9xeLANFGajwX`.
2. The same transaction family created `queued_operator_wake` artifact `art_g019fea740db70000000000008cj97ILPkkNuOo` as `pending`, while a second `operator_message_wake` artifact permanently claimed `started`.
3. The root Session already owned a long Orchestrator Turn whose `dispatch_agent` execution synchronously awaited the implementation worker. `SessionPromptState.enqueueRootWake` chained the new wake behind that owner. No new Orchestrator Turn began and no assistant response was produced.
4. At `07:05:35`, the first Cancel request reached the backend. It cancelled the implementation and Orchestrator prompts, produced an `OrchestratorAborted` artifact, and changed the pending operator wake to `discarded`.
5. Terminal cancellation then called `terminalTask`, which unconditionally attempted a final Git checkpoint. Checkpoint preflight called `ProcessSupervisor.withTaskCheckpointLease`, which attempted to dispose every task-owned process, including LSP target PID `22712`.
6. Disposal exceeded the hard-coded 5,000 ms cleanup window and the 1,000 ms exit window. The route returned HTTP 500 after 6,319 ms. Two later clicks repeated the same sequence; the database now contains three `task.cancellation.requested` events and no `task.cancelled` event.
7. A read-only operating-system process query no longer found PID `22712`, but the supervisor still treated its handle as unsettled. The Task row remained active with no `time_completed`, even though its execution prompts had stopped and its pending operator message had been discarded.

## Confirmed defects

### C01 — accepted, queued, and running are conflated

For an already-active Task, `dispatchTaskLoop` calls `beforeAcceptedWake` with `started` before `launchTaskLoop` can acquire the serialized root queue. `appendAndWakeTaskOperatorMessage` persists that claim in a separate `operator_message_wake` artifact. In this incident the real ingress remained pending for more than ten minutes, so `started` was false at write time.

Impact:

- HTTP response, debug info, database artifacts, and UI meaning disagree.
- The permanent `operator_message_wake=started` record later contradicted `queued_operator_wake=discarded`.
- The client ignores the distinction and has no truthful pending/running message state to render.

### C02 — a synchronous worker monopolizes the root Orchestrator Turn

`dispatch_agent` awaits its adapter, and the build/delegated-worker adapters await the complete child agent run. The Orchestrator Turn therefore owns the root wake queue for the worker's entire duration. Durable operator wakes are serialized behind it.

This is head-of-line blocking at the wrong ownership boundary: a child worker occurrence and the root control conversation are different actors but currently share one physical completion lifetime.

### C03 — wake settlement is a host scheduling gate, not a conversation contract

The F07 settlement checker requires the exact `read_task_message` call followed by a host-recognized scheduler decision effect. That prevents a natural progress/status answer from being a valid delivery and teaches the LLM workflow through a host gate. It also turns a real assistant response into `delivery_failed` when no dispatch mutation was appropriate.

The current positive contract should instead be: exact input was read, a real Orchestrator Turn completed, and its visible assistant output or typed interaction/tool outcome is durably linked to that input occurrence.

### C04 — ingress has two current facts

`queued_operator_wake` is the delivery mechanism and `operator_message_wake` separately records a claimed wake status. Their labels evolve independently. This violates the repository's single-source rule and directly created contradictory incident evidence.

### C05 — cancellation is request-scoped instead of durably owned

`cancelTask` performs the entire convergence synchronously inside the HTTP request. If any late step fails, the request returns 500 and no durable owner resumes convergence. A backend restart has the same gap.

### C06 — repeated Cancel is not idempotent

Every click emits a fresh `task.cancellation.requested` event before looking for an existing pending or terminal cancellation occurrence. Three clicks produced three request events for one user intent.

### C07 — cancellation terminal truth is coupled to Git checkpoint success

`terminalTask` requires `EngineGit.prepare` and `EngineGit.complete` to succeed before writing any terminal status, including `cancelled`. A checkpoint infrastructure failure therefore overwrites the more important truth that prompt execution has already stopped.

Cancellation still needs an exact partial-work checkpoint outcome, but checkpoint success cannot be the condition for representing an already-converged cancellation.

### C08 — checkpoint quiescence and auxiliary-service cleanup are conflated

`withTaskCheckpointLease` disposes every task-owned supervised process without a typed capability distinction. A read/diagnostic LSP is treated like a workspace-mutating command and can block the final repository snapshot and Task terminal event.

The same Pyright/Windows disposal path had already blocked `apply_patch` in the 2026-08-09 benchmark. Disabling LSP in that benchmark was an operational recovery, not a root fix.

### C09 — Windows process exit is coupled to stream close

The JavaScript child handle records process exit on the `exit` event but resolves its public `exited` promise only on `close`. On Windows, the native helper waits for the target process while target descendants can inherit output handles. The physical target can be gone while inherited streams keep `close` pending. `disposeAndWaitForExit` then reports a live-process failure from an unsettled stream lifecycle.

Process liveness, process-tree ownership, and output-stream completion need distinct terminal facts. A stream-close defect must remain visible, but must not falsify process liveness.

### C10 — failed cancellation releases its safety barrier

`beginRootSessionDestructiveScope` is always closed in `finally`, including when terminal checkpointing fails. The Task is then still projected active and may accept new work even though cancellation request events exist and the prior execution tree was destroyed.

### C11 — queued input is destructively discarded before cancellation commits

`discardQueuedTaskEvent` runs near the start of cancellation. If a later step fails, the Task returns to an active-looking state but the operator message is already `discarded`. The disposition is not causally linked to the cancellation request and is not shown next to the visible user message.

### C12 — no pending-cancellation projection exists

The current projection only understands a complete `task.cancellation.requested -> task.cancelled` chain. While convergence is pending or failed, the Task row remains active. The Overlay therefore keeps showing an interruptible active Task and invites more Cancel clicks.

### C13 — timeout names and semantics disagree

`waitForRootWakeQueueIdle` accepts an `inactivityTimeoutMs` parameter but implements one non-resetting wall-clock timer. Process cleanup uses fixed 5,000/1,000 ms wall-clock limits. Neither observes meaningful progress. This produces false failure during slow cleanup and provides no useful inactivity receipt.

### C14 — operator control activity does not update the Task's visible activity authority

The operator message and cancellation request events do not advance the Task row's `time_updated`. Work can therefore look old or unrelated to the newest user action, while child streaming activity masks an undelivered root message.

### C15 — errors lose the actionable contract at the UI boundary

The cancel route declares typed 409 responses, but the checkpoint failure is an untyped Error and becomes a generic HTTP 500. The Overlay reports only “Internal server error” even though the server has exact process/checkpoint evidence.

## Why the previous repairs did not solve this incident

- F06 repaired created-only Session lineage; it did not change the synchronous lifetime of a committed `dispatch_agent` call.
- F07 repaired false drain after a wake ran; it did not make a queued wake start promptly, and its scheduler-decision gate rejects legitimate conversational replies.
- M08 added activity-aware waiting to benchmark orchestration, but the root wake queue and process supervisor still use non-resetting wall-clock waits.
- The earlier Pyright recovery disabled LSP for one formal environment. The production disposal contract remained unchanged, so the same defect resurfaced during cancellation.

## Target control architecture

### 1. One durable ingress occurrence

Retain one current durable ingress record and remove `operator_message_wake` as a current writer/projection. The ingress carries:

- immutable identity: Task, root Session, exact user message, source, enqueue time;
- mutable delivery state: `queued`, `running`, `delivered`, `cancelled`, or `failed`;
- timestamps and exact owning Orchestrator execution occurrence;
- terminal linkage to the visible assistant message, typed interaction, cancellation request, or typed failure.

The POST route returns HTTP 202 with this persisted receipt. It never predicts that execution has started. Server-Sent Events (SSE) project later state transitions from the same record.

### 2. Actor-style asynchronous worker dispatch

Change `dispatch_agent` from “wait for the whole child run” to “commit and start one child execution occurrence, then return its real dispatch receipt.” The root Orchestrator Turn releases after its scheduling response. Child streaming continues in its own Session.

Child terminal lifecycle is already durable through dispatch lineage and `agent.execution.lifecycle`, which remains the only child-terminal truth. Add an event-ID-keyed, idempotent, reconstructible delivery ingress that wakes the root Orchestrator to inspect that exact lifecycle event and make the next scheduling decision. The ingress cannot store or project an independently evolving child status. Recovery rebuilds missing delivery from the lifecycle event and reconciles a committed nonterminal dispatch occurrence after restart.

Do not add polling or a parallel legacy synchronous adapter. Replace the current adapter/output contract and update all projected adapters, prompt text, tool schemas, generated SDKs, and callers together.

### 3. Conversation delivery, not mutation-gated settlement

Replace the F07 decision-effect heuristic with occurrence linkage:

- the Orchestrator reads the exact user message;
- the same Orchestrator execution occurrence emits a real visible assistant response, typed interaction, or explicit tool result;
- the ingress links to that terminal output.

Scheduler mutations remain ordinary visible tool calls when appropriate, but are not mandatory for a status question.

### 4. Durable idempotent cancellation occurrence

The first Cancel request atomically finds-or-creates one pending cancellation occurrence. The route returns its receipt immediately. Repeated calls return the same receipt. A call against an already-cancelled Task returns the completed receipt; a call against a differently terminal Task returns one typed conflict.

A background cancellation reconciler, driven by the durable occurrence and recoverable after restart, owns one mandatory terminal sequence:

1. hold the root destructive scope for the entire pending occurrence;
2. terminally dispose queued ingresses as `cancelled` with causation links instead of a generic early discard;
3. cancel root and descendant prompt/tool occurrences and scheduled waits;
4. quiesce task-owned workspace mutators and execution capsules;
5. atomically write exactly one causally linked `task.cancelled` event once executable work is proven stopped;
6. release the destructive scope.

After that terminal commit, two durable, independently recoverable settlement jobs own auxiliary LSP cleanup and the partial-work Git checkpoint. Each job has an activity-aware inactivity boundary and must persist one exact success/failure/blocker receipt. Neither job can delay or reverse `task.cancelled`; managed worktree release waits for the checkpoint receipt, while unrelated auxiliary cleanup cannot retain workspace authority. This is one ordered cancellation contract, not a fallback terminal path.

If executable work genuinely cannot be stopped, the occurrence remains visibly `cancelling` with an exact typed blocker and retry ownership. It must not project as active. Auxiliary cleanup or checkpoint failure is recorded but cannot reverse proven execution cancellation.

### 5. Separate process, process-tree, and stream settlement

Repair the Windows supervisor contract at the lowest common layer:

- `exited` resolves from the owned process/helper terminal event, not from output-stream `close`;
- output-stream completion/error has a separate observable promise/receipt;
- Windows job/process-tree termination is explicitly verified against the owned target/tree;
- disposal is idempotent under concurrent logical-owner and checkpoint calls;
- timed waits are activity-aware and report last progress plus exact remaining owned PIDs/handles;
- supervisor ownership uses a closed typed role/capability instead of the free-form `owner` string when checkpoint quiescence is decided.

LSP logical shutdown remains owned by the LSP client. The process supervisor remains the single physical process-tree authority. The checkpoint lease requests quiescence by mutating capability, rather than directly treating every auxiliary process as a workspace writer.

### 6. Truthful UI projections

- Project `cancelling` from a canonical pending cancellation occurrence; do not add a second persisted Task status.
- Disable repeated destructive actions while the same occurrence is pending, but keep its exact blocker/age visible.
- Render ingress state beside the real user message. Do not create a fake assistant bubble.
- Update Task activity from the committed message/cancellation event transaction so the newest operator control is not hidden by unrelated child activity.
- Surface typed cancellation/checkpoint/process receipts instead of a generic 500.

## Implementation sequence

### Phase A — freeze the failing contracts in focused backend tests

- Add a root-wake contention test that holds the first root Turn open and proves a second ingress is `queued`, not `started`.
- Add an ingress FIFO test with two exact visible messages and one lifecycle per message.
- Add a progress-question settlement test whose correct output is a visible assistant answer with no scheduler mutation.
- Add cancellation idempotency and pending-projection tests.
- Add a cancellation/checkpoint failure test that proves execution-stopped cancellation reaches one explicit terminal outcome with the checkpoint failure attached.

These are positive current-contract tests; retire the existing decision-effect tests whose primary assertion is rejection of prose/no mutation.

### Phase B — repair Windows/LSP process settlement

- Split process exit from stream completion in `process-supervisor.ts`.
- Add a Windows-native regression fixture in which a supervised target/descendant retains inherited output handles while the owned target exits.
- Make disposal concurrency idempotent and add progress receipts.
- Introduce typed process capabilities and update every spawn call found by the repository-wide search.
- Update LSP lifecycle cleanup and checkpoint quiescence to use the single physical owner.
- Prove a live Task-owned LSP is reclaimed without blocking a checkpoint.

### Phase C — replace ingress dual state and false `started`

- Extend the existing durable queued ingress as the sole current lifecycle authority.
- Remove the `operator_message_wake` writer and all current projections/tests that consume it.
- Change Task message and operator-steer HTTP contracts to return a persisted accepted receipt, then stream `running` and terminal delivery updates. With no earlier ingress owner, host-controlled accepted-to-running projection must meet the 2-second threshold; otherwise the receipt exposes queue position/current owner and must transition within 2 seconds after the preceding ingress releases that owner. Model time-to-first-delta is measured under an activity-resetting inactivity SLA.
- Remove `should_resume` and the predicted `started` response from current API/SDK/Overlay contracts.
- Advance Task activity in the same transaction that records message/event/ingress facts.

### Phase D — detach child execution from the root control Turn

- Replace every synchronous dispatch adapter output with a committed dispatch receipt.
- Start child Session execution under durable dispatch-lineage ownership outside the root prompt lifetime.
- Convert each canonical child terminal lifecycle event into one event-ID-keyed, reconstructible root delivery ingress without copying child status authority.
- Reconcile committed nonterminal dispatches on startup.
- Update Orchestrator context/prompt/tool definitions so the model reasons from real child lifecycle facts without a host workflow gate.
- Remove obsolete synchronous wait code and tests in the same change; do not retain a compatibility path.

### Phase E — durable cancellation convergence

- Add find-or-create cancellation occurrence and pending projection.
- Move convergence out of the HTTP request into one recoverable owner.
- Keep the destructive scope active until terminal/blocker resolution.
- Causally terminalize queued ingress instead of discarding it early.
- Make cancelled-task terminal truth depend only on the mandatory execution-stop barrier, then settle auxiliary cleanup and the final-checkpoint receipt as durable post-terminal jobs.
- Return typed accepted/completed/conflict receipts and regenerate OpenAPI/SDK outputs.
- Update every cancel caller: Overlay composer stop, Work Ledger, task tool, Mission/project deletion, archive/delete flows, and session cancellation boundaries.

### Phase F — Overlay and current architecture

- Render ingress and cancellation projections from SSE/server state.
- Remove generic “started” wording and repeated-click behavior.
- Add `specs/current/architecture/task-control-plane.md` as the current single source for ingress, dispatch, cancellation, process quiescence, checkpoint ordering, and restart recovery.
- Update architecture/spec indexes and generated API documentation.

## Verification matrix

### Focused non-UI checks

- Task ingress lifecycle and FIFO tests.
- Root-wake contention and progress-response tests.
- Asynchronous dispatch/child-terminal wake/restart-reconciliation tests.
- Cancellation find-or-create, pending projection, convergence, blocker, and checkpoint-receipt tests.
- Windows supervisor exit-versus-stream-close and process-tree verification tests.
- LSP live-checkpoint and concurrent-disposal tests.
- Route schema and generated SDK checks.
- Relevant lint, typecheck, build, and `bun run docs:check`.

### Real end-to-end checker

Create one repository-owned task-control checker using an operating-system-assigned loopback port and isolated OpenCorvus home/database/project. It must:

1. start a real streaming Orchestrator and dispatch a deliberately long-running real worker;
2. submit a task-level progress question while the child is still running;
3. with no earlier operator ingress owning the root actor, prove the message receipt is initially queued/accepted, reaches `running` through SSE within 2 seconds, emits real streaming model activity without exceeding the configured activity-resetting inactivity SLA, and the child remains independently live;
4. start a real Task-owned LSP and preserve a descendant/inherited-stream condition matching the incident;
5. issue Cancel once, require an accepted/cancelling receipt within 1 second, and issue a duplicate request that returns the same cancellation identity;
6. observe through SSE until one `task.cancelled` event arrives within 15 seconds;
7. assert one cancellation request, one terminal cancellation event, one terminal disposition for every queued ingress, no owned mutating process, and an explicit final-checkpoint receipt;
8. restart the backend at a controlled pending-ingress and pending-cancellation checkpoint in separate runs and prove exact recovery without duplicate facts.

The checker uses activity-aware inactivity windows and records last activity, event IDs, message IDs, process identities, checkpoint receipts, and timings. Mock/stub results may support focused tests but cannot satisfy this checker.

### Real UI acceptance

- Open the actual Overlay against the isolated checker server.
- While a worker runs, send a progress question and visually verify the real user message transitions from queued/running to delivered, followed by a real assistant response.
- Click Cancel once and visually verify immediate `cancelling`, disabled duplicate action, exact detail access, then `cancelled`.
- Capture and manually inspect desktop screenshots for both states.
- Do not add, modify, or run UI automation, DOM assertions, snapshots, Playwright tests, or pixel baselines.

## Risks and controls

- Asynchronous dispatch changes every adapter contract. Control this with a single cutover, full definition/call-site search, generated SDK refresh, and deletion of synchronous outputs in the same commit.
- Background ownership can hide failures if not durable. Child start, terminal, and recovery must all be lineage-bound before the root Turn releases.
- Separating stream close from process exit can truncate output if consumers use the wrong fact. Preserve a separate output-settlement receipt and make output-collecting commands await it; cancellation/checkpoint liveness waits only for owned process-tree exit.
- Terminal cancellation with a failed checkpoint can lose the convenient committed snapshot, not the files themselves. Persist exact repository authority, dirty state, checkpoint error/recovery receipt, and expose it as cancellation evidence.
- Existing historical `operator_message_wake` artifacts remain immutable history. Remove them only from current writing/projection; do not add a dual-read compatibility path.

## Definition of done

- All confirmed defects C01-C15 are mapped to a code/test/document change or explicitly disproved with new evidence.
- Focused checks pass and the real task-control checker meets every timing and cardinality threshold.
- Real Overlay screenshots have been viewed and accepted manually.
- An independent agent that did not implement the repair performs a read-only review of the complete diff, tests, checker evidence, documentation, and regression risks. Every valid finding is fixed and the relevant verification/review cycle repeats until no findings remain.
- The final worktree contains no unrelated changes; the repair is committed in a focused commit and pushed only after the upstream commit-set safety check required by `AGENTS.md`.
