# Task-root fact-reduction kernel

## Recall

- User request: replace the multiply persisted scheduler state machine with a detailed design and begin implementation from the rule “persist only facts that cannot be lost; derive every other state”. In particular, prose-only model output remains a real assistant Turn under the same unresolved ingress and must not create a new business ingress or a persisted `decision_attempt` state.
- Acceptance:
  - zero redundant durable authority: if a field or row can be deterministically derived from other durable facts, it is absent from the persisted model rather than retained as a cache;
  - one immutable accepted ingress remains the causal business input until exact domain, interaction or lifecycle facts prove its resolution;
  - every real assistant Turn for that ingress is visible and is sufficient to derive the next continuation identity and any decision budget consumption;
  - a model Tool decision, explicit wait/question, cancellation/closure fence, or a budget/deadline projection is the only condition that resolves, suspends or blocks the ingress; prose never resolves an execution ingress;
  - Provider, Tool, Git, file, dispatch and other external effects are replayed only from their exact durable receipts;
  - an expiring physical lease answers only who may execute now; it never answers whether the business input is resolved;
  - queue entries are replaceable activation hints and one reconciler can rebuild them from unresolved facts plus expired leases;
  - restart, retry, cancellation/reopen, normal and terminal Task paths, Session occurrence reuse, concurrent input, and multi-project isolation converge without a process-local owner map or scanner-specific status becoming authoritative;
  - focused positive tests, a real Task-control checker where credentials/model projection are authorized, and an uninvolved read-only review prove the production path.
- Hard constraints: all Large Language Model (LLM) calls remain streaming; the model owns business serial/parallel decisions; Host code does not parse prose or add a workflow gate; real participants produce all visible messages; there is one current implementation and no compatibility reader, fallback, shadow projection or dual write after cutover; user credentials are neither read nor logged without explicit authorization; no User Interface (UI) automation test is added, changed or run.
- Read material: `specs/current/architecture/task-control-plane.md`; `specs/current/architecture/02-data.md`; `specs/records/2026-08/2026-08-11-scheduler-systemic-fault-audit-and-repair.md`; `specs/records/2026-08/2026-08-11-scheduler-liveness-and-control-convergence.md`; `specs/records/2026-08/2026-08-15-task-root-ingress-decision-convergence.md`; Task-root ingress schema/delivery/reducer; Task/Session/Message schemas; runtime contract and root Prompt ownership; dispatch lineage/settlement; Task cancellation authority; project bootstrap and server recovery ordering.
- Repository search:
  - the current `task_root_ingress` Artifact is mutable and simultaneously stores the accepted input, `accepted|delivering|delivery_failed|...` label, `delivery_attempt`, runtime identity, semantic and activation counters, prior semantic rejection, and terminal result;
  - assistant Messages already durably carry exact ingress identity and parent Message identity, while completed Tool Parts, coordination actions, dispatch settlements and Task completion decisions already provide exact business/effect receipts;
  - `SessionPromptState`, `SessionRuntimeContractStore`, completion maps and runtime ownership identify physical in-process execution but are not durable business authorities;
  - recovery is split among interrupted ingress recovery, failed exact terminal ingress recovery, lifecycle delivery recovery, dispatch-infrastructure recovery, pending coordination reconstruction and bootstrap ordering;
  - Task status is already partly derived from timestamps/error/cancellation metadata, but cancellation convergence still owns a separate mutable lease and Task-root ingress terminalization writes another copy of cancellation effect;
  - Mission and scheduler occurrence systems exhibit the same fact/projection/lease pattern, but their atomic cutover is excluded from the first Task-root implementation slice.
- Existing uncommitted work: the `decision-attempt-v1` implementation and its debug-copy transport changes are present in the shared worktree. Debug-copy changes are orthogonal and retained. The persisted decision/activation state design is superseded by this record before it is committed as architecture.
- Independent agent feedback: none at design start. A read-only independent review is mandatory after the first verified implementation and again after any review-driven repair.

## Problem decomposition

The observable freeze is not one invalid transition. The control plane permits the same causal fact to diverge across ingress label, delivery result, assistant ancestry, runtime owner, activation counter, retry owner, Task terminality and recovery-scanner progress. A local fix can make one pair consistent while another scanner recreates the contradiction.

