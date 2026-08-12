# Mission, Task, and scheduler duplex communication convergence

## Recall

### User request

The user reported that a Mission could not intervene in a running Task, both communication directions were incomplete, and schedulers could not communicate. The requested delivery is a complete refactor in a new worktree, real end-to-end verification, and an independent Agent acting as a hard gate against incomplete or defective delivery.

### Acceptance

- A Mission message to an active child Task is persisted as a real Mission-authored message with exact Mission, Session, source Message, Tool call, and Tool Part provenance.
- The Task Orchestrator can send a nonterminal request to the owning Mission and receive one correlated reply.
- Authorized schedulers can exchange typed request, reply, and notification deliveries without fabricating operator/user messages.
- Every delivery has one durable event, one exact recipient inbox occurrence, stable correlation, FIFO ordering per recipient, idempotent producer replay, lease-based claim, recovery, and typed terminal disposition.
- Task terminal notification to Mission is committed durably with the terminal transition and does not depend on a process-local protocol subscriber.
- Prompt, schema, tools, architecture, Server-Sent Events, hydration, and diagnostics describe the same current protocol.
- Focused positive tests, schema migration checks, typecheck, route/schema checks when applicable, and a real-provider end-to-end run pass.
- An Agent that did not implement the change reviews the complete diff and evidence. Any valid finding blocks delivery until fixed and re-reviewed.

### Hard constraints

- Work only in `D:\myhexin-local\opencorvus-mission-task-duplex` on `codex/mission-task-duplex`.
- Preserve the original dirty worktree and all parallel work.
- Keep one current protocol and one fact source; no fallback, compatibility writer, double read/write, hidden message, or Mission-as-operator path.
- All Large Language Model interaction remains streaming.
- The Host validates identity, lineage, reply ownership, ordering, and irreversible-operation authority; it does not classify prose or choose model workflow.
- Message/Part rows remain the single body source. Delivery records reference them and do not copy a second message body.
- No User Interface automation tests. If a User Interface surface changes, acceptance is real-page interaction and manual screenshot review.
- Do not use the root `bun test`; run package-scoped focused checks.

### Baseline and ownership

- Clean implementation worktree: `D:\myhexin-local\opencorvus-mission-task-duplex`.
- Branch: `codex/mission-task-duplex`.
- Baseline: `822a59477494b2e709c5698de1df8cc2d82bc6f2`, equal to `origin/main` when this plan was frozen.
- The original `D:\myhexin-local\opencorvus` worktree is dirty with unrelated and overlapping work and is not an implementation source.
- Owned paths are the protocol schema/store/delivery implementation, schema migration, Task/Mission/scheduler integration, focused non-UI tests, current architecture, and this record. Any new overlap discovered before delivery must be rechecked against current `origin/main`.

### Read material

- `AGENTS.md`
- `specs/current/architecture/task-control-plane.md`
- `specs/current/architecture/README.md`
- `packages/opencorvus/src/protocol/{schema,protocol.sql,store}.ts`
- `packages/opencorvus/src/task-api/index.ts`
- `packages/opencorvus/src/engine/{queue,queued-task-ingress,agent-coordination,state}.ts`
- `packages/opencorvus/src/session/wake.ts`
- `packages/opencorvus/src/tool/panel.ts`
- `packages/opencorvus/src/panel/capability.ts`
- `packages/opencorvus/src/orchestrator/{event,tools,agent}.ts`
- `packages/opencorvus/src/project/bootstrap.ts`
- `packages/opencorvus/src/storage/schema-migration.ts`

### Repository-wide search results

- `panel.send_task_message` calls the public Task operator-message writer, persists `kind=operator`, and serializes the participant as `author=user`.
- The Mission branch does not perform the lineage-authority validation used by Mission acceptance resume and drops the exact ingress receipt.
- Task-to-Mission communication exists only for terminal status. A process-local `ProtocolStore.subscribeEvents` callback calls `SessionWake.wake` after the terminal transaction.
- `protocol_inbox` already has pending/leased/delivered/dead-letter, lease, attempt, visibility, and error fields, but no production Store API or bootstrap consumer.
- Task Orchestrator has no Mission or sibling-scheduler send/reply tool. Existing worker coordination is Task-local.
- Startup recovery can create both lifecycle and coordination wakes for the same worker handoff because the two paths use different causal identities.
- The Orchestrator prompt describes a `continue` coordination decision that is absent from the tool schema; the current persistent continuation contract is `redispatch` followed by explicit `dispatch_agent` continuation.

