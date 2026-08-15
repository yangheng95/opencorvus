# Task control plane

This chapter is the current authority for Task execution input, lifecycle, physical activation, external-effect settlement, Session continuation, scheduler delivery, cancellation, closure, and restart recovery.

## Authority rule

The control plane persists only facts that cannot be reconstructed after process loss:

- immutable accepted inputs and their causal identities;
- immutable business decisions and explicit Interaction requests/outcomes;
- immutable write-ahead external-effect requests and exact outcomes;
- immutable Task and Mission lifecycle events;
- immutable policy/deadline choices;
- append-only, expiring physical activation leases.

Every public `status`, `running`, `waiting`, `attempt`, `answered`, `completed`, `retry_at`, `last_error`, queue position, owner, recovery progress, Task timestamp, Mission closure state, Automation/Event execution state, Protocol delivery state, Tool state, and Provider state is a reducer projection. No projection is written back into its input row.

The canonical equation is:

```text
Projection = Reduce(immutable facts, immutable policy, valid leases, current time)
Queue       = Hint(unresolved projection)
```

A hint may be lost or duplicated. Reconciliation always rereads facts before execution or commit.

## Task lifecycle and execution epoch

`protocol_event` is the sole Task lifecycle authority. Task aggregate identity is stored once as `(aggregate_type='task', aggregate_id=task_id)`; `protocol_event.task_id` is `NULL` for Task aggregate events and is reserved for correlation from non-Task aggregates.

The lifecycle event family is:

```text
task.execution.opened(epoch)
task.cancellation.requested(epoch)
task.close.requested(epoch)
task.cancelled(epoch) | task.closed(epoch) | task.completed(epoch) | task.failed(epoch)
task.execution.reopened(epoch + 1)
task.deleted(epoch)
```

One epoch has one open boundary, at most one cancellation/close request boundary, and one mutually exclusive terminal boundary. `engine_task` contains durable Task definition/input fields only; lifecycle status, start/completion time, terminal error, cancellation metadata, and rewind cursors are reduced from Protocol Events.

A late activation, decision, or effect request carries its exact epoch and is rejected after a newer epoch opens. An already-requested external effect may still append or reconcile its exact outcome after cancellation, because discarding an unknown outcome would permit duplicate side effects.

`task.deleted` is an explicit operator retention boundary after terminal convergence, not another execution status. It hides the Task from ordinary lists and fences every new ingress, lease, reopen, scheduler, Artifact, and activity write while preserving the Task definition, root Session, Messages, accepted ingress, lifecycle, decision, and effect facts as one replayable audit graph. Repeating the same explicit deletion is idempotent.

Deleting a Task-root or Mission Session tree uses `session.deleted` on each Session aggregate and, when requested, `task.deleted` on each bound Task in the same transaction. Those tombstones hide the public aggregates and fence new work; they do not physically cascade through immutable causal Messages, Parts, Protocol Events, or receipts. A standalone Session without Task/Mission fact ownership may still cross the existing physical-retention boundary after all runtimes and scheduler deliveries converge.

## Task-root ingress

`engine_task_root_ingress` is an immutable accepted input:

```text
IngressAccepted {
  id, task_id, execution_epoch, sequence,
  source: task | message | protocol_event | automation_run | engine_artifact | inline,
  source_id, inline_payload?, policy_id, time_accepted
}
```

The source locator is validated in the acceptance transaction. A Message source must belong to the Task root Session. A Protocol source must be a Task aggregate event for that Task. Inline input uses the ingress identity as its producer identity. The same normalized source can be accepted only once across all epochs.

`sequence` is the immutable FIFO order inside an epoch. Lease acquisition itself verifies that every prior ingress is resolved or terminal-inapplicable; no caller-local queue check is trusted.

The ingress reducer is a total order:

1. `blocked` for conflicting immutable facts;
2. `terminal_inapplicable` for a cancelled, closed, or superseded epoch;
3. `resolved` for exactly one valid assistant-owned decision set and no conflict; one completed assistant Turn may own multiple sibling `dispatch_agent` receipts, while every other decision set contains exactly one receipt;
4. `leased` for one still-valid, unconsumed activation;
5. `reconcile_required` for a write-ahead external request whose outcome is unknown;
6. `waiting` for one unresolved explicit Interaction/deadline decision;
7. `cancelling` or `closing` for the active lifecycle fence;
8. `exhausted` when immutable semantic/physical budget or deadline is exhausted;
9. `ready` otherwise.

