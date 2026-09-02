# Scheduling Razor Remediation Cut 8c — Immutable Agent Coordination

## Recall

### User request

- Continue the iterative multi-agent audit of the current scheduling design and repair every confirmed issue, especially duplicated authorities, contradictory state machines, and mechanisms that violate Occam's razor.
- Do not preserve database compatibility through a large migration. This cut changes the current schema epoch directly; an old schema fails closed through the existing schema-reset contract.
- Keep B2 independent from the concurrently owned B5 physical-capacity cut. Do not edit or stage B5 paths or the three pre-existing working-tree exclusions.

### Acceptance criteria

1. Agent Coordination request, response/action attempt, and terminal action outcome are immutable durable facts. No request or action Artifact is rewritten to represent a new business state.
2. One reducer derives `pending`, `responded`, `superseded`, the current action, and replay output from those facts plus the Task execution epoch. Protocol events remain notification/outbox projections and are never reducer input.
3. A failed action exposes exactly one new retry frontier. Concurrent responders for the same frontier produce one accepted attempt; same Tool occurrence replays it and changed input returns a typed conflict.
4. Current pending reads are Task/Session bounded and indexed. They do not materialize all coordination history before filtering.
5. Redispatch, cancel-worker, ask-user, fail-task, terminal acknowledgement, Task description, Task-root ingress, and restart recovery use the same reducer. Task reopen supersession is derived from its existing immutable execution epoch; there is no parallel request-cancellation fact.
6. Public operator-steer uses a caller-stable HTTP request identity. Same identity plus the same canonical message/target replays one request and one Task-root ingress; changed semantics return a stable typed 409; two processes cannot create two winners.
7. Request persistence and Task-root ingress persistence stay in one immediate transaction. A lost HTTP response or wake failure cannot create a second occurrence.
8. Positive tests cover first acceptance, same replay, changed conflict, concurrent collision, failed-action retry, restart recovery, action effect receipts, terminal/reopen behavior, Project isolation, and indexed bounded reads.
9. Run the affected matrix, package/root typecheck, docs/routes/control/schema/architecture/package/release/module-topology checks, exact diff checks, and a fresh uninvolved read-only review until P0–P3 are zero. Then commit, fetch/merge upstream, inspect outgoing commits, run the normal push hook, push, and verify zero ahead/behind.

### Hard constraints and ownership

- Baseline before the adjacent capacity cut: `4abdaea58fd4e677cb481fdc7a684c7b5b7b790b`.
- The independently reviewed B5 capacity cut was isolated and committed as `5f29648659dced0900f0ddb2445f39bd52bc1b84`; B2 starts from that commit and does not rewrite its 29 paths.
- Existing working-only exclusions remain excluded:
  - `packages/opencorvus/src/session/index.ts`;
  - `packages/web/src/content/expert-squad-distribution.generated.ts`;
  - `packages/web/src/content/public-market-zh-01-35.ts`.
- No database migration, compatibility reader, fallback, dual read/write, current-state shadow table, generic queue, or second scheduler is permitted.
- No User Interface automation is in scope.

### Sources read and repository search

- `specs/records/2026-08/2026-08-30-scheduling-algorithm-razor-audit.md`.
- `specs/records/2026-09/2026-09-01-scheduling-razor-remediation-cut-8.md`.
- Agent Coordination payloads, readers, writers, response/action callers, redispatch binding, Task cancellation, Task description, Task-root ingress delivery, Artifact indexes and DDL.
- Public operator-steer model, HTTP route, Task API, Overlay caller, request-ID/error handling, and all current coordination-related tests.

### Independent read-only audit feedback

Two uninvolved agents were assigned independent read-only lanes and prohibited from editing or delegating.

- Coordination facts lane: P0=0, P1=3, P2=2, P3=0. Besides the mutable rewind and unbounded frontier, the reviewer proved two production gaps. A process can die after response/action commit and before or after the downstream effect; generic interrupted-Tool recovery then errors the Tool Part and no owner resumes the pending action. Coordination facts also omit Task execution epoch, so a redispatch action created in epoch N can remain admissible after reopen into epoch N+1.
- Operator identity lane: P0=0, P1=2, P2=2, P3=0. The public strict body contains only `message`; Task API does not pass the lower layer's existing optional `operatorSteerID`; the lower layer generates a new Artifact ID for every call. A lost 202 therefore creates a second immutable request, ingress and wake. The existing find-or-create uses a deferred transaction, re-resolves mutable target facts before replay, and changed same-ID input raises an untyped generic error instead of the documented stable 409.