The direct trigger in the recorded incident was a prose-only assistant Turn without a committed scheduling decision. The old path classified that as delivery failure and replayed a deterministic control occurrence. Because the old assistant receipt and a newer global Message fence disagreed, the FIFO head could never resolve. The `decision-attempt-v1` repair removes the global fence but persists two new independently changing counters and several new blocker labels. It narrows the incident but does not remove the underlying multiple-authority model.

The root cause is therefore duplicated authority. The cutover must change storage ownership, selection, claiming, settlement and recovery together; changing only the reducer or retry loop would leave a second source of truth.

## Canonical facts

The Task-root slice uses one immutable ingress family, an immutable policy fact, existing domain/effect/lifecycle facts and one physical lease family:

```text
TaskRootIngressAccepted {
  ingress_id, task_id, execution_epoch, sequence,
  source: Task(task_id) | Message(message_id) | ProtocolEvent(event_id) |
          AutomationRun(run_id) | EngineArtifact(artifact_id) | InlineFact(fact_id, payload),
  policy_id,
  accepted_at
}

TaskRootIngressPolicy {
  policy_id,
  semantic_no_decision_turn_limit,
  physical_activation_limit,
  absolute_deadline?
}

ControlActivationLease {
  activation_id,
  target: Ingress(ingress_id) | LifecycleOperation(protocol_event_id),
  owner_occurrence_id,
  activated_at, expires_at
}
```

`TaskRootIngressAccepted`, its content-addressed policy and the selected lifecycle events are append-only. A lease row is appended for each activation and only its expiration may be extended while the same owner holds it; expired rows remain the sole physical-attempt history used for an absolute budget. There is no separate activation-attempt fact or counter. Normalized Message/Part, dispatch settlement, coordination action, interaction and Task completion records are the canonical domain/effect facts. There is no parallel generic Activity table and deliberately no generic resolution, budget-exhausted or integrity-failure receipt: all outcomes are deterministic projections of those facts and policy.

An ingress references an already durable Task, Message, Protocol Event, Automation run, or Engine Artifact instead of copying its payload. Only an input with no other durable owner uses the inline-fact branch, where `ingress_id` is also the deterministic producer/source identity and only the payload is added. The source discriminator exists solely to select the locator authority; `source_id` is the sole stored identity for that branch. Idempotency is unique on `(task_id, source, source_id)` across every epoch. Acceptance separately verifies that the source targets the current open epoch; replay after reopen returns the old ingress or is fenced, never creates a second accepted fact. `root_session_id` is derived through the immutable Task-execution-to-root-Session binding. Likewise, `execution_epoch` is not copied into leases because their ingress foreign key determines it. The schema review must remove every similar same-row or cross-row restatement.

The accepted ingress contains no delivery label, attempt, runtime/process identity, prior rejection or terminal result. `sequence` is allocated in the acceptance transaction and is immutable inside `(task_id, execution_epoch)`.

## Reducer and projections

For a Task occurrence, the only business projection is:

```text
Reduce(accepted ingress facts,
       domain decisions and the accepted policy,
       the selected lifecycle event authority,
       exact Message/Part and activity receipts,
       current time for lease validity)
```

For each ingress, the first matching rule in this total order is the one projection, so states cannot overlap:

- `blocked` when exact immutable facts conflict;
- `resolved` when exactly one valid assistant-owned domain decision set or lifecycle boundary proves the ingress outcome and no conflict exists; one completed assistant Turn may own multiple sibling `dispatch_agent` receipts as one atomic set, while every other set contains exactly one receipt;
- `leased` when unresolved and a matching-epoch lease is still valid by expiry and causal Turn/activity consumption;
- `reconcile_required` when an irreversible activity request has no outcome fact after its activation is no longer valid; this blocks ordinary command replay but permits an exact outcome query or same-key idempotent reconciliation;
- `waiting` when the latest exact decision receipt creates an unanswered interaction or a future absolute wake deadline;
- `exhausted` when the immutable policy and fact set deterministically prove semantic/physical exhaustion or the absolute deadline has elapsed;
- `ready` otherwise.

`running`, `idle`, `answered`, `resolved`, queue position, retry scheduled, recovery processed and process owner are views. They are never written back to the accepted ingress and are not stored in a durable projection table.

The reducer fails closed on decision receipts owned by multiple assistant Turns, multiple receipts in one Turn when any receipt is not `dispatch_agent`, an epoch mismatch, a receipt whose assistant parent is outside the ingress continuation chain, or an external-effect receipt with conflicting causal identity. Multiple sibling `dispatch_agent` receipts owned by the same completed assistant Turn are one atomic scheduler decision set, not a conflict. Integrity failure is the conflict projection itself; appending a second blocker fact is prohibited.

