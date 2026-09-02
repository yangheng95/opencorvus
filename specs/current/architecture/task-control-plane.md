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

A global Task create carrying `requestID` first freezes the complete canonical caller request in
`global_creation_allocation` before anonymous Project filesystem work. That occurrence owns one directory, one initial
configuration snapshot, one append-once Task-resolution snapshot (profile, package revision, checks and process policy),
and one append-once accepted `(project_id, task_id, accepted_at)` receipt. The Task/root Session/creation contract/initial
ingress transaction appends the accepted receipt itself. Replay compares only caller request semantics, reads the stored
resolved snapshot instead of mutable defaults, and re-enters the accepted Task only to request level-driven reconciliation.
If explicit retention has removed the accepted Project or Task, replay returns the typed unavailable terminal for that same
occurrence; it never allocates a second aggregate. `global_chat_start` uses the same allocation/accepted-receipt rule for its
carrying Project and Session. Its current request identity is v2 only: the allocation derives its fingerprint from the shared
canonical JSON contract and the accepted Session stores that exact fingerprint. Runtime has no alternate-contract or v1
identity reader. A database without the current creation-contract/allocation schema is not interpreted or upgraded: startup
returns `SCHEMA_RESET_REQUIRED`, and an explicit database reset creates the current schema directly. Portable transfer accepts
only that exact current schema and validates its current creation facts before writing the destination; it is not an upgrade path.

Inside a Project, `engine_task_creation_contract` separates the immutable canonical request from the first-accept resolved
snapshot. Request ID, channel binding and persisted Panel Tool Part are claims on that one Task. One immediate-transaction
intersection reducer reads every supplied claim: zero winners may create, one winner may atomically acquire missing aliases,
and different winners return a typed identity conflict. Database uniqueness chooses a cross-process winner; no process lock
owns business identity or spans reconciliation/Provider work. A narrow process lock may serialize only physical publication
of the already-allocated directory.

## Task lifecycle and execution epoch

`protocol_event` is the sole Task lifecycle authority. Task aggregate identity is stored once as `(aggregate_type='task', aggregate_id=task_id)`; `protocol_event.task_id` is `NULL` for Task aggregate events and is reserved for correlation from non-Task aggregates.

Execution lifecycle and Session error projections originate once from their real Bus participant and persist through one protocol bridge. A Task-owned Session keeps the Task aggregate above with immutable `session_id` correlation; a Session with no explicit or durable Task lineage uses `(aggregate_type='session', aggregate_id=session_id)` and leaves `session_id` null by the aggregate identity rule. The public Session event stream subscribes to all Session-aggregate public events plus only `agent.execution.lifecycle` and `session.error` from Task aggregates, then applies immutable Project/Session-lineage filtering. Connection cutover replays at most the latest terminal lifecycle and latest error for each Session in the selected tree, using the same immutable event IDs as live delivery; its overlap set is discarded after buffered events flush. Cross-aggregate latest selection orders by `emitted_at` and globally comparable event ID, never aggregate-local sequence. The process-local Session mirror does not publish either durable event type, so reconnect and live delivery observe the same fact rather than parallel projections. Process-local physical lifecycle wins for every Session in the tree: after restart, historical `streaming` or `retry` cannot project a live owner, while a durable terminal may restore the last settled occurrence.

The domain writer and its canonical Protocol fact share one database transaction. Task creation inserts `task.created` beside the Task/root-Session/creation-contract/ingress facts; Interaction request and outcome writers insert `interaction.requested` and `interaction.resolved` beside their immutable domain rows. Requirements, Architect, Browser Preview target, and Orchestrator Delivery Slice writers append `task.updated` in the same transaction as the exact Artifact or GoalGraph mutation. A failed Protocol insert therefore rolls back the owning domain mutation. Post-commit live dispatch remains a projection of the committed Protocol fact, and reconnect reads that fact; no post-commit effect is allowed to manufacture the canonical lifecycle event.

The lifecycle event family is:

```text
task.execution.opened(epoch)
task.cancellation.requested(epoch)
task.cancelled(epoch) | task.completed(epoch) | task.failed(epoch)
task.execution.reopened(epoch + 1)
task.deleted(epoch)
```

One epoch has one open boundary, at most one cancellation request boundary, and one mutually exclusive terminal boundary. Cancellation is the only boundary request: a Task is left by completing, failing, or cancelling it, and there is no separate close request or close terminal. `engine_task` contains durable Task definition/input fields only; lifecycle status, start/completion time, terminal error, cancellation metadata, and rewind cursors are reduced from Protocol Events.

A late activation, decision, or effect request carries its exact epoch and is rejected after a newer epoch opens. An already-requested external effect may still append or reconcile its exact outcome after cancellation, because discarding an unknown outcome would permit duplicate side effects.

Exactly two authorities may open the next occurrence. An explicit operator Message opens completed, failed, or cancelled Tasks. A Mission acceptance resume opens only a completed or failed Mission-owned Task, and must bind the exact current terminal lifecycle reference, current acceptance-ledger revision, completely read evidence, immutable workflow nodes, and one visible Mission-authored structured repair Message. Both append `epoch + 1`; the prior occurrence stays intact as an immutable fact at its old epoch. There is no separate retry or replan control. Scheduler delivery, agent coordination, recovery, and late Tool/Provider outcomes must match an existing occurrence and can never obtain reopen authority. Asking a question rather than requesting work needs no mode of its own: the Orchestrator judges a status-only operator Message as conversation ingress and answers it with a `no_action` decision receipt.

Mission acceptance obligation is an append-only `task_acceptance_ledger` Artifact lineage, not another lifecycle. Each revision points to the prior revision, names the newly opened epoch, stores one typed state (`open`, `accepted`, or `blocked`) per criterion with canonical evidence locators, and never copies Task/Session status or Artifact bodies. Every state carries all five append-only evidence arrays: observation, attempted-repair, resolution, invalidating, and irreducible-blocker locators never move between roles. `open -> open` requires a new locator or a changed canonical structured repair-action hash; `open -> accepted` requires new resolution evidence; `open -> blocked` requires new irreducible-blocker evidence; `accepted -> open` retains resolution evidence in that role and requires `stale_evidence` plus new invalidating evidence. Accepted and blocked states otherwise retain exact immutable facts. The structured repair action is the single authority for its expected evidence kind and canonical identity hash. Responsibility is either an immutable virtual-workflow node or an exact direct-dispatch package revision, Agent, and `dispatch_lineage` Artifact; only the responsible node/downstream verifier or exact direct lineage continuation can consume it.