### Independent Agent feedback before implementation

Three read-only reviews agreed that this is a protocol-boundary defect, not an isolated wake bug. The reviews required typed scheduler addresses, lineage authority, a durable inbox/outbox occurrence, request/reply correlation, database-owned recovery, and removal of the old Mission-as-operator and terminal-subscriber paths. One review specifically confirmed the startup double-wake construction. Another confirmed that `protocol_event + protocol_inbox` is the smallest valid single fact source and that the durable Bus should be used only as an algorithm reference, not as a second scheduler outbox.

## Current failure chain

### Mission intervention

`Mission panel.send_task_message -> EngineService.handleTaskMessage -> continueTaskMessage -> appendAndWakeTaskOperatorMessage -> Task root Message(kind=operator, author=user)`.

The sender's Mission identity and call occurrence are lost. There is no stable reply target or pending-request owner.

### Terminal notification

`Task terminal transaction -> protocol_event commit -> process-local subscriber -> SessionWake.wake(Mission)`.

A crash between the first and second steps leaves no durable owed-delivery record. Re-execution has no deterministic Mission wake identity and can duplicate the notification.

### Worker handoff recovery

The same handoff can create a lifecycle delivery keyed by lifecycle event ID and a coordination delivery keyed by request ID. Startup restores each independently and may run two Orchestrator Turns.

## Current protocol

### Scheduler endpoints

The canonical endpoint union is:

- Mission scheduler: project ID, Mission ID, Mission Session ID.
- Task scheduler: project ID, Task ID, Task root Session ID.
`protocol_inbox.actor=session` is used for Mission recipients and `actor=task` for Task scheduler recipients. Source and target strings are generated and parsed only through the typed endpoint codec. Projected workers remain Task-owned execution identities and are deliberately not a third scheduler-message endpoint.

### Envelope and delivery

`protocol_event` is the immutable envelope and causal audit fact. `protocol_inbox` is the one exact recipient-delivery occurrence. No additional scheduler outbox table is introduced.

The envelope carries:

- request, reply, or notification kind;
- typed source and target endpoints;
- stable invocation/correlation identity;
- causation and `reply_to` identity;
- exact source Message and Tool Part references;
- a bounded typed payload containing locators and transport metadata, not a duplicate body.

The inbox lifecycle is `pending -> leased -> delivered | dead_letter`. Target ingress and visible Message identities are persisted in the delivery receipt. Delivered means a durable recipient scheduler ingress exists; it does not mean the model has answered.

### Producer transaction

One producer transaction validates the real participant Message/domain fact and writes the protocol event, recipient inbox occurrence, and request/reply authority. The recipient consumer claims the durable FIFO head and atomically writes the visible target Message, recipient ingress, and delivery receipt. A post-commit effect may request draining, but loss of that effect cannot lose work because startup discovers every incomplete row, rebuilds the next durable due-time timer, and later claims pending or expired-leased heads.

### Consumer ownership

The recipient head is claimed in an immediate writer transaction. Claim, renewal, reschedule, delivery, and dead-letter transitions require the exact lease owner. FIFO is allocated by a database-owned recipient sequence, never only by an in-process lock; Task ingress carries that same sequence through restart recovery. Source body is re-read from the exact Message/Part or terminal event and checked against its envelope digest before materialization.

### Authorization

- Mission can address only a Task in its exact persisted Mission lineage.
- Task scheduler can address only its owning Mission or an authorized sibling Task scheduler.
- Sibling scheduling requires the same project and owning Mission lineage. It carries no lifecycle, artifact, or worker authority transfer.
- Reply source and target must exactly reverse the pending request, and `reply_to` plus correlation must match.
- Ordinary communication never reopens a terminal Task.
- Physical Task/Session deletion first writes a typed dead-letter disposition and detaches retained protocol audit events from the row being deleted, so foreign-key cascade cannot erase the communication occurrence.

### Natural messages

The actual sender authors the visible message. Mission messages remain `role=user, author=mission`; scheduler replies remain real assistant/model output and are delivered to the recipient as a runtime-authored visible ingress with complete sender provenance. No synthetic operator or hidden assistant acknowledgement is introduced.

