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

Archive and delete are operator-owned retention controls, not fact-reconciliation decisions. After physical prompt/process owners have stopped, no unresolved Provider, Tool, queue, ingress, Message, Task, Mission, or Session event may veto either control. Cancellation publishes the Task terminal boundary without completing an assistant or inventing an external-effect outcome; the unresolved fact remains part of the immutable audit graph and may receive only its exact outcome later.

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

Artifact locator/read/selection references remain capability-like facts scoped to the exact control parent and physical Turn. The exact current Tool Part identifies its persisted Provider step, whose `step-start` Part is the exclusive causal read boundary: only completed producer Parts from prior Provider steps are visible, so same-step parallel siblings cannot leak forward regardless of execution order. Same-activation repair therefore preserves prior-step references naturally. A later independent ingress or genuinely new physical Turn must search/read/select again; the Host never broadens a reference to compensate for a scheduler retry.

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

### Liveness

Reduction is total, so safety never depends on scheduling. Liveness does, and the reducer cannot supply it: a `ready` ingress is executed only inside a scan, and scans are started by edges. The enabled set

```text
E(t) = { i : Reduce(i,t) = ready and every prior epoch ingress is resolved | terminal_inapplicable | exhausted }
```

can grow in exactly two ways. Either a fact is appended — a newly accepted ingress, a decision receipt, a terminalized assistant, an answered Interaction, an effect outcome — or time crosses one of the finitely many instants reduction reads: a lease `expires_at`, an Interaction resume deadline, an absolute deadline. Reduction is piecewise-constant in time between those instants, so that enumeration is exhaustive.

The reconciler owns one liveness coordinate per Task, and it is process-local runtime state, never a durable projection:

- every producer records demand by incrementing a monotone revision;
- one owner scans, and re-scans while the revision it observed is stale, so a scan always *begins strictly after* any given append;
- each scan re-reads its epoch ingress list, so an ingress accepted during a long activation is visible to the next pass;
- each settled scan arms one timer at the earliest instant its own projections can change, reading the immutable absolute deadline alongside the projection so a deadline is a real wake instant;
- an activation that loses its acquisition paces on the projection the acquisition transaction reread, never on the `ready` that led into it.

Those are *edge* obligations distributed across every producer in the program, so a single unwired call site is a silent permanent stall rather than a delay. The reconciler therefore also sweeps: one level-triggered heartbeat per project requests every live Task on a fixed period. Reduction is total and `resolved`, `terminal_inapplicable`, and `exhausted` absorb further appends, so a settled ingress costs one projection.

The heartbeat is what makes liveness a property of the control plane instead of a property of caller discipline. For any transition that enlarges `E(t)` — a fact appended by any process, a crossed instant, or an edge that was never wired — some scan begins after it within one heartbeat period. Edges remain, and they are what make the common path immediate; they are no longer what makes it correct.

The sweep covers exactly the Tasks whose lifecycle can still enable an ingress — `active`, `cancelling`, `closing`, and one deliberate exception: a terminal Task holding an ingress accepted at-or-after its terminal instant. Acceptance keeps admitting operator and coordination input after the terminal boundary — the post-completion conversation — and that input relies on the same wake edges as everything else, so excluding its Task from the sweep reintroduces the lost-wake class the sweep exists to close. A terminal Task whose post-terminal ingresses this process has verified settled leaves the sweep; one with none never enters it, because an ordinary terminal Task absorbs every further fact and its dispatches are already settled by the completion gate. Recovery sweeps run once per scan rather than once per fixpoint pass, since their own effects re-enter the fixpoint and a later pass reads no new evidence.

The scan keeps two process-local absorbing-verdict caches: ingresses reduced to `resolved`, `terminal_inapplicable`, or `exhausted`, and dispatches verified settled-and-delivered or deliberately suppressed. Those verdicts are monotone in the durable facts — appends to a resolved activation are fenced, epochs only advance, budgets only fill — so a cached verdict cannot silently become wrong, and the caches hold no authority: losing one costs exactly one re-verification per entry. Without them each heartbeat re-reads full evidence for the entire settled history of every swept Task, a per-period cost that grows with the Task's lifetime instead of its frontier.

A project-wide reconciliation request drives every Task concurrently. A scan owns the whole Orchestrator Turn it activates, so sequential awaiting would make one Task's Provider call a prerequisite of the next Task's first scan, and one slow recovery would serialize the entire project behind it.

Startup reconciliation is still awaited inside each project open. Detaching it is not equivalent: project disposal cancels driver timers but does not join an in-flight scan, so a detached startup pass can outlive its project and read a removed directory. Timer- and heartbeat-driven scans do not share that hazard because they re-enter through the project owner, which drops a disposed project instead of running against it.