There is no persisted ingress disposition, delivery result, semantic attempt, activation attempt, retry owner, current owner, or blocker row. `exhausted` is an exceptional terminal reducer result derived from policy plus facts; it permits the FIFO to admit a later explicit operator input when malformed or repeatedly undecided output reaches its finite fence. Normal quiescence never uses exhaustion: the Orchestrator records the real non-mutating `no_action` decision receipt.

## Decision-gap continuation

A prose-only Provider step is visible content, not a business completion. While the current live activation is otherwise safe to continue, it remains inside the same assistant Message and activation:

```text
accepted ingress
  -> Orchestrator control/participant Message
  -> streaming assistant Message, Provider step without decision
  -> ephemeral decision-repair context
  -> next streamed Provider step in the same assistant Message
  -> valid decision receipt or immutable semantic limit
```

The control and assistant Messages live in the same immutable `kind=orchestrator` child Session of the Task root Session; that existing Session parent edge supplies Task ownership and must match the Task project. The assistant stores only its physical `activationID`; its parent Message supplies the ingress identity. Every non-`tool-calls` `StepFinishPart` is an immutable decision-gap attempt. The ingress's immutable semantic limit bounds same-assistant repair; the final bounded step completes the assistant and projects `exhausted/semantic_limit`. Historical completed prose-only assistant Messages without StepFinish evidence remain legacy attempt facts, but current execution never mints a successor activation merely to ask for the missing decision. No prose is parsed and the Host never chooses or synthesizes a decision.

An operating-system process loss remains a real physical-attempt boundary, not a same-assistant continuation. On reconciler entry, after an append-only lease fence expires, recovery terminalizes the exact abandoned open assistant before reducing exhaustion or acquiring a successor. The lease expiry is the deterministic terminal timestamp, so concurrent reconcilers converge on one byte-equivalent completion instead of conflicting over wall-clock time. The resulting completed provider-error Turn is therefore the predecessor of any successor activation; deterministic control and assistant identities cannot collide with the abandoned physical attempt. At the semantic limit the same recovery boundary terminalizes the abandoned assistant and converges directly to `exhausted/semantic_limit` without another Provider activation. Recovery never treats a persisted `StepFinishPart` alone as proof that the corresponding Provider activity has a unique successful outcome: missing outcomes still project the existing explicit activity-reconciliation path. It never broadens or reuses physical-Turn Artifact references across that recovery boundary.

The Orchestrator inactivity observer is part of the physical prompt owner, not detached diagnostic work. Prompt settlement clears future polls and joins any observation tick already reading the Session tree before project ownership may be released. An in-flight observer therefore cannot reopen or read a disposed project after the owning prompt has completed.

Artifact locator/read/selection references remain capability-like facts scoped to the exact control parent and physical Turn. Same-activation repair therefore preserves prior references naturally. A later independent ingress or genuinely new physical Turn must search/read/select again; the Host never broadens a reference to compensate for a scheduler retry.

The activation is consumed only at a final non-Tool-call assistant boundary with zero outstanding activities, or at a wait/provider-failure boundary with zero outstanding activities. An intermediate Provider step or one completed sibling Tool does not release the activation.

Lifecycle cancellation or a terminal Task decision fences every new Provider/Tool request immediately. It does not erase an activity accepted before that boundary: the latest matching activation may append the exact outstanding outcomes and then the immutable completed assistant boundary after every accepted activity is settled. Lease expiry and absolute deadline do not convert that exact settlement into a new request; a newer activation, epoch mismatch, causal-parent mismatch, or any outstanding outcome still rejects it.

A completed exclusive Tool outcome whose metadata carries the typed `immediate_park` control is itself the durable reply boundary for that assistant Turn, even though the Provider finish reason remains `tool-calls`. Session completion and recovery reduce that persisted outcome control; they do not infer reply completion from prose or require a synthetic follow-up assistant message.