The Task-root Orchestrator and every acceptance-repair worker continuation retain their physical Session lineage. Before the next Provider request, each consumes the current attempt of a logical compaction checkpoint keyed by Task, epoch, ledger revision, gap, and Session. Every failed attempt remains immutable and recovery creates a new deterministic attempt; the durable control reduction points to the pending attempt or latest consumed control and its exact summary Message binding. The checkpoint preserves Task authority, workflow/dispatch identity, criterion states, and canonical locators. It copies no Artifact body. A continuation must name the current gap and open criterion subset, reuse an existing dispatch occurrence, and target the responsible workflow node/downstream verifier or the exact responsible direct dispatch lineage.

Deletion is the boundary that does fence a reopen, per the retention rule below; the reopen transaction checks it directly rather than relying on the ingress acceptance that refuses a moment later.

Archive and delete are operator-owned retention controls, not fact-reconciliation decisions. After physical prompt/process owners have stopped, no unresolved Provider, Tool, queue, ingress, Message, Task, Mission, or Session event may veto either control. Cancellation publishes the Task terminal boundary without completing an assistant or inventing an external-effect outcome; the unresolved fact remains part of the immutable audit graph and may receive only its exact outcome later.

`task.deleted` is an explicit operator retention boundary after terminal convergence, not another execution status. It hides the Task from ordinary lists and fences every new ingress, lease, reopen, scheduler, Artifact, and activity write while preserving the Task definition, root Session, Messages, accepted ingress, lifecycle, decision, and effect facts as one replayable audit graph. Repeating the same explicit deletion is idempotent.

Deleting a Task-root, Mission, Panel-created, or Global-Chat Session tree uses `session.deleted` on each Session aggregate and, when requested, `task.deleted` on each bound Task in the same transaction. Those tombstones hide the public aggregates and fence new work; they do not physically cascade through immutable causal Messages, Parts, Protocol Events, or receipts. Prompt-owner and Permission-request writers read the exact tombstone inside their immediate admission transaction. The Session repository applies the same mandatory check inside every canonical root/child Session insert, Message upsert, Part update/data/progress, Message/Part removal and public Session-row mutation before any row or visibility effect. Standalone mutations take the SQLite immediate writer reservation; aggregate writers reuse their caller-owned writer transaction. Prompt, shell, clone, recovery, direct update and snapshot callers therefore cannot bypass the fence with a wrapper preflight, and a deterministic root identity cannot recreate a physically removed row. Deterministic find-or-create readers, including Mission launch/replay, first assert the existing identity inside the same immediate read transaction. Runtime-root materialization then creates only the exact missing root, and a second immediate admission assertion defines its durable serial order: a deletion which committed first rejects the replay and removes only that attempt's newly created empty root, while a deletion which commits later observes a root materialized before its own terminal boundary. Child creation checks both its identity and parent; snapshot import checks the imported identity and parent before any Session, Message or Part upsert. Retained deletion repeatedly refreshes the exact Session subtree, requests exact Prompt cancellation, and settles at most one fixed Permission batch per Session page in each outer round under one absolute deadline. That deadline is checked before every selected row and bounds waiter release, continuation resume and execution-outcome polling rather than only the batch query. Its tombstone transaction recomputes exact tree membership and proves the durable Prompt-owner set empty. For every Permission request, it also proves either a durable deny/cancel/stale retirement or an exact `execution_started` attempt with a durable outcome; a positive authorization before start and a started effect without outcome remain live deletion blockers even after a local deadline detached its waiter. Effect outcome and effect-lease release commit together. A concurrent child, Prompt owner or live Permission continuation that commits first makes the transaction fail with the typed runtime-not-settled result; the expanded tree and admitted work are incorporated and settled in a later bounded round. Retained terminal retries wait between attempts and may run no more than 256 transaction rounds within the same absolute deadline, so a live continuation cannot produce a hot SQL loop. A tombstone transaction that commits first makes each later admission writer fail with the typed deletion-fence result. Whichever transaction commits first therefore defines one serial order: a pre-boundary fact remains auditable, while every post-boundary mutation is rejected. The public deletion result is `tombstoned` and explicitly reports that Session causal history and authorization audit are retained; no route or Tool describes this disposition as permanent data erasure.

A standalone Session without those durable domain owners may cross the physical-retention boundary after every Prompt runtime and scheduler delivery converges. Before any row is removed, one stable Session-deletion occurrence binds the database instance, Project, root Session, exact tree membership, each Session directory, root public authority, and the exact `conversations/<session-id>` runtime root. The occurrence atomically acquires one non-expiring `session_deletion` control fence per tree member; an already-running Prompt is the exact cancellation target rather than a reason to create an admission gap. New Prompt owners and new Permission `requested` rows read that same fence inside their immediate admission transaction. Every filesystem manifest reassertion after fence acquisition remains inside the sole rollback/liveness `try/finally`. Reconciliation is advisory until it proves a committed or rolled-back winner: its own read, parse, evidence, or immutable-input failure is retained as diagnostic context but cannot bypass rollback through the first validated durable plan. Therefore any reassert failure restores the roots, releases the permanent fences, and closes the runtime owner. Deletion requests Prompt cancellation, reduces pending Permission occurrences through fixed 64-row pages, waits for the Prompt owner to finish, then reduces the exact pages once more. The terminal transaction proves no Prompt owner remains; no Permission request can enter after the fence. The fence is released only by explicit rollback or the terminal database transaction. A peer preserves a live physical process and may supersede only after exact PID/process-instance observation proves the owner dead or reused. Existing roots are durably renamed to occurrence-specific quarantine paths. One immediate transaction then revalidates the fences, ownership and tree membership, authorizes each exact physical terminal boundary while its Session row still exists, removes the exact Session tree, appends operation-bound `session.deleted` facts through that narrow authority, and releases the fences; either all effects commit or all roll back. Generic Protocol writers cannot append a missing-Session tombstone. Rollback first restores every admitted runtime root, then releases the permanent database fences, and only then retires the discoverable manifest; a crash after fence release leaves an idempotent manifest rather than an undiscoverable permanent lock. Cleanup removes committed quarantines and retires the manifest. A committed residue returns `physically_deleted_with_residue`, and a repeated Session, right-sidebar or Panel request resumes the same operation identity before attempting to load the removed Session. Public results distinguish retained Session causal history from the immutable authorization audit, which remains available after physical Session removal. Recovery reads fixed 64-identity pages and restores quarantine only while the complete Session tree still exists with no operation-bound delete boundary; after the database boundary it only rolls forward. The Session repository exports no second recursive physical-remove operation: all public and internal whole-Session deletion enters this one retention authority. No Task-artifact cleanup, Project-deletion manifest, empty target set, process-local callback or manifest timestamp substitutes for that owner.