Re-entry provides an instance lease exactly for the duration of its callback, so everything a re-entered tick starts is awaited inside that callback: the sweep runs its Task requests in parallel and awaits them all before the lease closes. Work detached past the re-entry boundary — a fire-and-forget request inside a sweep, a background completion spawned from a request handler — keeps the closed lease in its async context and faults on its next database access; every background scan therefore detaches from its caller's lease by re-entering on its own.

Lease renewal is a liveness and resource concern, never a safety one: every durable append re-asserts its activation against the lease fence, so a renewal that fails cannot admit a conflicting write. A transient renewal fault is retried while the current lease still leaves room for another attempt, instead of destroying a live Provider Turn and consuming an immutable semantic attempt.

Worker completion is delivered by the dispatching runtime's own in-process owner. A dispatch decision resolves its ingress when the worker is accepted, so an owner that dies afterward leaves no ready ingress, no lease, and no timer — a stall no ingress projection can express, because the missing fact is the worker's outcome. Every scan therefore reconciles committed dispatch lineages whose owner is gone: a worker whose lifecycle is already terminal has its lost delivery replayed idempotently, and a worker with no terminal lifecycle has its interruption recorded as an infrastructure outcome and admitted as an ordinary ingress.

The same scan closes the opposite gap. A dispatch is settled before its outcome is handed to the Orchestrator, so a failure in between leaves a settled lineage — invisible to abandonment recovery, which looks for unsettled work — that woke nothing. Every ingress reduces to `resolved`, no timer is owed, and the Task rests permanently behind a database that looks healthy. A settled lineage with no ingress carrying its outcome is therefore replayed, keyed to the settlement artifact so the replay collapses through the ingress source index.

**Owner liveness is durable, never process-local.** Deciding that a worker is abandoned destroys live work if it is wrong, and two backends may share one database, where each sees an empty local registry for every dispatch the other owns. Each runtime process therefore renews one `runtime_process` lease, each lineage records the process occurrence that owes its delivery, and "the owner is gone" means that occurrence's lease has expired. Local registries remain a fast path for this process's own lineages, where memory is authoritative; a lineage written before the claim existed is presumed live for one lease period after its commit. The lineage payload is strict, so a fleet sharing one database upgrades together.

### Wake totality

Every non-terminal projection owes exactly one of two things, and the classification is exhaustive over the projection union by construction:

- **a finite wake instant**, which the scan returns for the driver to arm — `leased` at lease expiry, `waiting` at its resume deadline, `cancelling` and `closing` at a fixed reconciliation period, and anything under an absolute deadline at that deadline;
- **a durable operator-visible surface**, for the states no timer and no fact append can leave. `waiting` without a deadline and `reconcile_required` are surfaced by the pending Interaction that gates them. `blocked` and `exhausted` have no such row, so the first scan that observes one records a deterministic infrastructure fact naming the ingress, its state, and its reason.

A resting state with neither is indistinguishable from a deadlock, and that is precisely how these states used to present: an ingress exhausted after three decision-less Turns, or blocked on an integrity conflict, would stop silently while head-of-line blocking starved every operator message behind it. Surfacing is an observability obligation, not a scheduling one — losing it must never convert a resting Task into a faulting one.

Reduction is total over persisted facts. An evidence reader that finds a violation of the persisted integrity contract raises a typed integrity error, which the fact store catches at its single boundary and the reduction turns into `blocked`. Untyped throws stay reserved for infrastructure faults, which the driver may retry. Without that separation an immutable violation escapes as a fault forever: the driver retries every sixty seconds, the designed `blocked` value is never reached, and the Task is wedged with no surface. Everything an activation derives from immutable sources is computed before its lease is acquired, so a violation cannot consume one of the ingress's four activations on every heartbeat.

### Well-founded retry

Retry budgets are frozen per ingress, but an infrastructure failure mints a *new* ingress, and each arrives with a full budget. A worker failing the same way every time therefore had no bound at all, and each cycle cost a whole Orchestrator Turn. Automatic retry must be quantified over something the retry cannot create, so the infrastructure-failure budget is per **epoch** — which changes only when an operator reopens the Task. Beyond it the failure is still recorded and surfaced; only the wake is suppressed. Recovery facts carry deterministic identities so a crash between settlement and acceptance replays to the same artifact and dedupes through the ingress source index, rather than minting a second wake with a second budget.

The budget binds every path back in, not just the original wake. A settlement recorded before its wake was suppressed is later observed by the settled-undelivered recovery sweep, and an infrastructure settlement re-entering there is routed through the same infrastructure-failure gate — never as a generic recovery wake, which would continue the exact loop the budget terminates at one wake per crash cycle under a different event name. A suppressed re-entry closes the dispatch: the budget's own surfaced gate is its durable trace, and the sweep stops re-checking it.

`cancelling` and `closing` are non-absorbing rest states that expect an owner to finish them. Where a converger is wired, the scan re-attempts convergence on each pass over the boundary; where none is — `closing` has no engine-side converger, and engine-only runtimes carry none at all — the periodic wake alone would poll silently forever, so the scan surfaces one deterministic unconverged-boundary gate per (Task, epoch, status) naming the exit. Operator-gated ingress surfaces likewise name their exit: `blocked` holds the whole FIFO and is left by reopening the Task or repairing the conflicting evidence; `exhausted` releases the FIFO and is redone by a new operator message or a reopen.