## Continuation semantics

Every Task-root continuation control Message carries:

```text
taskIngress: {
  id,
  predecessor_id: ingress_id_for_initial | assistant_message_id
}
```

The source locator determines ingress kind. The control Message references the exact predecessor; the initial edge uses the non-null ingress ID sentinel and later edges use the prior assistant ID. The assistant stores no Task-ingress metadata because its existing `parentID` points to the control Message; it stores only the physical `activation_id` that fenced its Provider execution. A unique database constraint on `(ingress_id, predecessor_id)` permits exactly one real continuation edge, including the initial edge. The next control Message/Part identity is deterministically derived from that pair. The continuation ordinal is the ordered length of this validated chain and is never stored.

After a streaming Turn:

1. persist the real assistant Message and all Tool Parts;
2. classify exact receipts produced by that Turn;
3. commit the domain decision, Interaction or lifecycle fact in its existing sole authority; do not append a second completion receipt;
4. otherwise release no business state and emit only a disposable reconciliation hint for the same ingress;
5. the ordinary reconciler acquires the next lease and runs the same Session continuation.

No Host-generated user Message is invented for prose-only output. A non-participant ingress uses one real Orchestrator control Message for the initial fact; later Turns continue from the real preceding assistant Message and an Orchestrator-authored continuation instruction that refers to the same persisted fact. An operator-authored input follows the same rule: a prose response is visible conversation evidence but not execution completion. A status-only conversational request produces the explicit typed `no_action` decision receipt after its visible answer rather than relying on prose as a second completion authority. `wait` remains only the distinct scheduled-wake decision for a named external event with a defensible duration.

The semantic budget is evaluated against the ingress's immutable policy as the count of validated, completed assistant Turns that have no decision/wait receipt and no Provider/execution error. Aborted, failed and decision-producing Turns are excluded. Reaching the limit directly projects terminal `exhausted`; no exhausted receipt or mutable attempt counter is written. Physical exhaustion is likewise `count(lease rows) >= physical_activation_limit` while unresolved and unleased.

## Physical activation and retry

Lease acquisition is a single immediate transaction:

1. reduce the ingress from current facts;
2. reject resolved, waiting, stale-epoch or already leased work;
3. count prior activation lease rows against the absolute physical budget/deadline;
4. insert one new lease row with a fresh fencing `activation_id` after proving no unexpired lease exists;
5. enqueue or directly signal an in-process activation hint after commit.

The worker rereads facts after acquiring the lease and before every external effect or resolution append. Every commit carries `activation_id` as a fencing token and succeeds only while that exact lease is still the latest valid lease for the ingress and epoch and `now < policy.absolute_deadline` when a deadline exists. A lease is valid only while `expires_at > now`, the ingress is unresolved, and the activation has not reached a derived Turn boundary. A Turn boundary requires a completed assistant Message bound to that activation whose finish reason is not an intermediate Tool-call continuation, plus zero outstanding activity requests for the activation; a wait decision or Provider failure also requires zero outstanding activity requests. A single completed Provider step or sibling activity outcome never consumes the activation. Tool-result continuation remains under the same activation until the final assistant boundary. Thus a healthy prose-only or waiting Turn deterministically ends its activation and the reconciler may immediately acquire a continuation/reconciliation lease without a release flag or timeout. Lease renewal changes only `expires_at`. Process death before a Turn boundary leaves the row valid only until expiry; reconciliation later inserts a successor lease. A Provider error is represented by its assistant/activity fact and classified by Provider policy; it is not converted into a root delivery state. Deadline expiry rejects new decisions/effect requests, but any activity requested before the deadline remains `leased` or `reconcile_required` until its outcome is known; the deadline never erases an unknown external effect.

An irreversible external operation uses one deterministic activity identity and a write-ahead request fact committed under the lease before the call. The request and outcome reuse the domain's sole fact types: an immutable Tool-call request Part plus a separate immutable Tool outcome Part, Provider request/assistant outcome facts, a dispatch lineage/settlement pair, or the corresponding Git/file operation facts. Mutable Tool `pending/running/completed/error` state is removed. The request stores `activation_id` but not a duplicate ingress ID. If the process disappears between effect and outcome, the reducer derives `reconcile_required`; it never repeats the effect unless the provider accepts the same idempotency key or an explicit reconciliation proves the outcome. A successor activation cannot use a new activity identity for the same command. The request is not redundant with the outcome: it is the only durable evidence that an unreceipted effect may already have occurred.