## Task-root ingress

`engine_task_root_ingress` is an immutable accepted input:

```text
IngressAccepted {
  id, task_id, execution_epoch, sequence,
  source: task | message | protocol_event | engine_artifact | inline,
  source_id, inline_payload?, policy_id, time_accepted
}
```

The source locator is validated in the acceptance transaction. A Message source must belong to the Task root Session. A Protocol source must be a Task aggregate event for that Task. Inline input uses the ingress identity as its producer identity. The same normalized source can be accepted only once across all epochs.

`sequence` is the immutable FIFO order inside an epoch. Lease acquisition itself verifies that every prior ingress has released head-of-line order — `resolved`, `terminal_inapplicable`, `exhausted`, or `host_fault`, the states with no decision left to make; no caller-local queue check is trusted. That release is one predicate shared by the durable fence and the scan, so a state cannot hold the line in one and not the other.

The ingress reducer is a total order:

1. `host_fault` for a broken Host write invariant, named by which one;
2. `terminal_inapplicable` for a cancelled, closed, or superseded epoch;
3. `resolved` for exactly one valid assistant-owned decision set and no conflict; one completed assistant Turn may own multiple sibling `dispatch_agent` receipts, while one `dispatch_agents` receipt is itself the complete ordered collection occurrence and every other decision set contains exactly one receipt;
4. `leased` for one still-valid, unconsumed activation;
5. `reconcile_required` for a write-ahead external request whose outcome is unknown;
6. `waiting` for one unresolved explicit Interaction/deadline decision;
7. `cancelling` for the active lifecycle fence;
8. `exhausted` when immutable semantic/physical budget or deadline is exhausted;
9. `ready` otherwise.

There is no persisted ingress disposition, delivery result, semantic attempt, activation attempt, retry owner, current owner, or blocker row. `exhausted` is an exceptional terminal reducer result derived from policy plus facts; it permits the FIFO to admit a later explicit operator input when malformed or repeatedly undecided output reaches its finite fence. Normal quiescence never uses exhaustion: the Orchestrator records the real non-mutating `no_action` decision receipt.

## Decision-gap continuation

Session Message causality is allocated by the Session persistence boundary, not by caller wall-clock order. A new Message obtains SQLite's writer reservation before reading its exact Session frontier and persists `time.created = max(requested_created, latest_session_created + 1)`; existing Message creation time remains immutable. Moving a real Task-root participant Message into its Orchestrator Session obtains the same writer reservation before allocating that target Session's next frontier. Message events, timeline order keys and child Parts use the persisted frontier, and a Part cannot precede its parent Message. The frontier is scoped to one Session, so concurrent projects and Sessions do not share a global sequence.

A fresh typed Task occurrence requires both the real task-creator Message and its deterministic Orchestrator control Message. The Session prompt writer prepares them under one runtime-contract write claim and commits both bundles in one immediate transaction before arming the runtime wake. Observers therefore see either the complete creator/control cut or neither participant; replay validates the existing deterministic control identity and never synthesizes or reorders a Message after visibility.

A prose-only Provider step is visible content, not a business completion. While the current live activation is otherwise safe to continue, it remains inside the same assistant Message and activation:

Every Provider step receives two JSON values: the canonical current `TaskDesc` baseline and a strict `task-projection-delta-v1` envelope. The first step uses that same shape with an empty, cursor-bound operation list. Later steps apply ordered JSON Pointer `replace`, `append`, and `remove` operations only when the envelope's previous cursor matches the supplied baseline; the resulting cursor must match the envelope's current cursor. Optional TypeScript fields are omitted by normal JSON value materialization before canonical key ordering, so `undefined` never becomes a second projection contract.

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

An accepted Tool call pauses Provider chunk-idle observation, but not without a finite inactivity contract: `assistant.activity.session_tool_idle_ms` bounds the interval since the latest durable Tool progress. Each changed live metadata payload appends an immutable `tool_part_progress` fact under the exact request Part; the latest fact is projected into the visible running Tool Part and renews only that Session's pause window after commit. Bash maintains its real cumulative output byte count incrementally and samples a fixed 4 KiB preview only when a real chunk crosses five seconds since the prior sample or adds 64 KiB since it; progress therefore remains monotone after preview truncation without rescanning history, an unbounded fact rate, or a timer heartbeat. An in-memory sample, duplicate payload, failed append, timer, filesystem mutation, or another Session's progress cannot renew it. The terminal Tool outcome supersedes the live projection and closes further progress appends, while Tool result/error resumes the same prompt owner's ordinary chunk-idle observer. Foreground timeouts and background leases remain properties of the Tool and its process supervisor, so Provider inactivity does not become a second absolute Tool-runtime limit; if a Provider boundary fails after an effect began, the existing unsafe-retry fence still prevents replay.