A boundary request that fails midway leaves the Task in `cancelling`, a status no fact append can leave. Convergence is therefore re-attempted by the scan on every pass over such a Task, with a finite wake until it settles; running it only at project bootstrap made a restart the sole escape. Ownership of that convergence is bounded in the same spirit: the durable lease guarantees some process eventually acquires, so waiting forever only hides a stuck owner.

The completion closure is committed before the terminal transaction runs, and that transaction can refuse — an unsettled dispatch is the common case. The closure is released on refusal. Otherwise the Task rejects every completion for the full lease while the model retries into that window, and the conflict and the retry feed each other.

The reduction accepts one assistant turn's decision set only when it is a `dispatch_agent` fan-out or a single other decision; anything mixed is an absorbing integrity conflict. Because a model can emit that combination in ordinary output, the turn coordinator refuses the second, different decision while it is still only a call. A refused call leaves no completed receipt, so the turn may still commit a different decision, and `blocked` survives as the backstop rather than the mechanism.

The one-assistant-per-continuation conflict refuses a second *turn*, not every sibling row. Session compaction parents its summary assistant — authored `compaction`, carrying no activation — under the newest user Message, which in an Orchestrator Session is the just-written control occurrence, so any Session that lives long enough to compact produces exactly this sibling mid-turn. Counting it inverted the guarantee: the fence refused the legitimate activation assistant while the unfenced summary stood. Compaction summaries are therefore exempt from the continuation conflict; every other authored sibling stays fatal. An integrity conflict raised while a Turn is being prepared follows the same rule as one raised while it runs: the Task stays open — the ingress reduces to `blocked` and the surfaced gate is the exit — and is never terminally failed over a refused append, on the startup path or any other.

A request never joins a running scan. A scan may await a whole Orchestrator Turn whose Tools re-enter the control plane; joining would deadlock a caller against its own activation. A non-owner therefore leaves its revision and returns. A hint may still be lost or duplicated; the revision it leaves behind cannot be.

Every `continue` inside a scan is justified by a strictly decreasing well-founded measure — an abandoned assistant terminalized, a reconciliation Interaction created, an abandoned dispatch settled, an activation consumed against its immutable budget. A bounded step guard converts a measure that stops decreasing into the same exponential backoff a fault receives, never into minimum-delay pacing, so a Task that cannot reduce can never spin the reconciler. A fixpoint that will not settle within its pass bound is the same liveness fault and is paced the same way; pacing it at the minimum delay would run a full round of scans every few milliseconds forever. A scan fault is a physical fault, not a fact: it is isolated per Task, re-armed under exponential backoff, and cannot starve a sibling Task. Backoff decays only after a fault-free window as long as the maximum delay, so a Task alternating faults with apparent progress still escalates. Wakes accumulate by minimum across passes: a pass that reports no wake means it owes none, not that an earlier pass's obligation is cancelled.

Historical databases cross this boundary through one atomic migration. It rebuilds current tables, translates classifiable legacy dispositions into immutable facts/receipts, normalizes Task aggregate identity and lifecycle payloads, validates exact ingress sources, and rolls back the whole transaction on ambiguity. No compatibility reader or dual writer remains after commit.

## Overlay live-delivery ownership

The Overlay projects one selected conversation through a single explicit SSE lifecycle: `idle`, initial `connecting`, `connected`, or failure `reconnecting`. Task selection, Project selection, and server-directed live-cursor reset are initial connection work and cannot become an outage warning. Only an established stream that closes unexpectedly or stalls enters `reconnecting`; successful open is the only transition to `connected`, and explicit disposal returns to `idle`.

The selected child Session transcript keeps its backend route as the transcript authority, but streamed transcript revisions are invalidations rather than request identities. The Overlay performs the initial target load immediately, coalesces later revisions on a short cadence, permits one refresh in flight, and retains at most one trailing refresh. Target identity includes the exact source, Session, and Project directory, and changing it disposes all pending work for the old target.

## Verification authority

The following gates define the maintained control-plane proof:

- `bun run check:control-state-redundancy` inventories every scoped persisted field and rejects derived or unclassified columns plus known cross-table functional dependencies;
- focused reducer, migration, Task continuation, lifecycle, Tool/Provider, Protocol delivery, Scheduler, Bus, Mission, process-occurrence/physical-lease, and terminal closure tests assert positive fact/projection contracts;
- storage schema-contract tests prove canonical SQLite Data Definition Language, schema fingerprint, and MySQL transfer shape equality;
- `bun run typecheck`, `bun run docs:check`, and `git diff --check` remain required;
- the real streaming Provider checker is run only when credential and exact model projection use is explicitly authorized.