## Current-source decomposition

### Observable behavior

- `agent_coordination_request` moves `pending -> responded -> pending` when an action fails, and also moves to `cancelled` in place.
- `agent_coordination_action` accumulates progress in `result`, then mutates to `completed` or `failed`.
- Response Artifacts and Protocol Events duplicate transitions already stored in those mutable payloads.
- `engine_artifact_pending_worker_handoff_lineage_idx` uses the mutable request status as both identity and retry admission.
- `listPendingAgentCoordinationRequests` loads every request for a Task, filters in JavaScript, then Session callers filter again.
- Public operator-steer does have lower-level same-ID comparison support, but no public caller identity reaches it; retries after a lost response are therefore new occurrences.
- Coordination request/action facts do not carry the accepting execution epoch. Current dispatch admission checks a redispatch action's mutable `pending` state and target but not source/current epoch equality.
- Generic interrupted assistant recovery marks a running `respond_agent_coordination` Tool Part as `process-execution-interrupted`; no startup frontier owns the already-persisted pending action, so it can remain permanently unresolved.

### Direct trigger and data/control flow

1. Worker `request_orchestrator_decision` or public operator-steer appends a request Artifact.
2. `respond_agent_coordination` rewrites that request to `responded` and appends a response plus pending action.
3. Host effects repeatedly rewrite the action result/status.
4. A failed Host effect rewrites the request back to `pending` and embeds `last_failed_*` pointers.
5. Description, direct Session control, Task cancellation, redispatch continuation and replay branch independently inspect those mutable fields.

### Root cause

The implementation stores business facts and their current projection in the same Artifact rows. Retry is a state rewind rather than a new occurrence chained to the exact failed attempt. Because there is no immutable frontier identity, a mutable partial index and per-action replay code have become concurrency ownership. Operator-steer then exposes the same problem at the HTTP boundary by omitting the caller occurrence ID.

### Why the old path does not cure it

- Artifact version history records overwritten bytes, but readers do not reduce it and it is not the concurrency boundary.
- Protocol Events are durable notifications, not a complete or uniquely constrained business-fact log.
- Downstream cancellation, Question, Task failure and dispatch idempotency can replay their own effects, but cannot decide which response attempt owns the coordination request.
- Adding more update triggers would constrain the mutable machine while preserving all duplicated authorities.

## Selected single-source design

### Immutable facts

1. `agent_coordination_request`: frozen caller semantics and exact worker/dispatch or operator occurrence. It has no status, response pointer, failure pointer, cancellation fields, or mutable label.
2. `agent_coordination_response`: one immutable scheduler Tool occurrence and decision. It contains the exact frontier it claims: the request itself for the first attempt, or the immediately preceding failed outcome for a retry.
3. `agent_coordination_action`: one immutable action plan paired one-to-one with the response. Scheduler-derived redispatch binding is frozen here; progress and terminal result do not mutate it.
4. `agent_coordination_action_outcome`: exactly one append-only `completed` or `failed` fact for one action. A completed receipt names the action kind and is accepted only when its action-specific durable authority exists: dispatch lineage, terminal Interaction publication, Task terminal event, or terminal ingress/lifecycle reference. `cancel_worker`, whose physical prompt controller is intentionally process-local, stores one strict same-Task/Session cancellation receipt after its idempotent effect settles.

The frontier unique constraint admits one response for `(task, request, predecessor_failed_outcome-or-first)`. It makes concurrent responders a database winner decision without a mutable admission row. A retry is legal only when its predecessor is the exact terminal failed outcome of the previous action. Completed chains never expose another frontier.

### One reducer

The reducer consumes the request and its exact response/action/outcome facts and returns:

- `pending`: no response owns the current frontier, including after the latest action failed;
- `responded`: an accepted action is pending or completed;
- `superseded`: an unresolved request/action belongs to an older Task execution epoch;
- the current response/action, terminal outcome, and prior failed attempts.