Artifact locator/read/selection references remain capability-like facts scoped to the exact control parent and physical Turn. The exact current Tool Part identifies its persisted Provider step, whose `step-start` Part is the exclusive causal read boundary: only completed producer Parts from prior Provider steps are visible, so same-step parallel siblings cannot leak forward regardless of execution order. Same-activation repair therefore preserves prior-step references naturally. A later independent ingress or genuinely new physical Turn must search/read/select again; the Host never broadens a reference to compensate for a scheduler retry.

The activation is consumed only at a final non-Tool-call assistant boundary with zero outstanding activities, or at a wait/provider-failure boundary with zero outstanding activities. An intermediate Provider step or one completed sibling Tool does not release the activation.

Lifecycle cancellation or a terminal Task decision fences every new Provider/Tool request immediately. It does not erase an activity accepted before that boundary: the latest matching activation may append the exact outstanding outcomes and then the immutable completed assistant boundary after every accepted activity is settled. Lease expiry and absolute deadline do not convert that exact settlement into a new request; a newer activation, epoch mismatch, causal-parent mismatch, or any outstanding outcome still rejects it.

A completed exclusive Tool outcome whose metadata carries the typed `immediate_park` control is itself the durable reply boundary for that assistant Turn, even though the Provider finish reason remains `tool-calls`. Session completion and recovery reduce that persisted outcome control; they do not infer reply completion from prose or require a synthetic follow-up assistant message.

`no_action({reason})` is the sole non-mutating Orchestrator decision. Its completed assistant-owned Tool request/outcome resolves only the current ingress and uses `immediate_park` to close the physical Turn. It creates no timer, Automation, Interaction, worker action, Task lifecycle fact, future wake, or durable waiting state. A lifecycle ingress with no newly ready frontier and a status/diagnosis reply both use this receipt after the visible reasoning or answer. Scheduled `wait` remains a distinct decision that names an external event and carries a defensible duration. Under Task authority it registers one epoch-bound native Task wait whose due materialization is an exact Task ingress; under conversation authority it creates one Session-delay Automation. It is never child polling or an alias for `no_action`.

## Physical leases

`engine_control_activation_lease` is the only durable physical owner coordinate. Targets include Task ingress, lifecycle operation, Interaction deadline, domain effect, Protocol delivery, Bus delivery, Automation definition/run, Event fire, Session control, standalone Session deletion, and build cleanup.

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

Scheduler execution inactivity owns preparation until a durable execution owner exists. Project/worktree entry, Session/database admission, Provider/model resolution, and activation persistence remain inside the scheduler inactivity interval. Session wakes await their durable activation receipt. A delayed Task wake passes an owner-completion wrapper into Task-root reconciliation; each physical activation invokes that wrapper only after its exact ingress lease commits and only around that activation runner. The wrapper settles and rearms scheduler inactivity before reduction continues, so post-owner scanning and every later lease acquisition are timed again. An already-owned or non-activating scan never delegates. Multiple simultaneously delegated owners retain suspension until the last owner settles, while a stall before owner establishment expires under the scheduler interval instead of escaping both timers.

`protocol_event` is the immutable envelope. `protocol_inbox` is one immutable recipient occurrence. Delivery attempts use generic control leases. `protocol_delivery_receipt` stores one discriminated `receipt` JSON fact per settlement:

```text
retry_wait(visible_at, error)
task_ingress(message_id, ingress_id)
session_wake(message_id)
mission_closed(closure_event_id)
dead_letter(error_name, message)
```

Delivery `status`, owner, lease expiry, attempt count, visibility, last error, result, update time, and completion time are projections. The receipt does not repeat these as independent columns.

Scheduler messages freeze exact source and target Task execution epochs. Materialization revalidates the target epoch before committing a real Message, Task ingress, Session control, or terminal receipt. The source body is reread from its exact Message/Part or terminal-event locator and never copied into a second authority.

Every Scheduler Message, Automation run, and Event fire targeting a Mission freezes its exact causal lifecycle boundary. An active occurrence names the observed `mission.execution.opened`; a fact created after closing began names that exact `closing` or `closed` event as its terminal disposition. Actual wake admission reasserts the opened event. If the Mission closes before admission, all three surfaces reduce the first closure after that opened event to one exact `mission_closed` terminal disposition; they do not retry the old occurrence into a later reopen. Scheduler Message replay derives this reservation from the envelope's aggregate sequence, while Automation and Event persist the same strict union with their run/fire. Validation never resolves an old fact against the Mission's current frontier.

Once a Scheduler Message has committed `session_wake`, that receipt remains its immutable delivery outcome. Mission close settles the real Session Prompt/assistant lineage rather than appending a second delivery terminal. Before `closed`, one bounded exact-occurrence query proves that every `session_wake` between the frozen opened and closing Protocol sequence has a completed assistant reply; the query returns at most one blocker and never rescans earlier Mission occurrences. Active errored wakes are recovered only while their enqueue-time opened event remains current. A fixed SQL page excludes closed history before applying its limit, so an old errored reply cannot cross a reopen or keep the one-second poll hot. Recipient drain selects only each recipient's current unresolved, due and unleased FIFO head in SQL. Fixed pages of wake, Mission-recipient, and Task-recipient identities are interleaved into one work-conserving frontier under the global Scheduler Message physical-capacity limit; a stalled effect does not leave a released slot idle, and terminal inbox history is not projected into that physical work set. Current writers and readers accept only canonical `session_wake`; a database carrying an obsolete receipt belongs to another schema epoch and requires explicit reset.

Mailbox Protocol events follow the same envelope/body boundary. `mailbox.message` stores Task identity in the Task aggregate and Session identity in the envelope correlation; `mailbox.acknowledged` stores Task identity in the aggregate. Their strict durable bodies contain no repeated envelope identity. One shared EventView projector reconstructs the full public Mailbox properties for direct mailbox reads, idempotent replay, Orchestrator description, notification resolution and SSE delivery. Consumers never parse the raw body as the original ingress object and never patch persisted payloads.

## Automation, Event, Bus, and Session control

Automation and Event configuration changes append immutable definition revisions or tombstones. Execution is immutable and references the exact definition revision:

- Automation: immutable definition revision/tombstone, logical `automation_fire`, ordered physical `automation_fire_attempt` plus attempt receipt, real `automation_run` plus ordered run receipts, and the generic Automation lease. A zero-run terminal Fire is a real public occurrence, not a synthetic run. Current writers emit only `scheduled`, `manual_api`, or Tool-bound `manual_tool` provenance. Retry identity and supersession are represented directly by current Fire, attempt and receipt facts; no current reader interprets predecessor-era successor IDs or legacy provenance;
- Event: `event_job_fire` input plus ordered `event_job_fire_receipt` facts and leases;

Event acceptance keyset-pages only the latest untombstoned definition revisions
for the active Project and creates matching Fires under that same immediate
writer snapshot. Each Fire receives one immutable definition-local queue
position. A terminal receipt carries the same DDL-verified relation and may
advance only the contiguous terminal frontier. Startup recovery, exact claim,
same-definition handoff and lease recovery seek that frontier through the
partial terminal index and then seek exactly its Fire successor. Each
64-definition page loads latest retry receipts and current leases through fixed
set queries; retained terminal Fires never enter the scheduling work set.
Exact claim repeats that head reduction inside the immediate lease transaction,
and a recovery timer rereads the definition frontier instead of assuming its
seed Fire is still current. Public Event history remains an explicit history
projection and is not reused as a scheduler selector.

When either target is a Mission, the immutable run/fire reservation is a strict union committed under the same immediate writer boundary: an active target carries its exact `mission.execution.opened` event, while a target already closing or closed carries `mission_closed` plus its exact closure event. Automation writes its matching terminal run receipt at admission; Event preserves definition FIFO and writes the matching Fire receipt only when that reserved Fire becomes the head. A non-Mission target carries none of those fields. Projection validates the stored event aggregate/type and, once terminal, the exact receipt; it never resolves a nullable Mission row against a later reopen. Rows without an exact causal pointer are not a current-schema fact and cannot be opened.
- Bus: publication/delivery inputs plus phase, attempt, and delivery receipts;
- Session control: `session_control_record` input plus amendment/consumed/failed events.

Task waits are native Task-control facts: one immutable `engine_task_wait_registration` names its creator Tool Part, Task execution epoch, creator ingress and activation; one optional `engine_task_wait_settlement` names the exact accepted ingress. The registration ID is also the due ingress `source_id`, `taskWaitWake.jobID`, and logical `fireID`; `dueAt` must equal the registered boundary and the ingress cannot be accepted early. The canonical ingress writer validates that complete identity against the still-unsettled registration before inserting anything; an arbitrary inline payload cannot exempt a wait from supersede or create a semantic Turn. A superseding ingress must follow the creator ingress in the same Task epoch. Registration, settlement and ingress are immutable while the owning Task exists, then cascade together through the canonical Task/Project retention delete. Current schema declares the canonical foreign keys and due identity directly; predecessor wait tables or Fire-derived identities require explicit database reset. Session one-shot waits remain Automation delays. Their due-wake-versus-ordinary-input winner is appended as `automation_delay_settlement` inside the same assistant Message transaction that accepts the input batch; that transaction may also append the exact superseded run receipt and tombstone. No post-commit Bus subscriber owns either decision.

Their legacy running, lease, attempt, failure-count, next-run, last-error, completion, and recovery columns do not exist. Public views reduce inputs, receipts, current time, and generic leases.

## Mission closure

Mission occurrence closure is an append-only Session aggregate Protocol Event family:

```text
mission.execution.opened
mission.execution.closing
mission.execution.closed
```

`opened` contains `missionID`, `requestID`, and the canonical accepted-input fingerprint. The fingerprint covers prompt text, explicit model, materialized attachment semantics, the complete accepted configuration patch, and caller context. Its Protocol event identity and operation UUID derive from the same immutable occurrence key; concurrent peers therefore join one winner. Reusing a request with input drift is a typed idempotency conflict. `closing` and `closed` additionally contain one strict close provenance. Session identity, operation identity, source, state, and event time come from the Protocol envelope and event type; they are not repeated in payload. Current DDL requires that strict shape at write time; older optional-provenance rows are another database epoch and have no current reader.

The `closing` event is the write-ahead close request and the sole close-recovery input. HTTP control, startup recovery, and peer takeover invoke one Mission-domain reconciler; routes do not inject a physical-close callback. A lifecycle-lease owner rereads the exact closing occurrence immediately after acquisition, derives every Prompt and child-Task cancellation from its persisted provenance, and propagates one bounded cancellation signal through Prompt settlement, child cancellation waits, lease renewal, and terminal commit. Active child identity comes from one current-lifecycle SQL authority; the reconciler cancels fixed pages of four through the canonical Task reducer, and the terminal transaction performs only a `LIMIT 1` active-child existence query. A contender returns the typed current-closing projection instead of polling. `closed` commits only in the same transaction that proves the exact live fence, no durable Session Prompt owner, and no active Mission child Task.

Retention is a later monotonic operation over that immutable close provenance. Archive and restore update the canonical `Session.time_archived` projection in one immediate transaction that proves an exact `closed` event and the absence of a delete request; an initial archive close performs the same update in its terminal transaction. Delete appends one `mission.retention.delete_requested` Session event with the accepted request provenance. An initial delete close appends that event in the same terminal transaction, while an already abort-closed or archive-closed Mission appends it under the exact existing-closed fence. The immutable request is the no-reopen and no-restore gate and remains the startup/heartbeat recovery input until the existing Session deletion authority appends the unique `session.deleted` boundary. Mission deletion follows that authority's tombstone contract: immutable Mission/Task/Session audit rows remain available for replay while current Session readers exclude the deleted boundary. The lifecycle lease owns only physical cleanup; it does not replace the request or completion facts. A plain abort close has no delete intent and is never deleted. Operator wake and archive/restore admission check the same retention facts in their own write transactions.