`no_action({reason})` is the sole non-mutating Orchestrator decision. Its completed assistant-owned Tool request/outcome resolves only the current ingress and uses `immediate_park` to close the physical Turn. It creates no timer, Automation, Interaction, worker action, Task lifecycle fact, future wake, or durable waiting state. A lifecycle ingress with no newly ready frontier and a status/diagnosis reply both use this receipt after the visible reasoning or answer. Scheduled `wait` remains a distinct decision that names an external event, carries a defensible duration, and creates the future Automation ingress; it is never child polling or an alias for `no_action`.

## Physical leases

`engine_control_activation_lease` is the only durable physical owner coordinate. Targets include Task ingress, lifecycle operation, Interaction deadline, domain effect, Protocol delivery, Bus delivery, Automation definition/run, Event fire, Session control, and build cleanup.

Each row contains one activation identity, target identity, owner occurrence, activation time, and expiry. A successor inserts a new row only when no latest valid lease exists. Renewal changes only `expires_at` for the same activation and owner. Lease history derives physical attempt count.

Before an external effect or resolution append, the worker rereads the exact lease, epoch, deadline, and unresolved facts. Lease validity never proves business completion. Process-local owner maps and runtime settlement registries are performance and shutdown primitives only.

## Tool and Provider effects

Mutable Tool Part state is not stored. A Tool effect uses:

```text
tool_part_request(id, message_id, request_data, time_created)
tool_part_outcome(request_part_id, outcome_data, time_created)
```

The public `ToolPart.state` is projected from those two facts. Pending streamed input drafts are transport only and are not durable evidence that an effect started.

A Provider call uses:

```text
provider_activity_request(id, assistant_message_id, time_created)
provider_activity_outcome(request_id, outcome_data, time_created)
```

The parent Message uniquely supplies Session identity, so Part, Tool request, and Provider request tables do not repeat `session_id`. An unreceipted request projects `reconcile_required`; replay is allowed only with the same provider idempotency key or after an authoritative outcome query.

The first Tool request row owns its transport timestamp and display metadata. Re-observation from the Provider stream and the execution wrapper is the same immutable request when call identity, Tool identity, input and metadata are structurally equal; JSON object property insertion order is not semantic identity. A genuine value change fails with the explicit immutable-request conflict before execution.

Git, filesystem, dispatch, build cleanup, Permission, Channel ingress, Interaction, and Bus effects follow the same request/outcome rule using their domain-specific sole fact types. In particular:

- `engine_git_checkpoint_request` is written before repository publication and `engine_git_checkpoint_outcome` is its only result authority. Task metadata and progress rows project Git evidence at read time and never store a second copy. An unreceipted request is not replayed; an authoritative repository query or explicit operator reconciliation appends its exact result.
- `channel_ingress_accepted` requires the caller's stable `request_id`; an ingress without that causal identity is rejected before execution. Every production Channel adapter maps its provider event/message identity into that field; synthetic injection uses the exact newly-created provider message identity. Its envelope columns own `platform` and `request_id`, while the JSON payload excludes both. `channel_ingress_outcome` owns the result. If execution completed before the outcome commit, ordinary replay returns the typed unknown-outcome contract until exact downstream evidence reconciles it.
- one `permission_ledger(requested)` row owns authorization input. Decision/execution rows contain only their branch delta. The canonical Tool result is stored once as `(attempt_id, result, time_created)` in `permission_execution_result`; Session and Tool identities are derived through the attempt/request chain, and Tool outcome points to that attempt identity instead of copying the payload or its hash.

Build cleanup acquires its activation before the first private ref is created, renews that same activation throughout the physical Build, and appends retained, failed, or complete only under its fence; restart reconciliation can take over only an expired or receipt-consumed activation. A generic completion receipt is prohibited when a canonical domain receipt already exists.

## Protocol delivery and scheduler inputs

`protocol_event` is the immutable envelope. `protocol_inbox` is one immutable recipient occurrence. Delivery attempts use generic control leases. `protocol_delivery_receipt` stores one discriminated `receipt` JSON fact per settlement:

```text
retry_wait(visible_at, error)
task_ingress(message_id, ingress_id)
session_wake(message_id)
mission_wake_closed(message_id, closure_event_id)
mission_closed(closure_event_id)
dead_letter(error_name, message)
```

Delivery `status`, owner, lease expiry, attempt count, visibility, last error, result, update time, and completion time are projections. The receipt does not repeat these as independent columns.

Scheduler messages freeze exact source and target Task execution epochs. Materialization revalidates the target epoch before committing a real Message, Task ingress, Session control, or terminal receipt. The source body is reread from its exact Message/Part or terminal-event locator and never copied into a second authority.

Mailbox Protocol events follow the same envelope/body boundary. `mailbox.message` stores Task identity in the Task aggregate and Session identity in the envelope correlation; `mailbox.acknowledged` stores Task identity in the aggregate. Their strict durable bodies contain no repeated envelope identity. One shared EventView projector reconstructs the full public Mailbox properties for direct mailbox reads, idempotent replay, Orchestrator description, notification resolution and SSE delivery. Consumers never parse the raw body as the original ingress object and never patch persisted payloads.

## Automation, Event, Bus, and Session control

Automation and Event configuration changes append immutable definition revisions or tombstones. Execution is immutable and references the exact definition revision:

- Automation: `automation_run` input plus ordered `automation_run_receipt` facts and leases;
- Event: `event_job_fire` input plus ordered `event_job_fire_receipt` facts and leases;
- Bus: publication/delivery inputs plus phase, attempt, and delivery receipts;
- Session control: `session_control_record` input plus amendment/consumed/failed events.

Their legacy running, lease, attempt, failure-count, next-run, last-error, completion, and recovery columns do not exist. Public views reduce inputs, receipts, current time, and generic leases.

## Mission closure

Mission occurrence closure is an append-only Session aggregate Protocol Event family:

```text
mission.execution.opened
mission.execution.closing
mission.execution.closed
```

The payload contains only `missionID` and `requestID`. Session identity, operation identity, source, state, and event time come from the Protocol envelope and event type; they are not repeated in payload. Close callers join one process-local operation while the durable event remains authoritative across restart.

When closing starts, unanswered scheduler wakes receive exact closure receipts. Non-operator wake admission cannot open or reopen a Mission occurrence. A draft, closing, or closed occurrence produces its typed domain outcome without a parallel Mission status row.

## Reconciliation and recovery

Project reconciliation is the only Task-control recovery algorithm:

1. enumerate Tasks whose lifecycle projection is open, cancelling, or closing;
2. read epoch ingresses in sequence order;
3. reduce the FIFO head from immutable facts and valid leases;
4. reconcile exact unknown effects before ordinary replay;
5. acquire and hint only `ready` work;
6. stop at waiting, lifecycle fence, blocker, or unknown effect;
7. continue after an exact receipt changes the projection.

Normal acceptance, prose-only completion, retry deadline, startup, process rollback, and receipt completion invoke this same reconciler. Startup does not persist scanner progress. Runtime queues, timers, pending Promises, and owner maps may accelerate a wake but cannot change reducer output.

Historical databases cross this boundary through one atomic migration. It rebuilds current tables, translates classifiable legacy dispositions into immutable facts/receipts, normalizes Task aggregate identity and lifecycle payloads, validates exact ingress sources, and rolls back the whole transaction on ambiguity. No compatibility reader or dual writer remains after commit.

## Verification authority

The following gates define the maintained control-plane proof:

- `bun run check:control-state-redundancy` inventories every scoped persisted field and rejects derived or unclassified columns plus known cross-table functional dependencies;
- focused reducer, migration, Task continuation, lifecycle, Tool/Provider, Protocol delivery, Scheduler, Bus, Mission, runtime ownership, and terminal closure tests assert positive fact/projection contracts;
- storage schema-contract tests prove canonical SQLite Data Definition Language, schema fingerprint, and MySQL transfer shape equality;
- `bun run typecheck`, `bun run docs:check`, and `git diff --check` remain required;
- the real streaming Provider checker is run only when credential and exact model projection use is explicitly authorized.