All public row helpers expose this reduced projection. Callers stop inspecting raw mutable payload status. Protocol events are emitted in the same fact transaction but are not read by the reducer.

Every request freezes its accepting Task execution epoch. The reducer projects an unresolved request/action from an older epoch as `superseded`; dispatch admission requires exact request, action, source-lineage and current Tool creator epoch equality. Reopen therefore never grants an old coordination occurrence new scheduling authority.

The original persisted `respond_agent_coordination` Tool occurrence is the recovery owner for a planned or in-progress action. Interrupted-Tool recovery re-enters that exact occurrence instead of manufacturing a new response. Action-specific downstream writers remain their own idempotency authorities; after they commit, replay appends the missing coordination outcome and returns the same Tool result. No generic coordination worker or second action scheduler is added.

### Bounded current reads

- Add current-schema expression indexes for request origin/lineage/session/epoch, response frontier, response Tool occurrence, action response, and outcome action/status.
- Pending Task and Session queries select bounded request pages whose current frontier has no accepted response. Retry eligibility is derived by indexed `NOT EXISTS`/terminal-failure predicates, not by loading all request history.
- Description reads only its display page and a bounded count contract.

### Operator-steer occurrence

- The strict HTTP body requires a stable `request_id` plus `message`; there is no server-generated fallback. The Overlay allocates and retains that ID before its first send, reuses it after a network failure, and replaces it only after success or a semantic message change.
- Task API passes that ID as `operatorSteerID` before any write.
- One immediate transaction compares the canonical target Session, projected worker binding and normalized message, then appends the immutable request and exact Task-root ingress together. A concurrent lower-layer loser is returned as replay and cannot run the new-request dispatch callback.
- Same occurrence/same semantics returns the original request and ingress; changed semantics raises `OperatorSteerRequestConflictError` with HTTP 409. The caller ID is a globally unique Artifact occurrence, so cross-Task reuse returns the same typed conflict before mutable target resolution.
- Wake is a post-commit delivery attempt over the already durable ingress and is not identity authority.

## Rejected alternatives

- Keep mutable request/action rows and add more transition triggers.
- Add a mutable `agent_coordination_current_state` or claim table beside the Artifact facts.
- Treat Protocol Events or Artifact version history as a second reducer input.
- Keep request status for compatibility while also appending outcomes.
- Build a generic event-sourcing/scheduler framework for this one domain.
- Migrate or backfill prior coordination rows. This repository uses the current schema epoch and typed reset boundary.

## Implementation and validation sequence

1. Add pure payload schemas and the reducer; convert read helpers and add reducer unit tests.
2. Change current DDL/indexes to immutable facts and exact lineage/frontier constraints; add raw SQLite positive error-contract and `EXPLAIN QUERY PLAN` evidence.
3. Convert request/response/action/outcome writers and all callers; remove every coordination Artifact update, the unused request-cancellation half-design, and duplicated progress facts.
4. Fence facts by execution epoch and make exact interrupted `respond_agent_coordination` Tool replay the recovery owner for every action-specific crash cut.
5. Wire operator-steer caller identity, immediate transaction and typed 409; add route/service/cross-process lost-response tests.
6. Run focused production/recovery tests, then the complete affected matrix and all repository gates.
7. Freeze an exact index tree and obtain fresh uninvolved read-only review. Any valid finding invalidates the tree and the review repeats after correction.

## Evidence ledger