Operator wake admission plans a deterministic opened event and Message/Part/control identity from the accepted fingerprint. The opened event, real user Message bundle, and accepted configuration overlay commit under one immediate transaction that reasserts the prior closure; Prompt-owner acquisition reasserts that same opened event in its own ownership transaction. An exact replay reads the persisted bundle and outcome rather than rewriting it. A close that wins first prevents both Message persistence and Provider ownership. A wake that wins first becomes a stable input which close must settle. Non-operator wake and Mission-child Task creation use the same exact-opened occurrence fence and cannot open or reopen an occurrence. The Prompt owner observes the admitted opened occurrence for its lifetime and cancels itself when a peer commits closing, so `closed` cannot race a live remote Prompt.

When closing starts, scheduler deliveries not yet admitted receive the exact `mission_closed` receipt for their frozen opened occurrence. A delivery that already committed `session_wake` keeps that immutable receipt; close settles its real Prompt/assistant lineage, and the final close transaction uses a one-row exact-occurrence blocker query to require a terminal assistant reply. A never-dispatched draft closes as `closing -> closed` without inventing an opened event; its bounded final assertion accepts the empty admitted-wake set and rejects any impossible `session_wake`. A draft, closing, or closed occurrence produces its typed domain outcome without a parallel Mission status row.

Standalone Mission process recovery has no mutable marker, attempt counter, or second queue. Its reducer uses bounded SQL frontier reads over the current opened event, exact incomplete assistant Messages, deterministic recovery Messages/controls, terminal assistant replies, the generic lifecycle lease, and the durable Session Prompt owner. A live or unknown owner is preserved. For a proved-dead owner generation, the semantic occurrence identity is the opened event plus that generation plus the canonical interrupted-frontier digest. One immediate transaction writes its deterministic Message/TextPart/control, establishes the durable Prompt-acquisition fence, and releases only that generation. The canonical, re-entrant Session terminalizer then settles the exact frontier behind the write-ahead boundary; a crash at any later point leaves the same unanswered Message discoverable. Close uses the same strict actionable-Message/frontier reader: before `closed`, it terminalizes the exact interrupted assistants and appends one deterministic completed `MessageAbortedError` reply under the real recovery Message, so close takeover neither starts a second Provider effect nor leaves an actionable ingress behind. A physical interruption resumes that Message, while another terminal reply settles only that exact generation/frontier; a later dead generation in the same opened occurrence has a distinct Message. Lease loss, caller cancellation, and the absolute recovery deadline stop terminalization, activation, and completion waiting through one signal and return the lease for successor takeover. Every recovery Message names its exact opened event and cannot cross close/reopen. Current readers accept only the typed `ProcessExecutionInterruptedError`; predecessor wrappers have no compatibility reader.

## Reconciliation and recovery

Project reconciliation is the only Task-control recovery algorithm:

1. enumerate Tasks whose lifecycle projection is open or cancelling;
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

The sweep covers exactly the Tasks whose lifecycle can still enable an ingress — `active`, `cancelling`, and one deliberate exception: a terminal Task holding an ingress accepted at-or-after its terminal instant. Acceptance keeps admitting operator and coordination input after the terminal boundary — the post-completion conversation — and that input relies on the same wake edges as everything else, so excluding its Task from the sweep reintroduces the lost-wake class the sweep exists to close. A terminal Task whose post-terminal ingresses this process has verified settled leaves the sweep; one with none never enters it, because an ordinary terminal Task absorbs every further fact and its dispatches are already settled by the completion gate. Recovery sweeps run once per scan rather than once per fixpoint pass, since their own effects re-enter the fixpoint and a later pass reads no new evidence.

The scan keeps two process-local absorbing-verdict caches: ingresses reduced to `resolved`, `terminal_inapplicable`, or `exhausted`, and dispatches verified settled-and-delivered or deliberately suppressed. Those verdicts are monotone in the durable facts — appends to a resolved activation are fenced, epochs only advance, budgets only fill — so a cached verdict cannot silently become wrong, and the caches hold no authority: losing one costs exactly one re-verification per entry. Without them each heartbeat re-reads full evidence for the entire settled history of every swept Task, a per-period cost that grows with the Task's lifetime instead of its frontier.

A project-wide reconciliation request drives every Task concurrently. A scan owns the whole Orchestrator Turn it activates, so sequential awaiting would make one Task's Provider call a prerequisite of the next Task's first scan, and one slow recovery would serialize the entire project behind it.

Startup reconciliation is still awaited inside each project open. Detaching it is not equivalent: project disposal cancels driver timers but does not join an in-flight scan, so a detached startup pass can outlive its project and read a removed directory. Timer- and heartbeat-driven scans do not share that hazard because they re-enter through the project owner, which drops a disposed project instead of running against it.

Re-entry provides an instance lease exactly for the duration of its callback, so everything a re-entered tick starts is awaited inside that callback: the sweep runs its Task requests in parallel and awaits them all before the lease closes. Work detached past the re-entry boundary — a fire-and-forget request inside a sweep, a background completion spawned from a request handler — keeps the closed lease in its async context and faults on its next database access; every background scan therefore detaches from its caller's lease by re-entering on its own.

Lease renewal is a liveness and resource concern, never a safety one: every durable append re-asserts its activation against the lease fence, so a renewal that fails cannot admit a conflicting write. A transient renewal fault is retried while the current lease still leaves room for another attempt, instead of destroying a live Provider Turn and consuming an immutable semantic attempt.

Worker completion is delivered by the dispatching runtime's own in-process owner. A dispatch is accepted only after its deterministic child Session and exact Worker Turn descriptor are durable. Before that boundary, the immutable lineage is a write-ahead request owned by the generic `dispatch_admission` lease: a live owner renews it, and after owner death one successor takes the expired lease and resumes the same occurrence from persisted input. Task-control never synthesizes acceptance or abandonment from lineage alone. After the descriptor-backed accepted boundary, an owner that dies leaves no ready ingress, no lease, and no timer — a stall no ingress projection can express, because the missing fact is the worker's outcome. Every scan therefore reconciles only descriptor-backed lineages whose delivery owner is gone: a worker whose lifecycle is already terminal has its lost delivery replayed idempotently, and an accepted worker with no terminal lifecycle has its interruption recorded as an infrastructure outcome and admitted as an ordinary ingress.