Effect adapters obey one of three explicit contracts: transactional effects commit the lease predicate, effect and outcome atomically; idempotent remote effects receive the stable activity key and may be safely reconciled/reissued with that same key; non-idempotent effects stay `reconcile_required` after an unreceipted request and require an authoritative query or an explicit operator interaction/outcome fact. Filesystem and Git operations hold their existing exact repository/file lock after the write-ahead request; a successor sees the same activity identity and reconciles it instead of starting a competing operation. No generic lease check is claimed to fence a system that cannot honor a token.

## One reconciler

Project reconciliation is the only recovery algorithm:

```text
for each open execution epoch:
  reduce accepted ingresses in sequence order
  reconcile exact external-effect receipts
  if head is ready and lease absent/expired: acquire and hint activation
  if head is resolved: advance to the next sequence
  if head is waiting: stop ordinary FIFO activation for that epoch
  if head is reconcile_required: acquire only the exact effect-reconciliation lease
  if head is exhausted: advance because policy plus immutable facts prove that ingress's terminal budget result
  if head is blocked by integrity conflict: stop and project the exact conflict
```

Normal post-acceptance wakeup, startup, expired-lease recovery, delayed deadline wake and post-receipt continuation all call the same operation. Dedicated scanners may remain only as producers that append their own domain fact (for example, a newly observed worker lifecycle receipt); they may not claim or mutate Task-root delivery state.

An Interaction answer/reject fact is causally attached to the waiting head and is not a new root ingress, so it may unblock that head without bypassing FIFO. Cancellation and closure lifecycle requests are out-of-band epoch fences and may preempt a waiting head. Unrelated operator or lifecycle inputs remain later FIFO facts. An absolute `resume_at` deadline becomes ready from the policy/decision timestamp and the current clock; no redundant “deadline elapsed” fact is appended. An integrity conflict freezes the epoch until repaired or superseded by an explicit lifecycle boundary. A semantic/physical/deadline exhaustion is itself a deterministic terminal reducer result, so a later explicit operator ingress may proceed without inventing an exhaustion receipt or mutating the exhausted ingress.

Reconciliation is project-partitioned, reentrant and idempotent. One project failure is an exact result for that project and does not suppress other projects. Terminal Tasks use the same reducer; terminal conversation authority changes which decisions are valid, not how ingress is stored or activated.

## Epoch and lifecycle fences

The existing Task start timestamp is replaced as causal identity by a monotonically increasing execution epoch. The append-only `protocol_event` log is the sole lifecycle authority; no `engine_task_lifecycle_fact` table is added. `Opened(epoch=1)` is the atomic initial-epoch allocation fact. `Cancelled(epoch)` and `Closed(epoch)` are mutually exclusive terminal alternatives enforced in the append transaction; `Reopened(epoch + 1)` requires one prior terminal boundary, is also the next `Opened`, and makes all prior leases and late receipts inapplicable by identity. Existing Task timestamps/error/cancellation metadata that restate these events are deleted in the same cutover; public status is a reducer projection.

Cancellation requests remain explicit facts. From `CancellationRequested(epoch)` until its terminal boundary, the reducer projects `cancelling`: it admits only the lifecycle-operation lease, rejects new ordinary ingress activation and rejects late business-decision commits, while allowing exact already-requested external effects to append/reconcile their outcomes. Reconciliation appends `Cancelled(epoch)` only after those required outcomes converge. Unresolved ingresses from that epoch then reduce to terminal-inapplicable through the lifecycle boundary; no bulk mutation is performed. Closure uses the same rule. The shared lease target union lets cancellation/closure own cross-process execution without pretending that the lifecycle request is a root ingress.

Interaction storage follows the same normalization: one immutable request fact and exactly one immutable answer, rejection or expiration fact. `pending`, `answered`, `rejected`, `expired`, `response` mirrors and `time_resolved` columns are removed; waiting is derived by joining the request to its optional outcome. The outcome fact is accepted out of band only for the exact waiting interaction and carries its ingress/epoch causation.

## Storage and uniqueness

The first cut adds dedicated tables rather than encoding more mutable labels in the generic Artifact row:

- `engine_task_root_ingress` — immutable accepted fact; unique `(task_id, execution_epoch, sequence)` and source identity;
- `engine_control_activation_lease` — one row per physical activation; immutable target/identity/owner/start plus renewable `expires_at`, indexed by normalized target. Ingress-target history supplies its retry-budget evidence; lifecycle operations use the same physical primitive without becoming ingress facts;
- `engine_task_root_ingress_policy` — content-addressed immutable policy facts; ingresses reference them instead of copying limits/deadlines or consulting mutable configuration;
- hardened `protocol_event` lifecycle rows — the sole Task/Mission/Session lifecycle authority. The append transaction admits one open event and at most one mutually exclusive terminal boundary per epoch; all former lifecycle mirrors are removed in the same subsystem cutover.

Text/reasoning Message Parts retain their streaming update-to-completion transport contract and become immutable when their assistant Message completes. Effect lifecycle is excluded from that mutation contract: Tool request and Tool outcome are separate immutable Parts, and dispatch/Provider/Git/file request/outcome facts never overwrite one another. Task-root schemas correlate them by exact control parent and activation identity. Foreign keys prevent deleting causal anchors while a fact depends on them.

No table stores a materialized `state`, `status`, `answered`, `active`, `attempt_count`, `queue_position`, `recovery_progress` or equivalent derived value. Read performance is provided by indexes over immutable fact identity and time, not by durable state caches. An in-memory memoized reduction may exist only if it is disposable, invalidated by the fact commit stream and never consulted for correctness.

## Zero-redundancy proof obligation

Every persisted column introduced or retained in the control plane must be classified in the schema review as exactly one of:

1. external or participant input that cannot be recreated;
2. immutable identity or causal ordering needed to distinguish facts;
3. receipt for an irreversible/unknown external effect;
4. lifecycle boundary or explicit operator wait/deadline;
5. physical lease coordinate required for cross-process exclusion;
6. immutable budget/deadline policy whose historical value must survive configuration change.

If the value can be computed from other rows, clocks or identities, it fails review and is deleted. A field cannot be justified by convenience, query speed, UI display, recovery scanning, logging or compatibility. The migration checker enumerates every control-plane table/JSON schema field and fails when an unclassified persisted projection remains.

### Audited legacy control inventory

The initial schema scan establishes the following mandatory cutovers. “Replace” means the old field is deleted when its subsystem switches; it never becomes a compatibility projection.

| Current persisted concept | Sole surviving fact | Derived projection or action |
| --- | --- | --- |
| root ingress label, `delivery_result`, delivery/runtime attempts and decision control | immutable accepted ingress/policy; exact Message/Part/domain receipts; activation lease history | readiness, resolution, blocker reason, semantic/physical counts |
| Task `time_started`, `time_completed`, `error`, cancellation metadata mirrors | execution-open/close/cancel/reopen lifecycle events and exact failure receipt | Task status, active/inactive, terminal reason and epoch |
| cancellation authority convergence owner/lease | cancellation-request event plus the shared activation lease primitive | cancellation requested/converging/completed |
| Session control `pending/consumed/failed`, owner and wake record status | immutable control request, exact consumer/assistant receipt and activation lease | pending/consumed/failed and current owner |
| protocol inbox `status`, attempt, visible time, error, delivery result and lease columns | immutable envelope, exact delivery/effect receipt, deadline fact and activation lease | ready, delayed, delivered, failed and retry count |
| Event fire `pending/running/retry_wait/succeeded/disposition`, owner, attempt and terminal timestamps | event occurrence, immutable disposition/effect receipts and activation lease | fire status, cooldown eligibility and retry count |
| Event job `last_run`, `last_event`, failure count/error | fire and outcome facts | last activity and failure summary |
| Automation `last_run`, failure count/error, next run and definition-level lease | immutable schedule definition/revision, fire/outcome facts and activation lease | next due time, history and failure summary |
| Automation run owner/outcome/timestamps/error | activation lease, created Session/Message and terminal activity receipt | running/retry/success/failure |
| Mission closing/running/terminal mirrors and recovery markers | Mission lifecycle events, exact Task/Session/decision receipts and activation lease | Mission status and recoverable frontier |
| workflow-node occurrence `state` plus nullable bound/conflict mirrors | immutable binding or conflict fact, each with its own exact payload | bound/conflicted projection |
| interaction request status and resolved time | immutable request plus answer/reject/expire fact | pending/resolved status and resolution time |
| progress snapshot status | underlying Task/Goal/receipt facts; optional user-authored narrative remains a domain fact | progress status and summary generated at read time unless the summary itself is explicitly authored evidence |
| Build cleanup status, attempts and last error | immutable cleanup request plus exact cleanup outcome/unknown facts and activation lease | pending/current owner/attempt count/outcome |
| process-local owner maps and completion sets | no durable authority; active lease plus local Promise only | performance/join bookkeeping |