- Baseline source audit: complete.
- Independent coordination facts report: complete, P0=0/P1=3/P2=2/P3=0 before implementation.
- Independent operator identity report: complete, P0=0/P1=2/P2=2/P3=0 before implementation.
- The first frozen implementation candidate (`b6983c896d9c852fd18852dec027bb57addb66b6`) received a fresh uninvolved review and is not a submission candidate: P0=0/P1=4/P2=3/P3=1. The findings were stale-epoch physical effects, mixed operator descriptor/lineage authority, DDL/runtime lineage gaps, borrowed `ask_user` Interaction authority, a non-production-equivalent pending-query plan test, incomplete real Overlay failure/retry evidence, and dead compatibility-shaped fields/helpers.
- Corrections after that review use no migration, compatibility reader, new lease, progress row, or parallel state machine:
  - request/response/action/outcome remain one append-only Artifact chain and one reducer; old-epoch pending actions project `superseded`.
  - cancel, ask, Git checkpoint admission and Task failure settlement all validate the exact active execution/action inside their physical-effect transaction. `TaskFailed` and the completed `fail_task` outcome commit atomically; a replay repairs only the worker Turn projection.
  - `ask_user` commits its exact deterministic `question.asked` outbox occurrence in the same immediate transaction as action admission. Recovery requires the exact Question/Interaction/Tool binding and cannot borrow another same-Task Interaction.
  - worker requests freeze the exact persisted Tool input; raw SQL must satisfy the current source-specific Evidence Locator union. Operator steer freezes the latest descriptor and its matching dispatch lineage inside the same immediate transaction, so an old descriptor cannot be paired with a newer lineage.
  - response/action DDL freezes exact Tool reason and request delivery-slice subject. A continuation lineage requires the same pending action, execution epoch and source dispatch, and refuses terminal, deleted or reopened Tasks.
  - pending Task/Session reads are indexed, bounded 64-row pages with production-equivalent `EXPLAIN QUERY PLAN` evidence. Removed fields/helpers include the unused worker Message ID, request-cancellation half-design, progress facts and list-only mutable projections.
- Operator identity follow-up remains production-shaped: two SQLite processes race the same caller-owned request ID and converge on equal receipts, exactly one new-request dispatch owner, one immutable request, one requested Protocol Event and one Task-root ingress. Sequential lost-response replay returns the same occurrence; changed input returns the stable typed conflict.
- Focused evidence after the latest corrections:
  - package typecheck: pass.
  - exact claim takeover and exact durable A2A `ask_user`: 2 pass, 0 fail, 25 assertions.
  - focused worker Tool input, stale redispatch and atomic `fail_task` crash/replay cases: 3 pass, 0 fail, 8 assertions across the final targeted reruns.
  - complete affected eight-file aggregate on one stable source snapshot: 73 pass, 0 fail, 215 assertions, 212.97 seconds. This includes immutable reduction, real two-process operator identity/recovery, Fact Check settlement, Task-control reconciliation, all production Tool-result control writers, terminal coordination schema, Tool decision coordination and three cross-process dispatch claim/recovery cuts.
  - an earlier 70/2 aggregate is explicitly invalid evidence: the parent process loaded `SCHEMA_DDL` while this file and `storage/ddl.ts` were still changing, then child processes correctly returned `SCHEMA_RESET_REQUIRED`. Re-running both exact child cases and the aggregate after the input froze passed; no product or fixture behavior was changed to hide the reset boundary.
  - isolated real Overlay page: the current Task, Orchestrator card, worker card and Expert Squad dock rendered without console errors and without visible layout regression. The failure-shaped fixture did not project an operator-steer trigger, so this is deliberately not claimed as complete steer-form failure/retry visual acceptance yet.
  - OpenCorvus package typecheck and root typecheck: pass; root reports 8/8 workspace tasks.
  - current schema contract: 11 pass, 0 fail, 76 assertions, including create/reset/read-only drift and production Task transfer.
  - docs/routes: 339 operations in 25 groups and 6 route rules across 34 files.
  - control-state/lease/architecture: 51 tables with 7 allowed fact classes; 18 declared owners across 22 acquire sites; 16 current architecture documents with live links.
  - package/release: 10 workspace packages with no dependency/generation cycle; public package order and `0.0.58-beta` version family aligned. The exact-index release gate reports 5 canonical authorities.
  - exact-index module topology: 1,102 modules, 5,520 runtime edges, zero strongly connected components and 4 clean imports.
  - the opt-in real Task-control checker was not run: it correctly requires `TASK_CONTROL_CHECK_ALLOW_REAL_PROVIDER=1` because it makes real model calls. No Provider credential or spend was authorized for this cut.