The same scan closes the opposite gap. A dispatch is settled before its outcome is handed to the Orchestrator, so a failure in between leaves a settled lineage — invisible to abandonment recovery, which looks for unsettled work — that woke nothing. Every ingress reduces to `resolved`, no timer is owed, and the Task rests permanently behind a database that looks healthy. A settled lineage with no ingress carrying its outcome is therefore replayed, keyed to the settlement artifact so the replay collapses through the ingress source index.

**Owner liveness is durable, never process-local or Project-owned.** Deciding that a worker is abandoned destroys live work if it is wrong, and two backends may share one database, where each sees an empty local registry for every dispatch the other owns. Each runtime process therefore owns exactly one fenced `runtime_process` lease even when it serves several Projects: the first Task-control driver acquires the process receipt, later Project drivers join the same in-process reference owner, intermediate Project disposal leaves it live, and only the final reference publishes graceful expiry. Physical acquire, renewal, assertion and release use the canonical control-lease primitive. Renewal or assertion fence loss is absorbing for that process owner; explicit requests, queued scan passes, activation admission and dispatch-lineage admission refuse new work instead of reacquiring an occurrence that peers may already have treated as dead. Each current lineage commits the exact process occurrence that owes its delivery and asserts that occurrence's lease inside the same writer transaction; "the owner is gone" means that exact occurrence lease has expired. Local registries remain a fast path for this process's own lineages, where memory is authoritative. Current lineage rows require their exact delivery owner; ownerless predecessor rows belong to another database epoch. Recovery never infers owner liveness from commit time.

### Wake totality

Every non-terminal projection owes exactly one of two things, and the classification is exhaustive over the projection union by construction:

- **a finite wake instant**, which the scan returns for the driver to arm — `leased` at lease expiry, `waiting` at its resume deadline, `cancelling` at a fixed reconciliation period, and anything under an absolute deadline at that deadline;
- **a durable operator-visible surface**, for the states no timer and no fact append can leave. `waiting` without a deadline and `reconcile_required` are surfaced by the pending Interaction that gates them. `host_fault` and `exhausted` have no such row, so the first scan that observes one records a deterministic infrastructure fact naming the ingress, its state, and its reason.

A resting state with neither is indistinguishable from a deadlock, and that is precisely how these states used to present: an ingress exhausted after three decision-less Turns, or stopped on an integrity conflict, would stop silently while head-of-line blocking starved every operator message behind it. Both now release the line, so the surface is the abandoned ingress's only trace rather than a notice pinned to a stalled Task. Surfacing is an observability obligation, not a scheduling one — losing it must never convert a resting Task into a faulting one.

Reduction is total over persisted facts. An evidence reader that finds a violation of the persisted integrity contract raises a typed integrity error, which the fact store catches at its single boundary and the reduction turns into `host_fault/evidence_violation`. Untyped throws stay reserved for infrastructure faults, which the driver may retry. Without that separation an immutable violation escapes as a fault forever: the driver retries every sixty seconds, the designed value is never reached, and the Task is wedged with no surface. Everything an activation derives from immutable sources is computed before its lease is acquired, so a violation cannot consume one of the ingress's four activations on every heartbeat.

A Host fault is local to the ingress that observed it. It executes nothing — the reduction returns it before any decision set can be read as one — so the Task's FIFO continues to the next ingress, each of which reads its own evidence and therefore never runs under the violation. The Host's broken write costs exactly one abandoned ingress and one durable surfaced fact, not a Task that no ordinary user action can leave. It is deliberately the one settled state the scan does not memoize: the invariant it names can be repaired by a later append, and a process-local memo would blind that process to the repair until it restarted.

### Well-founded retry

Retry budgets are frozen per ingress, but an infrastructure failure mints a *new* ingress, and each arrives with a full budget. A worker failing the same way every time therefore had no bound at all, and each cycle cost a whole Orchestrator Turn. Automatic retry must be quantified over something the retry cannot create, so the infrastructure-failure budget is per **epoch** — which changes only at one of the two canonical reopen authorities above. Beyond it the failure is still recorded and surfaced; only the wake is suppressed. Recovery facts carry deterministic identities so a crash between settlement and acceptance replays to the same artifact and dedupes through the ingress source index, rather than minting a second wake with a second budget.

The budget binds every path back in, not just the original wake. A settlement recorded before its wake was suppressed is later observed by the settled-undelivered recovery sweep, and an infrastructure settlement re-entering there is routed through the same infrastructure-failure gate — never as a generic recovery wake, which would continue the exact loop the budget terminates at one wake per crash cycle under a different event name. A suppressed re-entry closes the dispatch: the budget's own surfaced gate is its durable trace, and the sweep stops re-checking it.

`cancelling` is a non-absorbing rest state that expects an owner to finish it. Where a converger is wired, the scan re-attempts convergence on each pass over the boundary; where none is — engine-only runtimes carry none — the periodic wake alone would poll silently forever, so the scan surfaces one deterministic unconverged-boundary gate per (Task, epoch, status) naming the exit. Settled ingress surfaces likewise name their exit, and neither holds the line: `host_fault` names the Host invariant to repair and `exhausted` names the spent budget; both are redone by the same ordinary act, a new operator message.

A boundary request that fails midway leaves the Task in `cancelling`, a status no fact append can leave. Convergence is therefore re-attempted by the scan on every pass over such a Task, with a finite wake until it settles; running it only at project bootstrap made a restart the sole escape. Ownership of that convergence is bounded in the same spirit: the durable lease guarantees some process eventually acquires, so waiting forever only hides a stuck owner.

The completion closure is committed before the terminal transaction runs, and that transaction can refuse — an unsettled dispatch is the common case. The closure is released on refusal. Otherwise the Task rejects every completion for the full lease while the model retries into that window, and the conflict and the retry feed each other.