## Replacement plan

1. Add strict endpoint, scheduler-envelope, request/reply, and receipt schemas.
2. Implement `protocol_inbox` enqueue, read, claim, renew, reschedule, settle, dead-letter, reply, and startup-resume APIs.
3. Add the schema/index migration and migration preservation tests.
4. Replace Mission `send_task_message` with Mission-authored durable Task ingress and an exact receipt.
5. Add Task Orchestrator send/reply tools for owning Mission and same-Mission scheduler peers.
6. Add Mission reply/read actions using the same envelope and request authority.
7. Replace terminal subscriber delivery with a terminal-transaction-created durable notification.
8. Correct prompt/tool/document drift to the one current scheduler-message contract.
9. Project the same delivery facts through events, hydration, diagnostics, and any API/SDK surfaces touched by the implementation.
10. Delete obsolete writers and recovery paths after the new writer is active; do not retain compatibility fallbacks.

## Verification matrix

### Focused positive contracts

1. Mission to active child Task persists `author=mission`, exact provenance, one inbox, one Task ingress, and one provider Turn.
2. Mission to a foreign or non-Mission Task returns a typed authority error before any write.
3. Replaying the same Mission Tool call returns the same event, inbox, Message, and ingress identities.
4. Task sends a request to Mission; Mission reply reverses endpoints, resolves the exact request, and wakes the same Task exactly once.
5. Same-Mission Task A to Task B request/reply preserves FIFO and correlation; cross-Mission and cross-project targets fail before writes.
6. Terminal Task notification is created in the terminal transaction, survives restart at every delivery cut, and is logically delivered once.
7. Pending and expired-leased inbox rows resume on bootstrap; a persisted target ingress is reconciled instead of duplicated.
8. Cancellation and deletion terminalize or dead-letter affected pending delivery with a visible typed reason.
9. Concurrent writers to one recipient receive a database-owned total order without duplicate sequence or lost messages.
10. Request reply is single-owner; replay returns the same reply, while mismatched content or endpoint raises a typed conflict.
11. Conversation and diagnostic projections expose the same endpoint, correlation, causation, reply, event, inbox, and ingress identities where those surfaces already expose this domain.

### Toolchain

- Package-scoped focused tests for protocol delivery, Mission/Task duplex, scheduler peer, terminal recovery, queue recovery, and schema migration.
- `bun run --cwd packages/opencorvus typecheck`.
- Root `bun run api:routes-check`, SDK build/checks, and `bun run docs:check` when public route/schema changes are present.
- Existing real Task control checker when the changed path reaches that surface.

### Real-provider end to end

Use an isolated project/database and a configured real provider. Run one Mission that creates at least two child Tasks. While one is active, the Mission intervenes. The Task asks the Mission for a decision, receives the correlated reply, exchanges one authorized sibling-scheduler message, continues, completes, and produces one durable terminal receipt to Mission. Persist exact Mission/Task/Session/Message/event/inbox/ingress IDs and provider completion evidence. A mock, fixture-only path, or successful queue unit test is not end-to-end acceptance.

## Gate

After implementation and first-pass verification, an Agent that did not implement the change receives the complete diff, current architecture, migration, test commands/results, and real-provider evidence. It performs read-only review and may block on missing scope, dual facts, fake participants, authorization gaps, ordering/recovery holes, stale documentation, absent tests, or unproved end-to-end claims. Every valid finding is fixed and the affected verification rerun. Any fix triggers another independent gate pass. Delivery, commit, and push occur only with no unresolved gate findings.

## Progress

- [x] New clean worktree and branch created from current `origin/main`.
- [x] Current source and architecture rechecked on the new baseline.
- [x] Three pre-implementation read-only reviews reconciled.
- [x] Protocol schema/store/delivery implemented.
- [x] Mission/Task and scheduler tools integrated.
- [x] Old paths deleted.
- [x] Focused verification passed: 17 tests, 121 assertions, typecheck, documentation contract, route inventory, and diff check.
- [x] Real-provider end to end passed on the final repaired tree with `deepseek/deepseek-chat`; final evidence nonce `DUPLEX-9d25a731da` is recorded in `specs/artifacts/mission-task-duplex-e2e-result.json`.
- [x] Independent gate passed with no unresolved findings.
- [ ] Scoped commit and push completed.