- Cached and working diff checks: pass; the only working paths are the pre-existing `session/index.ts` formatting delta and two excluded generated/public web-content files.
- Exact tree `488d7492ab3cf98f96a036b472d73ba903597676` received a fresh uninvolved review and does not enter submission: P0=0/P1=4/P2=2/P3=1. The complete findings were worker descriptor/lineage/evidence/participant parity, redispatch completion before descriptor-backed acceptance, same-epoch terminal/deleted active-action admission, forged inline outcomes for Bus-owned Questions, unbounded/N+1 recovery lookups, missing lost-response UI acceptance, and dead history/result fallbacks.
- The next correction keeps the same small fact model rather than adding migration or scheduling state:
  - worker handoff derives the exact lineage from the frozen descriptor dispatch ID; DDL requires descriptor/workflow/occurrence/slice parity, the exact worker-authored assistant ToolPart, and positional source-identity equality between model input and Host-completed Evidence Locators;
  - active responses/actions require an active, non-deleted current execution, while exact terminal acknowledgement remains the only terminal decision;
  - a redispatch outcome is appended inside the descriptor-backed dispatch commit transaction and DDL requires that exact descriptor before accepting completion;
  - Bus-owned `ask_user` settlement requires its exact terminal Question publication and rejects inline Interaction outcome spoofing;
  - recovery reads Interaction rows in 64-row pages and resolves at most 64 deterministic action IDs with three bounded batch queries; history scans, result-pointer fallbacks, and unused unbounded list APIs are removed.