The reduction accepts one assistant turn's decision set only when it is a sibling `dispatch_agent` fan-out or one single decision. `dispatch_agents` is one such single decision: its real persisted Tool request owns the complete member array, and each immutable lineage binds that request plus exact member index/count rather than a fabricated child Tool occurrence. Initial direct and collection-member lineages atomically insert that write-ahead request and acquire its fenced `dispatch_admission` owner before any child Session, worktree or Provider effect, using the deterministic child Session identity derived from the dispatch. Coordination continuations use the same admission before reopening their existing Session. A concurrent claimant waits for the exact descriptor or terminal settlement; after an expired owner it may take over the same occurrence, but a lineage by itself never returns `accepted`. The owner renews the lease while preparation runs; exact fence loss aborts the combined per-dispatch signal consumed by every physical adapter, and the stale executor cannot publish descriptor or workflow authority under the successor's lease. Descriptor persistence, workflow projection and lease consumption commit together. Lease consumption retains the latest `dispatch_admission` attempt row as the descriptor-backed lineage's delivery-owner transfer receipt; peer recovery checks that latest attempt's process owner even after its preparation lease is consumed, while the immutable runtime-process lineage owner remains the write-ahead owner fact before descriptor acceptance. No predecessor owner variant is accepted in the current database epoch. For a virtual workflow, the claim reserves the initial node occurrence first; its workflow-node projection is materialized only after that exact child Session is durable, so neither the Session foreign key nor the single-effect boundary is weakened. Each collection member disposition is also appended to the outer Tool request's canonical progress facts before the aggregate completes; recovery merges all immutable member checkpoints and never reruns a settled member. Anything mixed is `host_fault/decision_ambiguous` — fail-closed for that ingress, never a guess at which decision was meant. Because a model can emit that combination in ordinary output, the turn coordinator refuses the second, different decision while it is still only a call. A refused call leaves no completed receipt, so the model may still commit a different decision; once a valid collection starts, typed member failures settle inside that collection and cannot release or erase the occurrence. The fault verdict survives as the backstop rather than the mechanism.

The one-assistant-per-continuation conflict refuses a second *turn*, not every sibling row. Session compaction parents its summary assistant — authored `compaction`, carrying no activation — under the newest user Message, which in an Orchestrator Session is the just-written control occurrence, so any Session that lives long enough to compact produces exactly this sibling mid-turn. Counting it inverted the guarantee: the fence refused the legitimate activation assistant while the unfenced summary stood. Compaction summaries are therefore exempt from the continuation conflict; every other authored sibling stays fatal. An integrity violation raised while a Turn is being prepared follows the same rule as one raised while it runs: the Task stays open — the ingress reduces to `host_fault`, the surfaced fact is its trace, and the line moves on — and is never terminally failed over a refused append, on the startup path or any other. A Host defect may not become a durable user Task state.

A request never joins a running scan. A scan may await a whole Orchestrator Turn whose Tools re-enter the control plane; joining would deadlock a caller against its own activation. A non-owner therefore leaves its revision and returns. A hint may still be lost or duplicated; the revision it leaves behind cannot be.

Every `continue` inside a scan is justified by a strictly decreasing well-founded measure — an abandoned assistant terminalized, a reconciliation Interaction created, an abandoned dispatch settled, an activation consumed against its immutable budget. A bounded step guard converts a measure that stops decreasing into the same exponential backoff a fault receives, never into minimum-delay pacing, so a Task that cannot reduce can never spin the reconciler. A fixpoint that will not settle within its pass bound is the same liveness fault and is paced the same way; pacing it at the minimum delay would run a full round of scans every few milliseconds forever. A scan fault is a physical fault, not a fact: it is isolated per Task, re-armed under exponential backoff, and cannot starve a sibling Task. Backoff decays only after a fault-free window as long as the maximum delay, so a Task alternating faults with apparent progress still escalates. Wakes accumulate by minimum across passes: a pass that reports no wake means it owes none, not that an earlier pass's obligation is cancelled.

Database epochs do not cross this boundary. Startup compares every table, index and trigger with the current canonical DDL before any application write; any difference returns `SCHEMA_RESET_REQUIRED` and leaves the database untouched until an explicit reset rebuilds it. Startup runs no historical row interpreter or trigger repair. Portable transfer is a strict current-schema move: it validates the complete current fact closure, temporarily suspends only the dependency triggers needed for import ordering inside the transfer transaction, restores those exact canonical triggers, and commits only after the same closure passes again.

## Overlay live-delivery ownership

The Overlay projects one selected conversation through a single explicit SSE lifecycle: `idle`, initial `connecting`, `connected`, or failure `reconnecting`. Task selection, Project selection, and server-directed live-cursor reset are initial connection work and cannot become an outage warning. Only an established stream that closes unexpectedly or stalls enters `reconnecting`; successful open is the only transition to `connected`, and explicit disposal returns to `idle`.

The selected child Session transcript keeps its backend route as the transcript authority, but streamed transcript revisions are invalidations rather than request identities. The Overlay performs the initial target load immediately, coalesces later revisions on a short cadence, permits one refresh in flight, and retains at most one trailing refresh. Target identity includes the exact source, Session, and Project directory, and changing it disposes all pending work for the old target.

Persisted child transcript hydration and live delivery are consecutive phases of that same transcript. The selected Task SSE is the live authority: the dock applies exact selected-Session full-Part snapshots, Part deltas, and removals over its persisted base in process, without polling or opening another stream. A full Part snapshot supersedes earlier deltas for that Part; later deltas append by exact field. The projection is disposed on target change. Its reactive growth feeds the shared conversation scroll owner, which suspends follow only after an operator input produces actual upward movement away from the bottom and restores follow when the viewport returns to the bottom.

## Verification authority

The following gates define the maintained control-plane proof:

- `bun run check:control-state-redundancy` inventories every scoped persisted field and rejects derived or unclassified columns plus known cross-table functional dependencies;
- focused reducer, current-schema/reset/transfer, Task continuation, lifecycle, Tool/Provider, Protocol delivery, Scheduler, Bus, Mission, process-occurrence/physical-lease, and terminal closure tests assert positive fact/projection contracts;
- storage schema-contract tests prove canonical SQLite Data Definition Language, schema fingerprint, and MySQL transfer shape equality;
- `bun run typecheck`, `bun run docs:check`, and `git diff --check` remain required;
- the real streaming Provider checker is run only when credential and exact model projection use is explicitly authorized.