Definition controls such as an operator-authored Automation pause, Event enabled flag, deadline, recurrence and immutable retry budget are business inputs, not derived execution state. Their changes become versioned definition facts; mutable “current definition” rows are removed if they obscure that history or duplicate a revision authority.

## Atomic cutover and historical data

There is no compatibility reader. Before readers start, one explicit current-database migration converts every historical `task_root_ingress` Artifact version into the new fact tables:

1. recover the immutable acceptance source locator and FIFO ordinal from the earliest Artifact version/current row without copying a Message or Protocol Event payload;
2. derive the execution epoch from the historical Task occurrence identity;
3. inspect exact assistant parentage, Tool Parts, interaction and domain receipts;
4. preserve existing exact domain receipts directly; derive exhaustion and integrity blocking without appending a duplicate disposition;
5. preserve exact activity requests/outcomes but do not reconstruct legacy root activation history or reinterpret `delivery_attempt` as a semantic/physical count;
6. verify source identity and FIFO uniqueness;
7. remove migrated `task_root_ingress` Artifact rows and obsolete runtime fields in the same migration boundary.

If any row cannot be classified without guessing, migration stops with an exact diagnostic. It does not retain a legacy read path. Fresh databases create only the new schema.

Legacy labels are not imported as facts. They are handled as follows:

| Legacy value | Migration rule |
| --- | --- |
| `accepted`, `delivering`, `delivery_failed` | import the source and exact Message/activity evidence; the reducer yields unresolved, waiting, resolved or blocked |
| `delivered` / `completed` | resolved only when an exact decision, interaction or lifecycle fact exists; prose-only history remains unresolved and continues visibly |
| `passive_delivered` | never fabricated into `no_action`; import as prose evidence and leave unresolved unless another exact decision exists |
| `terminal_inapplicable` | derive only from a stale epoch or lifecycle boundary; otherwise stop migration with the conflicting row locator |
| `control_blocked`, `physical_exhausted` | discard the label/counter; derive only from post-migration validated Turn/lease facts and the frozen migration policy |
| `integrity_blocked` | derive from the underlying immutable conflict; if the conflict cannot be reproduced, discard the stale projection and leave the ingress unresolved |

Legacy `delivery_attempt` and runtime-attempt values are never converted to activation history. Migrated ingresses therefore start with zero lease rows. A content-addressed migration policy freezes the exact granted remaining semantic and physical limits, so the reducer formula remains simply `count(new validated Turns or lease rows) >= migrated limit`; no reconstructed count is deducted twice. This explicit migration policy is the sole historical rule, not a hidden reset branch. Every source kind must resolve to a Message ID, Protocol Event ID or inline ingress fact; missing or multiply matching sources fail migration.

## Implementation slices

1. Freeze this design and replace the superseded `decision-attempt-v1` architecture text. Produce a machine-checked persisted-field classification inventory before adding schemas.
2. In one production cutover, strengthen `protocol_event` as lifecycle authority; migrate/remove Task lifecycle mirrors; convert Task-root acceptance, selection, lease, settlement, cancellation/reopen, terminal delivery and same-Session continuation; normalize effect request/outcome facts; replace startup/normal recovery with the one reconciler; and delete mutable ingress writers, attempts, global Message fences and dedicated scanners. These changes cannot be split because they share the epoch fence.
3. Execute the historical migration in the cutover transaction, remove the generic `task_root_ingress` Artifact kind and obsolete tests, then update SDK/debug projections.
4. Prove late completion, restart, concurrent cancellation and unknown-outcome recovery across normal and terminal Task paths before enabling the migrated reader.
5. Cut Mission, Automation, Event and Session occurrence control over against the same fact/projection/lease matrix, one subsystem at a time with no dual authority. Final program acceptance requires the machine-checked inventory to report zero persisted derived fields across all scheduler/control-plane tables and JSON contracts.

## Positive verification matrix