- Real Overlay acceptance exposed one additional presentation-owner defect instead of merely closing the review item: after the backend durably accepted an operator steer, the task update remounted the right-dock worker projection and discarded the local controller before the simulated lost response surfaced. The worker Session ID is now the single UI state key across its main-conversation and right-dock projections. Draft text, error, in-flight identity and receipt therefore survive a durable refresh; no HTTP or persistence fallback was added.
- Correction-focused evidence on the stable source snapshot:
  - package typecheck: pass;
  - exact raw/race correction rerun: 2 pass, 0 fail, 11 assertions;
  - complete focused two-file run: 38 pass, 0 fail, 129 assertions, 140.09 seconds;
  - complete affected eight-file aggregate: 74 pass, 0 fail, 224 assertions, 227.59 seconds. The first combined run was 36 pass/2 fixture failures, both corrected (stale Message `orderKey` reuse and the public deleted-Task preflight's earlier typed `NotFoundError`), and is not cited as release evidence;
  - Overlay typecheck passes and the production Vite build completes with 7,119 modules; only the repository's existing Rollup `use client`/chunk warnings remain;
  - fresh current-schema production dispatch produced one descriptor-backed completed `base-researcher` worker. In the real `/ui/` right dock, a bounded fault proxy forwarded the first steer and observed upstream 202 before returning a simulated transport 502. The page visibly retained `B2 visible retry preserves one durable request`, displayed the failure, and kept the form open. Clicking Steer again displayed accepted receipt `art_fc82e07d01ae43888baa`. Both proxy attempts carried that exact ID and upstream returned 202 twice; read-only SQLite evidence contains exactly one `agent_coordination_request`, one `agent.coordination.requested` event and one Task-root ingress for that ID (plus the generic single `artifact.persisted` notification).
- Final pre-review gates pass: OpenCorvus package typecheck and root typecheck (8/8 workspaces); current schema 11/11 with 76 assertions; docs 339 operations/25 groups; routes 6 rules/34 files; control state 51 tables/7 fact classes; control leases 18 owners/22 acquire sites; architecture 16 current documents; package topology 10 cycle-free workspaces; Expert Squad topology 121 manifests/133 workflows; public package release order; both cached/working diff checks. Exact pre-ledger tree `c31622cc8a3cdbd4a935654e92bba2d29447cf0c` passes the five-authority release gate and module topology at 1,102 modules/5,522 runtime edges/zero retained strongly connected components/four clean imports.
- Exact tree `5c161e2bc42ff1c4b3d78e818eb4651177e482d3` received a fresh uninvolved review. The review found no defect in the immutable reducer, bounded frontier, cross-process caller identity, Task/Session lineage or action-specific durable receipts, but identified four correction requirements before submission: an old-epoch running coordination Tool could throw before generic terminalization; SQLite accepted fractional/unsafe timestamps and empty required fact text that Zod rejected; the public OpenAPI/SDK omitted the caller-stable `request_id` replay contract; and the Overlay target-state registry had no bounded lifecycle.
- Those four findings are closed in the current correction input without adding another state machine or compatibility path:
  - interrupted recovery replays the exact persisted response/action, classifies the typed superseded action and terminalizes the running ToolPart without executing or appending an outcome; the new positive reopen cut proves the successor Task epoch remains active and physical effect counts do not change;
  - every request writer parses the complete final fact inside its immediate transaction, while the four DDL triggers independently require positive safe-integer timestamps and non-empty schema text; raw SQLite cases cover fractional, overflow, empty and valid-boundary inputs;
  - the route and input schema now state that callers generate `request_id` before the first attempt, reuse it only for the same Task, Session and canonical message after a lost response, receive the original receipt on exact replay and HTTP 409 on semantic drift, and never receive a server-generated replacement; the canonical SDK/OpenAPI and bilingual API documentation generators project that contract;
  - the Overlay registry tracks mounted consumers, keeps one state across the main conversation and right dock, never evicts an in-flight request and applies an explicit 64-target least-recently-used bound to inactive state.
- Exact tree `5c161e2bc42ff1c4b3d78e818eb4651177e482d3` received a second uninvolved read-only review and is not a submission candidate: P0=0/P1=3/P2=1/P3=1. The findings were descriptor-backed redispatch acceptance without atomic coordination settlement on owner loss, an `ask_user` terminal publication without its exact deterministic Bus occurrence, incomplete operator-derived DDL locks, missing saved visual-review evidence, and dead replay helpers. All production findings are corrected in the current input: the three descriptor replay paths and the owner path share one descriptor/action commit helper; durable redispatch outcome contains only the receipt while the reduced action projection derives its binding from the immutable plan; `ask_user` requires `bus-occurrence:question-terminal:${question_id}`; the operator fields and all action-specific receipt shapes are locked by both Zod and current DDL; the dead helpers are deleted.
- Post-correction evidence on one stable source snapshot: complete affected matrix 76/76 tests, 258 assertions, zero failures, 225.59 seconds; OpenCorvus package and JavaScript SDK typechecks pass; routes pass 6 rules across 34 files; generated API documentation passes 339 operations across 25 groups. A final isolated rerun of the complete Tool-result protocol after the durable plan/receipt assertion passes 33/33 tests with 94 assertions in 122.91 seconds.
- Real-page evidence uses the Browser surface only, never a UI automation test. The preserved lost-response/retry page is saved at `specs/artifacts/2026-09/b2-operator-steer-retry-accepted.jpg` (1280x720): manual review confirms the worker card, right-dock `base-researcher`, accepted receipt `art_fc82e07d01ae43888baa`, readable controls, and no visible overlap. In the same real page, a subsequent disconnected submit visibly retained `B2 remount retry keeps this exact draft` beside the `Failed to fetch` alert; the Browser DOM snapshot records both strings after the failed request. The earlier bounded fault-proxy trace remains the durable identity proof: first upstream 202 was replaced by a client-visible 502, retry reused the same request ID and returned the original receipt, and SQLite contained one request/event/ingress occurrence.
- A separate fresh current-schema production dispatch was created after the final DDL corrections, without opening or rewriting the prior evidence database. Its current built `/ui/` page is saved at `specs/artifacts/2026-09/b2-current-schema-worker-page.jpg` (1280x720). Manual review confirms one Orchestrator card, one completed `base-researcher` card, the exact completion text, online connection state, normal input/dock layout and no visible regression. The isolated server and fault proxy were then stopped by their own recorded process sessions; no user process was touched.
- Final working-source gates before the exact freeze: root typecheck passes all 8 workspace tasks; current schema passes 11/11 tests with 76 assertions; docs and routes pass at 339 operations/25 groups and 6 rules/34 files; control state and lease ownership pass at 51 tables/7 fact classes and 18 owners/22 acquire sites; architecture indexes 16 live current documents; package topology covers 10 cycle-free workspaces; Expert Squad topology covers 121 manifests/133 workflows; public package release order passes; working-source module topology reports 1,099 modules, 5,497 runtime edges, zero retained strongly connected components and four clean imports. The exact-index release and module gates are deliberately rerun only after the corrected index is frozen.
- Exact pre-ledger tree `7c0083ef020c33b5f1b73ac9b7d86a9fb59d33d9` passes the five-authority release gate and exact-index module topology at 1,102 modules, 5,525 runtime edges, zero retained strongly connected components and four clean imports. Cached and working diff checks pass, and the only working paths remain the three declared exclusions. This sentence changes the tree by recording its evidence; the final evidence-bearing tree is therefore frozen and checked once more before review, without another ledger edit.
- Final current-schema browser acceptance used Task `tsk_g00VU3nPA700vSBPHX00`, worker Session `ses_h1Wu86G95oNpV5urGgWt` and caller-stable request `art_0d7bc9ad66d347a98200`. The first browser submit committed upstream with HTTP 202 while the page surfaced `signal timed out`; the right-dock form retained the exact draft. After switching to another Task, returning, and reopening the same worker rail, the form rendered `Steer accepted for Orchestrator handling. Request art_0d7bc9ad66d347a98200`, cleared the draft/error, and remained bound to that original request. The worker continuation visibly answered `The current-schema remount preserves one durable request.` Manual screenshot review confirmed the accepted receipt, worker card, readable controls and normal dock layout. The bounded proxy recorded two accepted replays carrying the same request ID, and read-only SQLite inspection found exactly one `agent_coordination_request` plus one epoch-1 Task-root ingress (`art_h2f2H1uxb77Xs0C7KDRG`) for that source ID. This closes the remount/lost-response presentation boundary without a second durable occurrence or a UI fallback.
- Exact tree `ef6fb281c3fd98895b5a9c5191d366b77668e5aa` received another fresh uninvolved read-only review and is not a submission candidate: P0=0/P1=1/P2=1/P3=1. The P1 proved that an already-completed `ask_user` outcome followed by owner loss before ToolPart completion replayed only a generic message and discarded the durable operator answer/expiry/rejection from the next model Turn. The P2 proved that the 64-request page still loaded every retained response/action/outcome for those requests, so one deep retry chain remained unbounded. The P3 corrected the earlier claim that required receipt fields alone made arbitrary passthrough metadata a validated receipt.
- The correction remains current-schema-only and removes authority rather than adding state:
  - completed `ask_user` replay validates the exact action receipt, Question ID, Interaction ID/status, persisted Tool binding and terminal Interaction, then renders the operator answer, expiry or rejection from that authoritative Interaction; the outcome stores no duplicate answer or presentation metadata;
  - pending pages load at most one unconsumed failed frontier outcome per selected request plus its exact action and response in three bounded batch reads. A dedicated current-schema expression index serves `(task, request, status)`, and a 96-attempt chain proves the current page reads only the final unconsumed frontier while preserving the exact last-failure projection;
  - every completed action receipt is strict in both Zod and SQLite. Only the action-specific durable authority core is projected; `redispatch_binding` remains solely the immutable Action plan and `ask_user` presentation is reconstructed from the exact Interaction.
- Final correction evidence on one stable working source: the complete affected eight-file aggregate passes 77/77 with 270 assertions and zero failures in 235.74 seconds. Within it, the 96-attempt frontier/current-schema recovery file passes 6/6 with 66 assertions; completed `ask_user` outcome-to-ToolPart recovery, atomic `fail_task` replay and descriptor-backed redispatch all pass; intrinsic fact and SQLite receipt checks reject undeclared presentation metadata before the real settlement proceeds. OpenCorvus package typecheck passes, and root typecheck passes all 8 workspace tasks. Current schema passes 11/11 with 76 assertions; docs/routes pass at 339 operations/25 groups and 6 rules/34 files; control state and leases pass at 51 tables/7 fact classes and 18 owners/22 acquire sites; architecture indexes 16 current documents; package topology covers 10 cycle-free workspaces; Expert Squad topology covers 121 manifests/133 workflows; public package release order passes. Exact-index release/module/diff evidence is deliberately deferred until the corrected index is frozen.
- Exact tree `4cabd511fc9eb4b640b09eda04e4a16cec9900cb` received a fresh uninvolved read-only review and is not a submission candidate: P0=0/P1=1/P2=2/P3=0. The P1 found that current DDL did not independently reject duplicate keys in completed receipt `result` objects or undeclared nested `acknowledge_terminal.result.terminal_lifecycle_reference` keys. One P2 found that the 64-request page still selected the latest failed outcome through an anti-join over retained request history instead of a per-request indexed seek. The other P2 found that owner-loss recovery covered only the answered `ask_user` terminal, not the equally authoritative expired and rejected terminals.
- The correction closes those findings without adding migration, lease or recovery authority:
  - completed receipt DDL requires duplicate-key-free `result` objects and the acknowledgement reference is exactly one non-empty `terminalEventID`; the other action-specific result objects retain their exact key sets;
  - the selected 64-request page now drives one correlated `engine_agent_coordination_outcome_request_idx` seek per request, ordered by `time_created DESC, id DESC LIMIT 1`; a 96-attempt chain and production-shaped query-plan assertion prove the current due set and the bounded indexed plan without scanning every historical failure;
  - owner-loss recovery now covers answered, expired and rejected terminal Interactions with the same exact Question/Interaction/Tool lineage, the same operator-decision semantics, idempotent second recovery and one effect admission. The recovered ToolPart deliberately identifies that it was reconstructed from the durable completed action, so its presentation bytes need not equal the original ephemeral return. The expired path exposed and removed a timestamp split: `question.expired` and its thrown `ExpiredError` now share the durable deadline expiry instant, so one occurrence cannot settle with two different terminal times.
- Latest correction evidence on one stable working source: the reviewer-focused set passes 6/6 with 95 assertions and zero failures in 26.49 seconds. The complete affected eight-file aggregate passes 79/79 with 299 assertions and zero failures in 247.31 seconds. Root typecheck passes all 8 workspace tasks, including OpenCorvus package typecheck. Current schema passes 11/11 with 76 assertions; docs/routes pass at 339 operations/25 groups and 6 rules/34 files; control state and lease ownership pass at 51 tables/7 fact classes and 18 owners/22 acquire sites; architecture indexes 16 current documents; package topology covers 10 cycle-free workspaces; Expert Squad topology covers 121 manifests/133 workflows; public package release order passes. Exact-index release/module/diff evidence follows the new frozen tree and is not inherited from `4cabd511fc9eb4b640b09eda04e4a16cec9900cb`.
- Exact tree `f12d2311622e4e90f6fa46c34c480a9a949ca036` received a fresh uninvolved read-only review and is not a submission candidate: P0=0/P1=0/P2=1/P3=1. The P2 proved that selecting the latest failed outcome by `time_created DESC, id DESC` was not yet equivalent to the reducer's exact `frontier_id` chain because DDL and cross-process writers did not guarantee causal time ordering. The P3 corrected the owner-loss statement from byte equality to exact operator-decision semantics and idempotent recovery. All earlier B2 findings and boundaries were rechecked without a new regression.
- The final correction makes the bounded index seek a constrained projection of the same immutable chain rather than a second ordering authority. A response fact is persisted strictly after its request and, on retry, strictly after its exact predecessor failed outcome. Its action fact shares the response time; its outcome cannot precede the action. Writers derive those times inside the same immediate transaction with `max(caller time, predecessor time + 1)` for a response and `max(caller time, action time)` for an outcome, so clock rollback cannot reorder a valid chain. Current DDL independently enforces every relation. A 96-attempt chain now adds an equal-time raw retry that fails the current-schema invariant and a production retry invoked with `now=1` that advances causally, fails once, and becomes the exact indexed pending frontier.
- Final working-source evidence after the causal correction: OpenCorvus package typecheck passes. The focused current-frontier/recovery file passes 6/6 with 70 assertions and zero failures in 25.83 seconds. The complete affected eight-file aggregate passes 79/79 with 303 assertions and zero failures in 242.49 seconds. Root typecheck passes all 8 workspace tasks. Current schema passes 11/11 with 76 assertions; docs/routes pass at 339 operations/25 groups and 6 rules/34 files; control state and lease ownership pass at 51 tables/7 fact classes and 18 owners/22 acquire sites; architecture indexes 16 current documents; package topology covers 10 cycle-free workspaces; Expert Squad topology covers 121 manifests/133 workflows; public package release order passes. A new exact index tree, release/module gates and fresh uninvolved review are required; no evidence is inherited from `f12d2311622e4e90f6fa46c34c480a9a949ca036`.