- initial ingress → lease → streaming assistant → committed Tool decision → one resolution;
- prose-only Turn → same ingress continuation → later decision, with all Turns visible;
- explicit question/wait → waiting projection → answer/deadline fact → same ingress resumes;
- owner crash before Message, during streaming, after Message and after decision receipt;
- lease expiry/reclaim and stale owner late commit;
- Provider transient failure and unknown external-effect outcome with exact activity reconciliation;
- cancellation before claim, during Turn and after decision but before lease release;
- reopen fences old epoch while accepting sequence one in the new epoch;
- terminal Task operator conversation and lifecycle ingress use the same reducer;
- multiple accepted inputs preserve FIFO without persisted queue position;
- two Tasks in one project and two projects in one process remain isolated;
- restart with an empty/duplicated hint queue reconstructs exactly the ready work;
- semantic and physical budgets terminate through immutable policy plus fact projection;
- historical migration succeeds on each known legacy disposition and fails closed on contradictory receipts.
- persisted-field classification checker reports zero unclassified or derived control-plane fields; rebuilding every public status from facts after deleting disposable queues/memos produces identical projections.

## Risks and exclusions

- This is a storage-authority migration, not a local retry patch. Partial production cutover is prohibited; implementation must keep the current reader active until the replacement acceptance-through-recovery path and migration are complete, then switch and delete the old path in one commit.
- Queue technology and in-process Prompt ownership may be reused as performance primitives, but their data is excluded from `Reduce(F)`.
- Generalized event sourcing for product Artifacts is excluded. The zero-redundancy requirement covers the complete execution control plane—Task, Mission, Session occurrence, scheduler wake, cancellation/closure and recovery—but not domain documents whose current value is itself the business fact.
- The existing debug-copy transport repair is retained but is not evidence that the scheduling redesign is complete.

## Implementation evidence

- Design and repository-wide impact audit complete. The audit covered every production acceptance path, Task/Mission/Session occurrence, normal and terminal settlement, retry/restart recovery, concurrent and multi-project execution, public projections, storage transfer schema and historical migration.
- The production storage cutover is implemented: Task-root inputs and policies, lifecycle boundaries, Session control requests/receipts, Workflow occurrence facts, Mission closure facts, Automation/Event fire facts, Protocol inbox/delivery receipts, Bus publication receipts, Provider activity request/outcome facts and Tool request/outcome facts are immutable authorities. `control_activation_lease` is the only persisted physical ownership primitive.
- Durable derived authorities were removed rather than mirrored: mutable ingress/delivery labels and attempts, mutable Task lifecycle fields, Session occurrence status, Interaction status, rewind state, scheduler fire status, protocol delivery status/result/error projections, Provider/Tool mutable completion state, process owner recovery state and subsystem-specific retry owners/scanners no longer participate in the canonical schema.
- Historical databases are rebuilt inside the schema migration transaction before drift validation. The migration normalizes Task lifecycle Protocol Events to aggregate identity, converts known legacy control rows to immutable facts, reconstructs immutable request/outcome receipts, drops superseded columns/tables/indexes, and fails closed on contradictory or unresolvable facts.
- `bun run check:control-state-redundancy` machine-checks the closed control-plane table inventory, forbidden functional dependencies, JSON identity duplication, append-only triggers and exact terminal receipt constraints. The current inventory covers 43 tables in seven allowed fact classes and reports zero derived or unclassified durable fields, including Channel ingress, Git checkpoints and Permission request/decision/execution facts.
- Focused positive verification covers reducer total ordering and conflicts, prose continuation/FIFO leases, stale activation fencing, reconciliation-required effects, lifecycle closure, reopen/rewind facts, Protocol sequence/delivery projection, Provider/Tool fact storage, Automation/Event fact projections, durable Bus recovery, immutable Interaction and Workflow occurrence recovery, Build cleanup activation/restart, schema migration and storage schema parity. The current main-agent matrix passed 191 unique focused tests across 36 files with zero failures, including real temporary databases, restart recovery, runtime ownership transfer and terminal closure.
- Terminal Task notification is an explicit request/outcome effect rather than a second lifecycle fact: the Protocol payload stores only epoch/result under its Task aggregate identity, while the durable Bus delivery request carries the transient consumer locator. A positive storage test proves both shapes.
- `bun run typecheck`, `bun run docs:check`, `bun run api:routes-check`, the OpenCorvus production build, Overlay Vite production build, SDK generation/build, Overlay i18n check, `git diff --check`, schema parity and all affected focused tests pass. The documentation check also exercises the repaired lazy Session overlay schema boundary, eliminating its prior import-cycle failure. An isolated real OpenCorvus page at `http://127.0.0.1:4096/ui/` was opened, captured and manually inspected after removing the obsolete ingress Artifact badge path; the main conversation shell, project navigation and composer remained visually coherent without a shadow-state placeholder.
- The authorized real streaming Provider checker remains intentionally unexecuted because this task has no explicit credential/model-use authorization; its `TASK_CONTROL_CHECK_ALLOW_REAL_PROVIDER=1` boundary remains intact and no credential was read.
- Final independent review found five valid closure gaps. Review-driven repair made Channel `request_id` mandatory and removed its JSON identity mirrors, reduced Permission execution results to their sole attempt/payload receipt, made completed Git operation keys absorb migrated outcomes before exact-input comparison, migrated the Project identity convergence test to current Channel facts, and restored its closed immutable-domain inventory. The affected OpenCorvus matrix passed 34 tests, the Channel Runtime matrix passed 19 tests, and the control-state checker passed all 43 tables across seven fact classes. The same uninvolved agent then performed a second read-only review and reported no unresolved findings; only the scoped commit and upstream push remain pending.

## Execution Goal and benchmark

### Task definition

Implement the complete zero-redundancy execution control cutover. The benchmark is not satisfied by a reducer unit test or by deleting the incident's fields alone: the current SQLite Data Definition Language (DDL), JSON contracts, production writers/readers, recovery entry points and real Task-control path must all use facts plus physical leases without a durable derived status.

### Input and qualified output

- Input: a fresh canonical SQLite database; historical pre-cutover Task-root rows covering every legacy disposition; Task, Session, Mission, Event and Automation commands; simulated process loss at each effect/receipt boundary; and an optional authorized real streaming Provider/model projection.
- Qualified output: every accepted input has one cross-epoch source identity; all public status is reproducible from immutable facts, immutable policy and the current clock; an empty or duplicated hint queue rebuilds the same ready frontier; stale activations cannot commit; unknown effects cannot replay; prose-only Turns continue the same ingress; and the schema inventory reports zero derived or unclassified persisted control fields.

### Environment and entry points

- Runtime/dependencies: repository Bun runtime and packages declared by the root and `packages/opencorvus/package.json`.
- Database: isolated temporary OpenCorvus roots created by the existing test/checker primitives; user databases are never modified by benchmark runs.
- Real Provider: existing `packages/opencorvus/script/task-control-check.ts`; credentials and exact model projection are loaded only when `TASK_CONTROL_CHECK_ALLOW_REAL_PROVIDER=1` is explicitly authorized. The checker must independently verify credentials, projected model catalog and requested model identity before launch.
- Primary static/runtime gate: `bun run check:control-state-redundancy` from the repository root.
- Focused integration gate: the repository inactivity runner around the exact control-plane test files; no unbounded root `bun test`.

### Inactivity timeouts

- Static inventory, typecheck and focused in-process tests: 120 seconds without output/activity.
- Process/restart integration: 120 seconds without durable Message, Part, Protocol Event, lease or effect-receipt progress.
- Real streaming Provider Task-control check: retain its activity-resetting inactivity window; do not impose a total wall-clock deadline while durable/model activity continues.
- Long benchmark phases are polled by bounded periodic wakeups rather than continuously tailing logs.

### Executable acceptance

1. The DDL/contract inventory enumerates every persisted field in the execution-control scope and exits zero only when each is classified as input, causal identity/order, immutable policy, immutable request/outcome/lifecycle fact, or physical lease coordinate. Derived/unclassified fields are a hard failure.
2. Fresh schema construction, schema fingerprint and MySQL transfer schema agree on the one new model; no compatibility reader or dual writer exists.
3. Focused positive tests cover the full matrix above with explicit reducer outputs, facts and typed errors. UI automation is neither created nor run.
4. `bun run typecheck`, `bun run docs:check`, `git diff --check` and the affected package checks pass.
5. `bun run check:task-control-real` passes when credential/model use is authorized; otherwise its exact authorization boundary is recorded as unexecuted rather than reported as a pass.
6. After all implementation and main-agent verification pass, one uninvolved read-only agent reviews the full diff, benchmark evidence, migration and deleted paths. Every valid finding is repaired and the affected gates rerun before completion.
