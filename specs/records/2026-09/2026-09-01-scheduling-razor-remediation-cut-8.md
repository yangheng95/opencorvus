# Scheduling Razor Remediation — Cut 8

## Recall

### User request

- Use multiple independent agents to decompose the current project scheduling algorithms, with special attention to over-engineering, contradictory system design, and violations of Occam's razor.
- Iterate until another review round finds no new issue, then repair every confirmed issue.
- Do not preserve a large historical database compatibility migration merely for compatibility. The accepted database-epoch policy is fail-closed reset, already delivered by Cut 6; this cut must not recreate a compatibility reader, backfill, fallback, or shadow authority.

### Acceptance criteria

1. Re-check the remaining B2, B5, B8, B9, C1, and C2 audit items against the current committed source rather than the original line numbers.
2. Keep one fact source per semantic boundary. Immutable request/occurrence facts are never rewritten as reducer projections.
3. Remove duplicate durable authorities when an existing immutable fact plus a current-schema invariant can express the same constraint.
4. Replace unbounded hot-path history reduction with indexed, bounded current-frontier reads; do not add a compatibility projection or process-local shadow state.
5. Physical execution capacity is bounded and work-conserving at the real activation boundary. Domain FIFO, retry, settlement, and recovery remain owned by their existing reducers; capacity admission must not become a second job framework.
6. Add production-shaped positive tests for exact replay, cross-process collision/recovery, bounded pages/query counts, FIFO, work conservation, and Project isolation as applicable.
7. Run focused and aggregate tests, package/root typecheck, docs/routes/control/schema/architecture/package/release/module-topology checkers, and both cached and working diff checks.
8. Freeze an exact tree and obtain a fresh, uninvolved, read-only review. A
   valid finding preserves that tree as review evidence but supersedes it as
   the commit candidate; repeat corrections and review until P0–P3 are all
   zero.
9. Commit only owned paths, fetch and merge upstream, inspect the full outgoing set, run hooks, push, and verify zero ahead/behind.

### Hard constraints and ownership

- Baseline for this Recall: `aa6b4a20aa4bbf956432ab457784dfdecc9368a8`.
- Another task is the single implementation owner for A22–A24. Until that task commits and pushes, this cut must not edit or stage its Project/Worktree/Task API/test/spec paths.
- The existing working-only `session/index.ts` formatting delta and the two Web content paths remain excluded.
- `task-api/index.ts` is currently an A22–A24 overlap. The newly found operator-steer request-identity correction is recorded here but may not be implemented until that ownership clears.
- No UI automation is in scope.
- All database changes target the current schema epoch only. An old epoch receives the existing typed schema-reset error and is not migrated.

### Sources read and searches completed

- `specs/records/2026-08/2026-08-30-scheduling-algorithm-razor-audit.md`
- `specs/records/2026-08/2026-08-30-scheduling-architecture-remediation.md` (read-only while the A22–A24 owner has a working hunk)
- `specs/current/architecture/{02-data,task-control-plane,17-code-work-agent-platform}.md`
- Agent Coordination definitions, writers, reducers, Orchestrator action callers, Tool entry, HTTP operator-steer route, Protocol events, indexes, and recovery callers.
- Dispatch lineage, workflow-node occurrence, Worker Turn descriptor commit, schema/DDL registry, deletion closure, and all occurrence tests.
- Scheduler Message recipient/project drains, Task control startup/heartbeat, Automation poll/manual/fan-out, Event definition/fire/recovery/projection, Provider attempt path, and control leases.
- Dispatch settlement/delivery recovery and its process-local `closedDispatchIDs` memo.
- Repository history for the touched scheduling modules and all current references to the nonexistent `TaskQueueService` and the mounted experimental Event API.

### Independent read-only audit feedback

Three uninvolved agents were assigned distinct lanes and prohibited from editing or delegating:

- B2 reviewer: B2 remains open. The request Artifact and action Artifact store mutable status while response Artifacts and Protocol Events duplicate the same transitions. Failure rewrites a responded request back to pending. The mutable-status partial unique index is therefore both an identity and retry authority. The reviewer also found a new adjacent issue: public operator-steer retries have no caller request identity and can create a second request/ingress after a lost HTTP response.
- B5 reviewer: B5 remains partially open. Scheduler Message pages are bounded but fixed-batch barriers are not work-conserving; production Task startup/heartbeat is configured as unbounded; Event is bounded only per job; Automation manual/fan-out paths bypass its poll bound; no Provider-key physical capacity authority exists.
- B8/B9/C reviewer: B8 remains open and is a P2 late-admission correctness gap, not only redundant storage. B9 remains partially open across Task, Event, and Automation due discovery. C1 remains open. C2's original source document has already been removed and current architecture now correctly separates Automation and Event; C2 is closed and only the old audit ledger needs correction.

## Current-source decomposition

### B2 — immutable Agent Coordination facts

Observable behavior and trigger:

- one coordination request can move `pending -> responded -> pending` as a Host action fails;
- the same transition is simultaneously represented by request payload/label, response, action payload/label, and Protocol Event;
- restart recovery depends on replaying the original Tool Part rather than one indexed pending-action frontier;
- public operator-steer retry after a lost response has no stable caller occurrence identity.

Root cause:

- business facts and their current projection are stored in the same mutable Artifact rows;
- retry is modelled by rewinding the request instead of appending another response/action attempt;
- uniqueness predicates depend on the mutable projection;
- downstream actions each provide their own partial replay behavior, so there is no single reduced current attempt.

Selected direction:

- immutable request;
- immutable ordered response/action plan attempts;
- append-only action outcome referencing the exact downstream fact;
- immutable cancellation settlement;
- one reducer for pending/responded/cancelled and latest action state;
- current pending reads use an indexed bounded frontier;
- Protocol events are deterministic notification/outbox projections only and are never reducer input;
- worker identity is the exact Tool occurrence plus dispatch lineage; operator identity is a caller-supplied request ID with same-request replay and changed-request typed conflict.

Rejected alternatives:

- preserving mutable request/action rows with extra triggers;
- adding another mutable current-state table while retaining the old rows as a compatibility reader;
- treating per-action downstream idempotency as a complete coordination recovery owner.

### B5 — physical capacity without a second scheduler

Observable behavior and trigger:

- a four-item `Promise.allSettled` batch leaves three slots idle behind one stalled recipient;
- Mission recipients must drain before Task recipients;
- production Task control defaults to `MAX_SAFE_INTEGER` active/pending scans;
- Event runs every distinct job immediately;
- Automation manual and target fan-out can exceed the scheduled-definition poll width;
- independent Sessions/backends can concurrently reach the same Provider credential without an aggregate physical bound.

Root cause:

- domain occurrence ownership correctly prevents duplicate work but is mistaken for physical capacity control;
- local fixed batches cap one loop iteration but do not provide work conservation or cross-Project fairness;
- no narrow admission exists at the real Provider attempt boundary.

Selected direction and razor boundary:

- retain existing domain queues, leases, FIFO, retry, and settlement facts;
- use a small work-conserving local pump only where discovery loops currently batch or fan out;
- enforce the final aggregate limit at the actual Provider attempt with deterministic capacity-slot leases keyed by a non-secret Provider/credential generation and resource class;
- retry backoff releases the physical slot; the next actual stream attempt reacquires it;
- capacity admission records no business status and scans no domain table.

Implementation keeps the independent B8/B9 and B2 owners unblocked. It adds
no generic job framework and does not change any domain occurrence identity:

- one global-only `execution_capacity` surface owns the Scheduler Message,
  Automation, Event, and Provider physical limits; Project config receives the
  canonical typed config error for this global policy;
- Scheduler Message uses fixed SQL pages but interleaves active wake recovery,
  Mission recipients, and Task recipients through one work-conserving pump;
  Project discovery uses the same bounded worker primitive;
- the production Task-control owner was rechecked after the independent B9
  delivery and already injects four active scans plus a bounded pending page
  budget; B5 does not reopen or duplicate that finished capacity boundary;
- scheduled Automation, manual API, manual Tool, delay, and multi-target fan-out
  share one process-wide FIFO permit pool. Admission happens before the durable
  business claim, and the initially reserved permit transfers to the first
  target so a capacity-one multi-target fire cannot deadlock itself;
- distinct Event jobs preserve their existing per-job FIFO tails while sharing
  one process-wide physical permit pool across Projects;
- the final Provider SDK fetch obtains one SQLite-backed slot keyed by a
  non-secret Provider/credential-generation/resource-class digest. Response
  EOF, read error, consumer cancellation, caller/activity abort, transport
  failure, and no-body responses converge on exact release; expiry is the only
  crash takeover authority.

Pre-freeze positive evidence on the shared working tree:

- final B5 matrix: 85/85 tests, 363 assertions, 0 failures across Scheduler
  Message, Automation, Wait, Event, Provider, config, durable capacity, and
  current-schema contracts, including stream settlement and bounded pause;
- two real Bun backend processes over one SQLite data root and one real local
  streaming HTTP transport prove that the second Provider request cannot enter
  fetch while the first body owns capacity, then proceeds after EOF;
- capacity reduction waits for active old slots to fall below the new bound;
  a saturated waiter settles with the caller's exact abort reason;
- OpenCorvus package typecheck passes on the shared tree. The uninvolved B5
  reviewer rechecked the direct Task, Provider physical-settlement, and
  post-permit cancellation corrections and returned P0-P3=0. B5 does not
  invalidate or block the independently owned B2 work and still requires exact
  staging plus repository checkers before commit.

### B8 — delete duplicate workflow-node occurrence authority

Observable behavior and trigger:

- every virtual-workflow initial dispatch writes immutable `dispatch_lineage` and also writes `engine_workflow_node_occurrence` with the same workflow/node, initial dispatch, and child Session;
- continuation validation reads the second table even though the initial lineage already carries the required occurrence and Session.

Root cause:

- an admission constraint was materialized as a second durable domain table rather than as a current-schema unique index plus a lineage query;
- `commitDispatchLineageSession` calls the projection again after descriptor commit, so the table is both admission and readiness projection.

Selected direction:

- make initial virtual-workflow lineage unique by `(task, workflow_id, workflow_node_id)` directly in `engine_artifact`;
- perform that immutable lineage admission before Session/Provider effects; a late descriptor-time check is not an admission boundary;
- validate continuation against the one exact initial lineage and its child Session;
- keep descriptor-backed readiness as the existing exact descriptor assertion, not another occurrence row;
- remove `engine_workflow_node_occurrence`, its schema registration, its DDL, and tests that inspect the duplicate storage shape;
- retain the public typed workflow occurrence conflict, populated from lineage facts;
- add current-epoch DDL shape constraints for virtual initial/continuation lineage so application parsing is not the only integrity boundary.

### B9 — bounded current-frontier reads

Current result is mixed:

- Automation's per-page projection and Session-specific delay frontier from Cut 5 are indexed and bounded and must not regress. Global due discovery still walks every current definition before filtering due work, so the B9 Automation subcase is only partially closed.
- Event still loads all definition revisions, performs per-definition tombstone queries, scans all fires during recovery/head selection, and reduces full receipt history in projection.
- Task/dispatch recovery loads all Tasks, epoch ingresses, settlements, and lineages and uses process-local `settledIngressIDs`/`closedDispatchIDs` memos to avoid repeat work until restart.

Selected direction:

- add Event SQL cursor/frontier queries for current Project definitions and unresolved fire heads, with bounded pages and fixed set-query stages;
- keep same-job FIFO and exact fire receipts unchanged;
- query only descriptor-backed dispatches whose terminal settlement/delivery frontier is unresolved;
- persist an exact no-wake suppression receipt when the Task epoch infrastructure budget absorbs a settlement, so restart does not need a shadow memo;
- remove both process-local shadow sets after the durable unresolved queries are authoritative;
- for Automation, make immutable scheduled Fire the pre-created next-due occurrence and poll bounded unresolved due-Fire pages instead of reducing every active definition; do not add an `automation_current_state` table.

Rejected alternatives:

- larger process-local caches;
- a new mutable projection table that must be reconciled with immutable inputs;
- replaying complete Automation/Event/dispatch history on every heartbeat and hiding the cost behind memoization.

Second current-source B9 audit after the B8 delivery (`79ff01b64296c1acd0561b05ed923cb8b96ec831`) confirmed P0=0/P1=0/P2=3/P3=1:

- Event discovery still reads every definition revision, performs per-definition tombstone queries, reduces complete Fire/receipt/lease history, and repeats global Fire scans in accept, recovery, claim, next-fire, and lease-recovery paths;
- dispatch recovery still reads every Task lineage and settlement, and `closedDispatchIDs` is the only exact per-dispatch authority for budget-suppressed delivery; restart loses it, while delivered/already-delivered branches are not even consistently memoized;
- Automation's one-second poll uses bounded pages but deliberately walks every active definition before JavaScript due filtering; the existing scheduled Fire due index is unusable because scheduled Fire is not created until claim;
- `settledIngressIDs` makes Task ingress cost linear in settled epoch history after every restart; terminal eligibility and each scan load all ingresses before reducer evidence reads.

The accepted razor split is three independent closures rather than one cross-domain framework:

1. Cut 8b.1 — dispatch and Task ingress: add only the missing immutable per-dispatch budget-suppression relation, exact dispatch/settlement/descriptor indexes, conservative bounded ingress/dispatch candidate pages, and delete both process-local shadow sets;
2. Cut 8b.2 — Event: Project-scoped current-definition pages and one bounded unresolved FIFO-head query shared by accept, recovery, claim, next-fire, and lease recovery; retain immutable Fire/receipt/lease facts and no head table;
3. Cut 8b.3 — Automation: pre-create the next immutable scheduled Fire at acceptance/settlement, discover due unresolved Fires through the existing due index, and retain the Session-specific one-shot delay frontier and atomic consume path unchanged.

Each closure must prove fixed query stages per page, multi-page correctness, restart behavior, exact terminal suppression, and `EXPLAIN QUERY PLAN` index use. A closure is reviewed and delivered before the next one starts; no mutable current-state table, compatibility reader, generic queue, or shared scheduler framework is permitted.

### C1/C2 — current documentation must describe running source

- C1 is closed by removing every current-architecture claim that
  `TaskQueueService` exists. The running owners are Task-root ingress
  admission/reduction/delivery and `SessionWake`; the daemon design reuses
  those owners and does not invent a queue service.
- C2 is closed in current source: the obsolete
  `18-scheduled-automations.md` no longer exists, while
  `task-control-plane.md` and `02-data.md` distinguish Automation and Event.
  Event remains a distinct event-identity domain; the experimental HTTP route
  and schedule Tool are adapters to the same `EventService`, not parallel
  implementations.

Current closure evidence is bound to committed source rather than the old
audit line numbers. `79ff01b64296c1acd0561b05ed923cb8b96ec831` removes the
duplicate workflow-node occurrence authority, while
`4abdaea58fd4e677cb481fdc7a684c7b5b7b790b`,
`5f29648659dced0900f0ddb2445f39bd52bc1b84`, and
`551733a6831deda453430c189de19f10a2a87463` deliver the bounded recovery,
capacity, and immutable coordination cuts. `4abdaea58` closes only the B9
dispatch/Task-ingress subcase; B9 Event and Automation due discovery remain
open for their separate selected designs. A current-source search reports
zero Task-queue class, module-path, or current-owner references under current
architecture. The remaining production strings `task_queue.prompt` and
`task_queue.compaction` are immutable origin identifiers mapped to
`mission.wake`, not a service or scheduling authority. `docs:check` passes 339
operations/25 groups and the architecture index passes all 16 current
documents with every link live.

## Implementation sequence

1. Cut 8a: B8 duplicate workflow occurrence authority deletion and positive initial/continuation/cross-process collision tests.
2. Cut 8b: B9 Event and dispatch bounded unresolved-frontier reads; remove the shadow memo; add query-count, multipage, restart, and suppression evidence.
3. Cut 8c: B2 immutable coordination attempts/outcomes and operator-steer request identity after the A22–A24 Task API owner clears the overlap.
4. Cut 8d: B5 work-conserving domain pumps plus Provider physical capacity admission, using the narrow boundary above.
5. C1/C2 documentation and ledger closure follow the implementation facts they describe.
6. Saturation review repeats after each sub-cut; any new independent issue is added here before the next implementation.

## Verification ledger

Historical pre-freeze checkpoint, now superseded: while A22–A24 owned the shared index, the B8 working tree was deliberately not staged and no B8 index tree was release evidence.

### Cut 8a — B8 first implementation pass

Implemented current-epoch changes:

- the initial virtual-workflow dispatch lineage is now the single pre-effect admission fact, uniquely keyed by Task, workflow ID, and workflow node ID;
- continuation admission resolves and validates the exact initial lineage and child Session;
- descriptor-backed acceptance remains a separate readiness assertion and no longer writes a second occurrence projection;
- the duplicate `engine_workflow_node_occurrence` table, module, schema registration, DDL triggers, delete ordering, and storage-shape assertions were removed;
- current DDL validates exact Tool occurrence, delivery-owner, initial/continuation workflow shape, and continuation ownership;
- a real two-process test blocks the winner after production lineage admission and before physical Session creation while a distinct Tool occurrence for the same workflow node receives the typed conflict.

First-pass evidence, before independent correction review:

- package typecheck: pass, exit 0;
- focused production/DDL/EXPLAIN runs: pass;
- full affected matrix: 92/92 tests, 228 assertions, 8 files, 236.56 seconds;
- the affected matrix includes the existing outer same-occurrence live-peer, expired-owner takeover, and abort paths plus the new different-occurrence cross-process pre-effect collision;
- cached and working diff checks: pass at the checkpoint, but the shared index tree belongs to A22–A24 and is not a B8 candidate.

First uninvolved correction review: NOT PASS, P0=0/P1=1/P2=1/P3=2. The review found that the first DDL workflow union accepted incomplete bindings and unrelated continuation sources, the new collision fixture invoked raw `claimDispatchLineage` instead of the public dispatch outer, the deletion test no longer carried a canonical lineage, and both new spec files were ignored rather than tracked. No candidate tree was frozen.

Corrections applied after that review:

- the shared payload parser and origin constructor now enforce initial occurrence ownership, exact selected virtual node/agent, direct-node absence, and coordination-source presence;
- application admission resolves the exact continuation lineage for both direct and virtual dispatches and compares its Session, target, workflow binding, node, and occurrence; coordination redispatch additionally proves that the exact action request owns that source lineage;
- current DDL validates the complete strict package revision and direct/virtual workflow binding shapes, selected node/target, payload Task identity, and exactly one of three production source shapes: initial, ordinary continuation, or coordination continuation whose action and request bind the same source lineage;
- malformed direct/virtual bindings, occurrence drift, wrong target, missing/wrong-session continuation, and unrelated coordination source now have positive SQLite error-contract coverage;
- the two-process collision now executes two distinct persisted `dispatch_agent` outer Tool occurrences. While the winner is blocked after production lineage claim and before adapter Session creation, the peer returns the public infrastructure outcome with `workflow_node_occurrence_conflict`; release produces one accepted Session/descriptor and consumes the active admission lease;
- Project deletion now creates a real Tool occurrence and canonical virtual-workflow lineage before terminalizing the Task, then proves that exact lineage is removed with its Task/Session tree while immutable permission evidence remains.

Correction-focused evidence so far:

- package typecheck: pass;
- DDL/schema/continuation matrix: 21/21 tests, 100 assertions;
- real public outer cross-process collision: 1/1 test, 2 compound assertions;
- canonical lineage Project deletion closure: 1/1 test, 2 assertions.
- corrected full affected matrix: 92/92 tests, 234 assertions, 8 files, 640.53 seconds;
- two earlier aggregate attempts were not accepted as evidence: one hit a transient Windows supervisor settlement-marker `ENOENT` whose exact isolated rerun passed, and one exposed Bun's inherited five-second timeout under aggregate load; the affected production cross-process file was given an explicit 30-second test timeout and then passed 7/7 before the complete 92/92 rerun.

Second uninvolved correction review: NOT PASS, P0=0/P1=0/P2=1/P3=0. The reviewer proved that the public two-process test's pre-release Session query only named the winner's deterministic child ID, so a peer Session leak without a descriptor could escape the assertion. The production implementation findings from the first review were otherwise closed.

The accepted P2 correction now compares the complete persisted Session set at both sides of the barrier: before release the database contains exactly the root Session and no physical worker child; after release it contains exactly the root plus the winner's `explore` Session, and the root's complete child set is exactly that winner. The peer therefore cannot create an unobserved Session before returning its typed occurrence conflict.

Post-P2 evidence:

- public two-process outer test: 1/1 test, 2 compound assertions, 54.03 seconds;
- full affected matrix: 92/92 tests, 234 assertions, 8 files, 424.69 seconds.

Third uninvolved read-only review: FINAL PASS, P0=0/P1=0/P2=0/P3=0. The reviewer independently reran the public two-process outer test (1/1) and confirmed the complete Session/child collections, lineage, descriptor, admission-lease, and outer-terminal assertions close the peer physical-effect gap. The same review found the parser/application/DDL source union aligned, dispatch lineage to be the sole pre-effect node authority, descriptor/settlement to remain readiness/terminal facts only, and the obsolete table/module/schema/checker/delete surface fully removed.

Latest implementation gates after the accepted review corrections:

- package typecheck and root typecheck: pass; root Turbo matrix 8/8;
- docs 339 operations/25 groups, routes 6 rules/34 files, architecture index 16 documents;
- control-state redundancy 51 tables/7 allowed fact classes and control-lease owners 18 owners/22 acquire sites;
- package topology 10 packages, release topology 5 authorities, public package release order pass;
- working-tree module topology 1,093 modules/5,445 runtime edges/4 clean imports, no new retained cycle;
- cached and working diff checks: pass.

First exact-index freeze `b4803c9f43315051488bbe7685281a559089012a` contained 21 B8 paths and excluded only the preserved Session formatting change and two Web content changes. Its exact release gate passed 5 authorities, exact module topology passed 1,092 modules/5,443 runtime edges/4 clean imports, and both diff checks passed. The final frozen-tree reviewer returned NOT PASS, P0=0/P1=0/P2=1/P3=0, solely because this ledger still presented the historical pre-freeze checkpoint and remaining-gate list as current. The reviewer found no production-code issue. That exact tree is superseded by this evidence-only correction.

Freeze receipt boundary:

- the current candidate must be staged only after the shared index owner releases it and must retain exactly the three declared working-only exclusions;
- every evidence correction creates a new tree and invalidates older exact-index release/module receipts;
- the final tree hash and final independent-review receipt are reported by the external freeze/delivery receipt rather than embedded in this self-hashed file;
- commit, upstream merge, outgoing audit, hooks, push, and zero ahead/behind remain delivery actions after that external exact-tree receipt passes.

### Cut 8b.1 — B9 dispatch and Task-ingress bounded frontiers

This sub-cut uses current-epoch DDL only. It adds no migration, backfill, compatibility reader, mutable current-status table, generic queue, or reusable scheduler framework.

Implemented facts and reads:

- exact unique indexes bind dispatch lineage, dispatch settlement, and Worker Turn descriptor lookup to one Task/Session dispatch occurrence;
- one immutable `dispatch_delivery_disposition` records only the previously missing per-dispatch budget-suppression relation; accepted delivery remains the existing exact Task-root ingress and is not copied;
- dispatch recovery reads 32-row descriptor-backed unresolved lineage pages, suppressing exact accepted delivery and exact budget disposition in SQL, and no longer owns a process-local `closedDispatchIDs` shadow;
- one immutable `task_root_ingress_disposition` records only an irreversible FIFO-release proof: the complete canonical completed-decision occurrence, one exact terminal lifecycle occurrence, one exact surfaced exhausted gate, or one surfaced Host-fault occurrence the operator must redo through a new ingress;
- current DDL verifies the decision Tool/effect shapes, same assistant/activation/control ingress, complete decision set, terminal lifecycle boundary, and exhausted gate; referenced dispositions and their evidence remain immutable while the Task exists, while Task retention still cascades the closure;
- terminal Task eligibility, the control-plane scan, and the ready-to-lease predecessor fence share the same 32-row unreceipted ingress frontier; `settledIngressIDs` and the all-prior acquisition scan are removed;
- waits, live/expired leases, ready ingresses, and unsurfaced evidence ambiguity remain candidates for the canonical reducer. Once a Host fault releases the FIFO and its operator gate is durable, an `operator_abandoned` proof prevents the old occurrence from becoming ready after a later repair and executing behind its successor.

First uninvolved review: NOT PASS, P0=0/P1=2/P2=1/P3=1. It found that the initial resolved-disposition trigger accepted any completed Tool subset, referenced proof could still be updated/deleted, acquisition still reduced all prior history, and the matrix lacked multipage/index/evidence-drift proof. That implementation checkpoint is superseded.

Corrections after the first review:

- resolved insertion now rejects ordinary completed Tools, `question`, mutating `manage_task`, follow-up coordination decisions, mixed assistants, duplicate/subset evidence, and illegal multi-decision sets;
- disposition rows, referenced dispatch settlement/source/budget, exhausted gate, and resolved activation causal identity are frozen while their Task exists, with Task-retention cascade preserved;
- acquisition pages only unreceipted predecessor candidates and canonically reduces those candidates before granting one physical lease;
- production-shaped tests cover exact false-positive errors, evidence update/delete errors and retention cascade, 65 released predecessors with one evidence read at acquisition, 33 unresolved dispatches over two pages, budget suppression replay, and the complete correlated frontier `EXPLAIN QUERY PLAN`.

Second uninvolved review: NOT PASS, P0=0/P1=2/P2=1/P3=1. It proved that the first correction still approximated the canonical decision occurrence in DDL, treated any lifecycle ingress as terminal delivery, enumerated every historical Project Task before the bounded per-Task page, and had only helper-level rather than production/restart multipage dispatch evidence. That checkpoint is superseded.

A separate system/razor review: NOT PASS, P0=0/P1=1/P2=2/P3=1. It found that a repairable `host_fault` both released FIFO and remained executable, the dispatch disposition did not freeze its lineage, DDL accepted fractional receipt timestamps rejected by the TypeScript parser, and the EXPLAIN fixture omitted the lifecycle branch. That checkpoint is also superseded.

Corrections after both reviews:

- resolved receipts now bind one normalized decision occurrence: exact assistant, control Message, predecessor, activation and the complete completed-decision Tool set; malformed coordination siblings and occurrence drift fail closed, while referenced control and activation identity are frozen;
- dispatch delivery suppression now requires an exact Task-owned, same Session/input, terminal lifecycle ingress; streaming, retry and wrong-Task events remain unresolved;
- the Project heartbeat and explicit Project reconciliation use a 32-row `(Task.time_created, Task.id)` candidate page over only unreceipted ingress, due waits, unconverged cancellation or unresolved dispatch work; the heartbeat rotates its cursor and explicit reconciliation drains all pages;
- a surfaced Host fault writes `operator_abandoned`, making the released occurrence irreversible; 65 such receipts leave acquisition to read only the new target;
- disposition timestamps are integer-only in both runtime schema and DDL, and dispatch lineage plus settlement/source/budget/gate/control/activation evidence is frozen until Task retention;
- production dispatch recovery now drains a 33-occurrence two-page frontier, survives Instance reconstruction, and the complete lifecycle plus Project candidate SQL has indexed EXPLAIN evidence.

The broader matrix then exposed two production regressions that helper-level
proof had not caught:

- Project discovery included terminal-before-ingress history. The candidate SQL
  now selects only the latest opened/reopened execution epoch and excludes an
  exact later terminal occurrence. Equal timestamps remain conservative and
  enter the canonical reducer. The complete open/terminal branch has indexed
  `EXPLAIN QUERY PLAN` evidence.
- resolved receipt discovery initially treated a compaction assistant as a
  competing decision. A competing assistant now counts only when its exact
  activation lease names the current ingress; the liveness test proves the
  durable resolved receipt names the actual decision assistant rather than the
  adjacent compaction Message.

The same production-shaped streamed test found a separate pre-existing search
surface blocker: the five-target Base scheduler's `dispatch_agent` definition
was 40,857 characters, beyond the existing 32,000-character reveal limit, so a
real scheduler could not reach the dispatch path. The fix did not raise the
budget or add a second validator. It constructs common workflow/worktree/
continuation schema fragments once, derives one compact `$ref` Provider JSON
Schema from the canonical Zod input, and retains that canonical Zod schema as
the sole execution parser. The real definition is now 17,824 characters and
4,442 estimated tokens. The streamed acceptance follows the complete current
surface: first scheduler occurrence reveals and calls `dispatch_agent`, the
worker runs from its own search-only initial surface, and the successor
scheduler occurrence reveals and calls `no_action` after the exact terminal
delivery.

One first attempt incorrectly allowed the Provider JSON Schema wrapper to be
cast back to Zod by `dispatch_agents`. Cross-process tests caught the resulting
Zod intersection failure before claim. The collection now obtains the exact
canonical execution schema associated with the dispatch Tool; the Provider
projection remains presentation-only. The complete live-peer, expired-owner
takeover and third-backend delivery-owner group then passed.

Current correction checkpoint (not yet a delivery receipt):

- focused B9 DDL/reducer matrix: 23/23 tests, 104 assertions;
- liveness and bounded sweep matrix: 20/20 tests, 23 assertions;
- dispatch cancellation/local/collection/cross-process/recovery matrix: 28/28
  tests, 76 assertions;
- wait, root-fact, infrastructure-budget, integrity, gate and wake-totality
  matrix: 27/27 tests, 47 assertions;
- real streamed scheduler/worker settlement and Tool-definition budget: 2/2
  tests, 6 assertions;
- combined current-code focused evidence: 101/101 tests, 254 assertions;
- package typecheck passed after the compact-schema correction; it and the root
  typecheck will be rerun after this ledger update;
- an earlier 22-file aggregate reported 91 pass and 7 fail. Five failures were
  overloaded fixture-hook timeouts; its two real assertions produced the
  Project-candidate and compaction-assistant corrections above. It is
  superseded and is not release evidence;
- docs/routes/control/schema/topology, exact-tree release/module/diff gates and
  a fresh uninvolved review are still required before this sub-cut can be
  committed.

The first exact-index Cut 8b.1 candidate
`e3a8f0284a613e0d47391de2942ca887222d5483` was independently reviewed by
three uninvolved agents and is superseded. Their combined result was NOT PASS:

- the resolved-disposition DDL accepted a self-consistent but arbitrary
  control Message identity instead of the application reader's deterministic
  occurrence;
- Project due-Wait discovery did not exclude terminal or older execution
  epochs;
- dispatch and Project candidate queries applied `LIMIT` after correlated
  filtering, so a sparse frontier still walked retained history before
  returning one page;
- an already surfaced Host fault released FIFO in SQL but remained repairable
  in the canonical reducer/acquisition transaction;
- explicit Project traversal sampled time once per page rather than once per
  traversal;
- `dispatch_agents` could fall back from its canonical execution parser, and
  the real Light scheduler surface of `capability_search + dispatch_agents`
  exceeded the aggregate reveal budget for both Anthropic and strict OpenAI.

Corrections after that exact-tree review keep the same razor boundary:

- no migration, backfill, compatibility reader, mutable current-status table,
  generic queue or scheduler framework was added;
- the reversible current-epoch control Message ID is one definition shared by
  application construction and an exact SQLite equality check; a second
  persisted binding fact is unnecessary;
- dispatch and Project discovery first read a 32-row indexed immutable-source
  page, then evaluate the canonical exact predicate for only those rows, and
  advance from the last raw row rather than the last match;
- due Task waits must belong to the latest opened/reopened epoch and that epoch
  must have no terminal fact;
- one traversal freezes `now`; production dispatch recovery preserves only a
  process-local scan cursor, never a domain verdict, and explicitly re-arms
  when another raw page remains;
- `operator_abandoned` is now an absorbing canonical reducer state read by the
  same immediate acquisition transaction, so a stale page owner cannot
  execute repaired evidence after the successor;
- `dispatch_agents` requires the canonical child Zod parser associated with
  the real `dispatch_agent` Tool. Its Provider-facing collection schema is a
  compact `$ref` projection derived from that parser and never becomes a
  fallback execution authority;
- a production Light package test resolves its exact scheduler-only and
  projected workers, materializes the real search and collection Tools through
  both Anthropic and strict OpenAI Provider normalization, reduces the active
  reveal through the production budget reducer, and validates one five-member
  mixed collection occurrence.

Post-review correction evidence before final freeze:

- complete affected aggregate: 112/112 tests, 280 assertions, 23 files,
  170.65 seconds;
- the aggregate includes a self-consistent arbitrary control Message rejected
  by current DDL, an epoch-one due wait excluded after epoch-two reopen, four
  raw Project pages over 70 retained terminal Tasks plus 33 candidates, two raw
  dispatch pages, production driver convergence across both pages, stale-page
  acquisition after operator abandonment, live-peer/expired-owner/third-backend
  dispatch recovery, and the real Light aggregate Tool budget;
- package typecheck had passed before the final evidence-only updates and is
  rerun with root/checker gates below; no exact candidate is frozen yet.

The next exact index, `ea244668df65d917455a17d746db81ba9e5ace16`, was
reviewed independently by three agents and is also superseded. Combined result:
NOT PASS. The reviews found no P0, but found three independent safety/cost
problems and one evidence mismatch:

- a bare `host_fault` released the FIFO before its operator-visible gate and
  permanent abandonment receipt were committed, so a crash in that gap could
  run a successor first and later revive the older occurrence;
- `dispatch_settlement` had no current-epoch insert invariant strong enough to
  stop a hand-written, minimally shaped settlement from authorizing permanent
  budget suppression, and Task-root control identity accepted raw whitespace
  bytes at the SQLite boundary that the application rejected;
- the Project heartbeat sampled only one 32-Task page per 30-second tick, while
  the page implementation issued one candidate query per raw Task. Dispatch
  continuation tests manually invoked reconciliation twice and the restart
  assertion observed only an already empty frontier;
- the Light collection budget fixture claimed a mixed initial/continuation
  occurrence but supplied five initial members.

Corrections preserve the razor boundary rather than adding another state
machine or compatibility layer:

- the gate Artifact and `operator_abandoned` disposition now commit in one
  immediate transaction; a failed transaction leaves the head as `host_fault`,
  arms a retry and prevents its successor from acquiring;
- a strict current-epoch settlement trigger binds final kind, Task, lineage,
  dispatch, child Session, committed recovery authority and exact
  infrastructure locator. The budget disposition independently rechecks the
  same settlement/source digest authority, and both application and DDL reject
  non-canonical control identity bytes;
- each scheduling frontier first reads one indexed raw page and then evaluates
  the exact candidate predicate in one set query over at most 64 IDs. APIs
  return explicit `{ candidates|ingresses|lineages, scannedCount, next }`
  records, with no array compatibility facade or per-row lookup;
- the heartbeat freezes one `now` and drains every bounded Project page during
  one level-triggered tick. Dispatch recovery re-arms its production driver
  from the raw-page cursor, and a restart test now stops after page one with two
  durable candidates before a new Instance resumes them through the real timer;
- the real Light Provider-normalized collection executes two initial and three
  continuation members through the canonical child parser.

Latest correction evidence before a new freeze:

- package typecheck: pass after the DDL, paging, heartbeat, atomic-gate and
  mixed-collection corrections;
- focused pagination matrix: 25/25 tests, 85 assertions;
- atomic Host-fault and dispatch-suppression matrix: 5/5 tests, 31 assertions;
- DDL/index frontier plus real mixed Light surface: 14/14 tests, 61 assertions;
- real heartbeat matrix: 18/18 tests, 21 assertions, including 70 retained
  terminal Tasks followed by 33 candidates discovered and requested in one
  heartbeat;
- all production settlement shapes: 83/83 after updating one stale fixture to
  a real same-Session continuation; no legal terminal outcome was rejected by
  the new DDL;
- the first serial 23-file rerun was 113/114 with one five-second Bun test
  wrapper timeout; the exact isolated detachment group then passed 7/7. A
  second serial rerun reached 112/114 before two Windows process-test wrapper
  limits (5 seconds and 60 seconds) expired; the affected two-file isolated
  rerun passed 12/12, including the killed-owner race in 77.18 seconds. These
  incomplete aggregate attempts are not candidate evidence. The final serial
  rerun uses a 30-second default test wrapper and a 120-second explicit
  cross-process owner-kill wrapper while retaining every test's own bounded
  protocol assertions;
- final serial affected aggregate: 114/114 tests, 290 assertions, 23 files,
  191.11 seconds;
- package typecheck and root typecheck: pass; root Turbo matrix 8/8;
- docs 339 operations/25 groups, routes 6 rules/34 files, architecture 16
  documents, control redundancy 51 tables/7 allowed fact classes, control
  leases 18 owners/22 acquire sites, package topology 10 packages, public
  package release order, and the working-tree release topology all pass;
- working-tree module topology: 1,094 modules/5,466 runtime edges/4 clean
  imports, with no retained strongly connected component. These working-tree
  receipts do not replace the required exact-index release/module/diff gates
  after the corrected paths are staged.

The exact-index candidate `4eb420dfed351d6a1cb6a3282f61659fc765f40b`
passed its five-authority release gate and exact module topology (1,096
modules/5,478 runtime edges/4 clean imports), but fresh independent review was
NOT PASS and therefore supersedes that tree. Combined result: P0=0/P1=2/P2=1/P3=1.

- paging every retained Project Task and draining all pages in one heartbeat
  left the production hot path O(Project history) and passed an unbounded
  candidate array to the driver;
- the settlement insert trigger validated the final outcome only partially, so
  malformed optional/nested outcome evidence could still authorize an
  irreversible delivery disposition;
- JavaScript and SQLite `trim` do not recognize the same whitespace bytes, so
  they were not one durable control-identity contract;
- the ledger and positive matrix overstated those three boundaries.

The selected correction remains current-epoch and keeps the per-Task reducer as
the only semantic authority. Heartbeat discovery reads a fixed Task-ID slice
directly from the four immutable enabling-source frontiers (unreceipted ingress,
current-epoch due Wait, unconverged cancellation and unresolved dispatch), then
re-arms an immediate bounded continuation instead of traversing Project Task
history or materializing an unbounded promise set. The settlement trigger
enumerates the same strict final-outcome shapes as the application parser,
including optional and nested evidence, and the application requires an integer
settlement timestamp. Durable control identity accepts only the exact generated
identifier grammar in both TypeScript and SQLite; neither host performs
whitespace normalization. No migration, backfill, compatibility reader, mutable
projection or generic scheduler queue is introduced.

The first physical-frontier correction was still not sufficient. Although its
SQL returned only eight current rows, SQLite had to walk every earlier settled
source row before the anti-join could produce those eight results. The retained
2,048-ingress fixture therefore exposed about 256 hidden source pages, and the
driver reset to the beginning every five seconds. Dispatch discovery also used
the earlier lineage row even though the later Worker Turn descriptor is the
fact that makes delivery actionable. That intermediate working state is not a
candidate.

The corrected boundary is deliberately smaller than a durable queue:

- one Project-indexed statement reads at most eight physical source rows, and
  one primary-key-bounded statement classifies only those rows against the
  current reducer facts;
- the raw cursor, not the match cursor, drives a 25 ms continuation, while the
  completed traversal retains its in-process tail for the next periodic
  heartbeat. Settled history is paid once during bounded startup catch-up, not
  pumped again on every tick;
- ingress, due Wait and cancellation are their own immutable enabling facts.
  Dispatch uses the later immutable Worker Turn descriptor as its enabling
  fact, so lineage-before-descriptor cannot be lost behind a saved lineage
  cursor;
- only those four source facts carry the exact Task Project owner needed by
  their indexes. The general Artifact row does not copy Project ownership and
  no generic task-control queue, current-status table or persistent scheduler
  checkpoint was added;
- current MySQL transfer drops the live append-order triggers while restoring
  the same current schema, then validates foreign keys, Task/Project source
  authority and creation facts before restoring the triggers in the same
  transaction. It is not an upgrade or compatibility path.

The database boundary follows the user's explicit razor correction: database
compatibility is intentionally dropped. OpenCorvus already probes the complete
canonical schema read-only before opening a pre-release database; a missing
source owner column/index/trigger returns `SCHEMA_RESET_REQUIRED`, preserves the
old database bytes and requires an explicit rebuild from current DDL. This cut
adds no migration file, historical backfill, compatibility reader or fallback.
The earlier Task-creation migration was already removed under the same epoch
rule and is not reintroduced here.

Correction-focused evidence before aggregate freeze:

- exact Project-source/DDL/reducer/heartbeat group: 42/42 tests and 163
  assertions;
- the 2,048-settled-source case advances through fixed eight-row physical pages
  once, discovers 33 later candidates, and a second heartbeat reads zero old
  rows;
- lineage written before its Worker Turn descriptor is absent before the
  descriptor and becomes an exact Task candidate after the descriptor commits;
- current-schema transfer/reset and destructive retention paths are being
  rerun after the Project-authority correction; no exact candidate is frozen.

Pre-freeze final working-tree evidence:

- corrected exact Project-source/DDL/reducer/heartbeat group: 43/43 tests and
  166 assertions after adding wrong-Project trigger contracts;
- current-schema Global Task replay/owner-death, explicit-reset and strict
  transfer group: 23/23 tests and 154 assertions;
- complete serial affected aggregate: 116/116 tests, 469 assertions, 16 files,
  306.24 seconds;
- package typecheck and root typecheck passed; root Turbo matrix is 8/8;
- docs 339 operations/25 groups, routes 6 rules/34 files, architecture 16
  documents, control-state inventory 51 tables/7 fact classes, control leases
  18 owners/22 acquire sites, package topology 10 packages, public package
  release order and working-tree release topology all pass;
- working-tree module topology: 1,094 modules/5,466 runtime edges/no retained
  strongly connected component/4 clean imports;
- exact-index release/module/diff gates and fresh uninvolved review remain
  required after precise staging. These working-tree results are not a freeze
  receipt.

The next exact-index tree, `61a261e3ce918ddca4911394bc76b6c955d71d46`,
is also superseded. Three fresh read-only reviews returned NOT PASS. No P0 was
found; the combined valid findings are:

- the heartbeat advanced its source checkpoint before knowing whether every
  Task request was admitted or coalesced. With four active and twenty-eight
  pending scans, a newly discovered candidate was rejected and then hidden
  behind the saved cursor;
- `(caller_time, id)` is not database commit order. A writer can capture an
  older time, wait for another process, and commit after the heartbeat saved a
  later key. The fact is then permanently behind the cursor;
- an unresolved dispatch observed while its owner was live had no exact
  owner-expiry re-arm. The descriptor cursor advanced, the Task entry retired,
  and a later owner crash appended no new enabling fact;
- Project bootstrap still synchronously traversed all bounded history pages,
  so opening a Project remained O(history);
- dispatch-settlement string validation was not byte-for-byte equivalent:
  JavaScript UTF-16 length differed from SQLite code-point length, SQLite
  `LIKE` accepted case drift, and host-specific trim sets differed;
- live Project and Worker Turn descriptor authority could be rewritten after
  their INSERT-only checks. The descriptor also lacked an exact
  `(Task, Session, dispatch)` lineage binding;
- one Mission resume fixture still supplied arbitrary strings to the strict
  current control-identity contract.

The selected correction remains one current-epoch mechanism, not a durable
queue or migration framework:

- every source uses its SQLite table `rowid` as a process-local physical append
  locator. SQLite serializes writers and stores `rowid` as the implicit final
  key of ordinary secondary indexes, so late commits sort after the saved
  locator even when semantic timestamps were captured earlier. The locator is
  never persisted and is discarded on restart/transfer;
- Wait registration, rather than `due_at`, is the append source. Discovery
  admits the Task once and the existing reducer/driver timer owns its due wake;
- a source slice is provisional until every candidate returns a typed
  `admitted` or `coalesced` result. Capacity rejection retains that same slice
  and immediately retries after capacity is released;
- a live dispatch owner returns its exact lease/process expiry as the Task
  re-arm time, preserving level-triggered recovery without rescanning Project
  history;
- Project bootstrap processes one fixed slice only. The same driver continues
  later slices after Project open;
- settlement identifiers use exact generated ASCII grammar, case-sensitive
  byte comparisons and one explicit Unicode length unit shared by parser and
  DDL;
- Task Project identity and Worker Turn descriptor facts are immutable. The
  descriptor INSERT binds the exact lineage; retention remains an owner
  cascade rather than an independent delete path.

Required positive evidence for the next freeze includes saturation followed by
capacity release, late commits for every source, future Wait due re-arm, live
owner followed by same-peer expiry recovery, fixed-work Project open, exact
lineage and update fences, Unicode/case/whitespace settlement errors, and the
real Mission resume fixture. No result from `61a261e3` is candidate evidence.

Implementation follow-up closed three design gaps before the next freeze:

- each physical source checkpoint stores `(rowid, durable_source_id)` and is
  reused only while that exact source still owns that rowid. Deleting the
  maximum row, rowid reuse and in-connection `VACUUM` therefore reset the
  affected source rather than hiding a later append;
- the Database exposes a process-local physical connection epoch. Transfer or
  rebuild closes and reopens SQLite, so every old source cursor is discarded
  even when the restored database carries the same durable Project identity;
- timer re-entry faults now re-arm the same Task under bounded backoff. Project
  bootstrap does not call the re-entry adapter because its caller already owns
  the Instance lease; the attempted nested re-entry was observed to deadlock
  the real streamed-dispatch and Session-delay paths and was removed. A
  bootstrap read fault still re-arms the periodic heartbeat in `finally`.

Latest pre-freeze working-tree evidence after those corrections:

- OpenCorvus package typecheck: PASS;
- latest directly affected matrix: 60/60 tests, 229 assertions, 0 failures;
- complete scheduling impact matrix: 122/122 tests across 17 files, 521
  assertions, 0 failures, 311.97 seconds;
- the positive cases include saturated admission followed by capacity release,
  timer re-entry recovery, one-slice Project bootstrap, 2,048 retained Tasks,
  deleted-tail rowid reuse, transfer connection-epoch invalidation, real
  streamed dispatch, native Wait and Session delay, remote dispatch owner lease
  expiry followed by automatic same-driver settlement, exact descriptor
  lineage/immutability/retention, and parser/DDL Unicode/case/whitespace parity.

This is still not a candidate receipt. Package/root typechecks, documentation,
route/control/schema/topology checks, precise staging, exact-index release and
module checks, and a fresh uninvolved read-only review remain mandatory.

The exact-index tree `23ce605f517698cda22cfe9b90efed49fae37d36`
passed its pre-review test and checker matrix but is superseded by fresh
independent review. The result was NOT PASS: P0=0/P1=3/P2=2/P3=0.

- Project source slices were committed when every request returned
  `coalesced`, but cancellation and dispatch reconciliation still ran only in
  pass zero. A source committed after those reads could increment the driver
  revision and then be skipped by the fresh pass;
- Task-local dispatch recovery saved the last page's live-owner wake and could
  overwrite an earlier page's sooner lease expiry;
- Task-local dispatch recovery paged the earlier lineage `(time_created,id)`
  and only afterwards required a Worker Turn descriptor. A late descriptor or
  a lineage committed with an older captured timestamp could remain behind the
  saved cursor;
- dispatch settlement numeric evidence did not enforce the JavaScript safe
  integer boundary in SQLite;
- the positive matrix did not yet prove a late commit for all four Project
  sources or physical-cursor invalidation after in-connection `VACUUM`.

The correction does not add another queue, checkpoint table or migration. It
uses the existing immutable facts and driver revision as the only authorities:

- accepted-dispatch recovery pages the later Worker Turn descriptor directly
  by its Task-indexed physical `(rowid, descriptor_id, connection_epoch)`
  frontier, then resolves only the exact bounded lineage set for that page;
- a Task-local descriptor traversal carries the minimum live-owner wake across
  every page, and discards the traversal if the physical connection epoch
  changes;
- cancellation convergence and dispatch recovery execute on every fresh
  driver pass. A source coalesced after pass zero therefore receives a new
  production read before the provisional Project slice can be considered
  consumed;
- SQLite settlement checks now apply `Number.isSafeInteger`-equivalent bounds
  to the settlement time, numeric issue-path atoms and every nested catalog
  revision;
- production-shaped tests inject a late ingress, Wait registration,
  cancellation and descriptor after a completed Project frontier, and prove
  the fresh source fact is discovered. They also delete/compact physical rows
  with `VACUUM`, append a new fact and prove the stale cursor is invalidated.

Correction-focused evidence after this review is 76/76 tests across eight
files, 310 assertions, 0 failures, 108.91 seconds. It includes a 33-descriptor
two-page recovery where the first page's live-owner expiry remains armed, an
older semantic-time descriptor committed after pass zero and settled by the
fresh production pass, a cancellation committed after pass zero and converged
by that same revision mechanism, all four late Project sources, `VACUUM`
renumbering, and parser/DDL safe-integer parity. OpenCorvus package typecheck
also passes. This remains working-tree evidence; the complete aggregate,
checkers, exact staging and a fresh uninvolved review are still required.

Pre-freeze aggregate evidence for the corrected working tree:

- complete serial scheduling impact matrix: 128/128 tests across 18 files,
  545 assertions, 0 failures, 334.12 seconds;
- OpenCorvus package typecheck: pass; root typecheck: 8/8 Turbo tasks pass;
- docs: 339 operations/25 groups; routes: 6 rules/34 files; architecture:
  16 current documents; package topology: 10 packages; public package release
  order: pass;
- control-state inventory: 51 tables/7 allowed fact classes; control leases:
  18 owners/22 acquire sites, all declared;
- working-tree module topology: 1,094 modules/5,466 runtime edges/no retained
  strongly connected component/4 clean imports;
- working and cached diff checks: pass before precision staging.

No exact candidate is frozen by these receipts. The release checker still
observed the superseded staged tree while corrections were working-only. A new
index tree must be written, its release and module topology rerun against that
exact index, and that frozen tree must receive a fresh uninvolved read-only
review before it can be committed.

The resulting exact-index tree
`25d42aa1703758d68051381cd3079f602bd76703` passed release/module/diff gates
but a fresh uninvolved review returned NOT PASS: P0=0/P1=1/P2=1/P3=1. The
five findings against `23ce` were independently confirmed closed; three new
gaps remained:

- MySQL transfer temporarily removed the Worker Turn descriptor insert
  trigger but its transaction-local validator checked only Task/Project/
  Session ownership, not the same exact dispatch lineage;
- `dispatch_delivery_disposition` and `task_root_ingress_disposition` still
  accepted execution epochs and creation times outside the JavaScript safe
  integer range at the raw SQLite boundary;
- the public scan-context comment still described recovery as pass-zero-only,
  contradicting the corrected revision-fixpoint contract.

The correction is intentionally direct. Transfer now applies the same exact
`(task_id, child_session_id, current_dispatch_id)` lineage predicate before it
restores the live trigger and commits; it adds no reader, fallback or transfer
repair. Both disposition triggers bound their epoch and creation time to
`1..9007199254740991`. The scan-context contract now says that every reconciler
which can observe a coalesced source must reread it on each fresh revision
pass; only work independent of source revisions may self-limit to pass zero.

Correction-focused evidence is 37/37 tests across four files, 259 assertions,
0 failures, 52.07 seconds. A current production descriptor snapshot passes
preflight, imports and remains readable. Wrong dispatch, wrong same-Project
Session and missing-lineage snapshots all return the same typed validation
failure before target mutation; a failed real import leaves the exported
target facts byte-for-byte equivalent. The two disposition triggers reject
fractional and maximum-plus-one epoch/time values, while the exact maximum
creation time passes the trigger and reaches the existing occurrence uniqueness
constraint. Package typecheck passes. The full aggregate, static checkers,
precision staging and another fresh uninvolved review remain mandatory.

Post-correction pre-freeze evidence:

- complete serial scheduling impact matrix: 128/128 tests across 18 files,
  558 assertions, 0 failures, 335.05 seconds;
- OpenCorvus package typecheck: pass; root typecheck: 8/8 Turbo tasks pass;
- docs: 339 operations/25 groups; routes: 6 rules/34 files; architecture:
  16 current documents; package topology: 10 packages; public package release
  order: pass;
- control-state inventory: 51 tables/7 allowed fact classes; control leases:
  18 owners/22 acquire sites, all declared;
- working-tree module topology: 1,094 modules/5,466 runtime edges/no retained
  strongly connected component/4 clean imports.

These are still working-tree receipts. The release checker necessarily reads
the superseded staged tree until precision restaging. A new exact tree,
exact-index release/module/diff gates and a fresh uninvolved review with no
unresolved P0-P3 finding are required before delivery.

The exact-index tree `dc0aa2691f7f5a056fef4fb1f2d30632c4507e9a`
passed its release/module/diff gates, but fresh uninvolved review returned NOT
PASS: P0=0/P1=1/P2=0/P3=0. Every earlier finding was confirmed closed. The new
P1 was a settlement-delivery retry gap: a descriptor recovery error after its
unique settlement committed was logged while both Task-local and Project
frontiers advanced, with no remaining fact or timer to replay the undelivered
settlement in the live process.

The selected correction keeps one existing recovery traversal. A failed
descriptor sets a retry obligation carried across all remaining descriptor
pages, so independent siblings continue. At the final page the Task-control
driver treats that obligation as non-progress, applies its existing bounded
exponential backoff and restarts descriptor paging from the validated physical
origin. Already delivered siblings disappear through the existing exact
ingress/disposition filters; only the still-undelivered settlement replays.
The driver now accumulates any earlier exact owner/due wake before applying the
non-progress penalty, so backoff cannot postpone a real deadline.

The positive crash-cut injects one failure after the exact settlement and
infrastructure fact commit but before Task-root ingress acceptance. Without a
process restart, the same live driver retries, observes the persisted
settlement and accepts one exact recovery ingress on its second delivery
attempt. Replay retains one ingress and no unresolved descriptor. The directly
affected driver/recovery group is 26/26 tests, 108 assertions, 0 failures,
37.05 seconds; package typecheck passes. Full aggregate, static checkers,
precision staging and another fresh independent review remain required.

Post-retry-correction pre-freeze evidence:

- complete serial scheduling impact matrix: 128/128 tests across 18 files,
  558 assertions, 0 failures, 335.59 seconds;
- OpenCorvus package typecheck: pass; root typecheck: 8/8 Turbo tasks pass;
- docs: 339 operations/25 groups; routes: 6 rules/34 files; architecture:
  16 current documents; package topology: 10 packages; public package release
  order: pass;
- control-state inventory: 51 tables/7 allowed fact classes; control leases:
  18 owners/22 acquire sites, all declared;
- working-tree module topology: 1,094 modules/5,466 runtime edges/no retained
  strongly connected component/4 clean imports.

No candidate is declared from these working-tree results. Precision staging,
exact-index release/module/diff gates and a fresh uninvolved review remain the
release boundary.

The exact-index tree `244f1e9b4ac77f244078691af9c9a4b3c8f1d647`
passed its gates but fresh uninvolved review returned NOT PASS:
P0=0/P1=0/P2=2/P3=0. All earlier correctness findings were confirmed closed.
The remaining issues were bounded-work evidence and one hot path:

- Task-local ingress scan and lease fencing paged raw retained ingress history
  in the application, then filtered immutable dispositions. A long-running
  Task therefore performed O(history/page) SQL round-trips, including inside
  `BEGIN IMMEDIATE`;
- settlement-delivery retry was production-proven for one descriptor, but not
  with a failed first-page occurrence, successful later-page siblings and an
  earlier live-owner deadline in the same traversal.

The hot-path correction moves the immutable disposition anti-join into the one
indexed FIFO statement before `ORDER BY ... LIMIT`. Scan and lease fencing
already share that primitive, so released history now returns an empty bounded
page in one call without a mutable cursor or status table; only genuinely
unreleased predecessors require further pages. The EXPLAIN contract proves the
Task/epoch FIFO index and exact disposition ingress index in the same query.

The retry evidence now creates 33 descriptors before scanning. A first-page
dead-owner occurrence commits its settlement and fails before ingress
acceptance; the remaining first page includes 31 live owners, and the later
page includes successful dead-owner siblings plus a descriptor committed with
older semantic time. A 10-second retry backoff is deliberately later than the
five-second owner expiry. The same live driver carries the failure obligation
across pages, settles later siblings, arms no later than owner expiry, restarts
from the physical origin and delivers the failed occurrence on its second
attempt. Final facts are one settlement, one exact recovery ingress and no
unresolved descriptor for that occurrence.

Correction-focused evidence is 49/49 tests across four files, 216 assertions,
0 failures, 59.98 seconds; package typecheck passes. The retained-ingress case
uses 257 released occurrences and proves an empty current-prior frontier plus
one reducer evidence read for the target acquisition. Full aggregate,
checkers, precision staging and another fresh review remain mandatory.

Post-P2-correction pre-freeze evidence:

- complete serial scheduling impact matrix: 128/128 tests across 18 files,
  559 assertions, 0 failures, 334.08 seconds;
- OpenCorvus package typecheck: pass; root typecheck: 8/8 Turbo tasks pass;
- docs: 339 operations/25 groups; routes: 6 rules/34 files; architecture:
  16 current documents; package topology: 10 packages; public package release
  order: pass;
- control-state inventory: 51 tables/7 allowed fact classes; control leases:
  18 owners/22 acquire sites, all declared;
- working-tree module topology: 1,094 modules/5,466 runtime edges/no retained
  strongly connected component/4 clean imports.

These receipts still precede precision staging. Exact-index release/module/diff
gates and another fresh uninvolved review are required before delivery.

The exact-index tree `2488d118cc89d4147beab942627fe547da4d7731`
passed its gates but fresh uninvolved review returned NOT PASS:
P0=0/P1=0/P2=0/P3=1. Every correctness and bounded-work finding above was
confirmed closed. The remaining hygiene gap was a process-local descriptor
cursor retained when a Task committed `task.deleted` between pages: the next
scan returned at the Project-ownership boundary without clearing that Map
entry, while no future Project source could rediscover the tombstoned Task.

The fix adds no sweeper, table or lifecycle mechanism. The existing
`currentProjectOwnsTask` early-return boundary now deletes only that Task's
process-local dispatch recovery cursor before returning. The positive test
creates 33 descriptor-backed occurrences, observes the first-page cursor,
commits the real `task.deleted` protocol boundary in the source hook, and lets
the same retiring driver take its scheduled continuation. The continuation
proves both the recovery cursor and driver entry are absent. The corrected
recovery file passes 3/3 tests and 78 assertions; package typecheck passes.
Full aggregate, checkers, precision staging and another fresh review remain
mandatory.

Post-cursor-cleanup pre-freeze evidence:

- complete serial scheduling impact matrix: 128/128 tests across 18 files,
  560 assertions, 0 failures, 338.87 seconds;
- OpenCorvus package typecheck: pass; root typecheck: 8/8 Turbo tasks pass;
- docs: 339 operations/25 groups; routes: 6 rules/34 files; architecture:
  16 current documents; package topology: 10 packages; public package release
  order: pass;
- control-state inventory: 51 tables/7 allowed fact classes; control leases:
  18 owners/22 acquire sites, all declared;
- working-tree module topology: 1,094 modules/5,466 runtime edges/no retained
  strongly connected component/4 clean imports.

These results do not revive any earlier candidate. Precision staging, stable
exact-index release/module/diff gates and a fresh uninvolved review with no
unresolved P0-P3 finding remain the delivery boundary.

The exact-index tree `694d5f258d5b26c63e82d3a365c18abf0a01dfd8`
passed its gates but fresh uninvolved review returned NOT PASS:
P0=0/P1=1/P2=1/P3=0. The P1 was a cross-process delivery TOCTOU: descriptor
paging excluded an already accepted terminal lifecycle only at page-read time,
while settlement recovery's later check recognized Artifact-sourced ingress
but not the exact descriptor-backed terminal Protocol ingress. A lifecycle
owner and recovery owner could therefore accept two differently sourced
Task-root ingresses for one dispatch. The P2 was durable lifecycle disposition
selection by `localeCompare`, whose ICU-dependent tie break could choose
different immutable evidence bytes across hosts.

The correction introduces no delivery-status table. One bounded reducer over
the existing immutable facts recognizes the exact dispatch's terminal
Protocol ingress, settlement/infrastructure Artifact ingress and budget
suppression disposition. Descriptor paging uses that reducer in batches, and
both lifecycle and settlement-recovery delivery rerun it inside the same
`BEGIN IMMEDIATE` transaction that accepts the winning ingress. Either owner
may win; the loser returns the existing delivery without minting a second
control occurrence. Lifecycle disposition selection now uses persisted
Protocol sequence first and the repository's code-point canonical comparator
only as a deterministic final tie break.

The positive interleaving blocks the lifecycle owner after settlement commit,
starts and blocks settlement recovery before its acceptance, lets lifecycle
accept the exact Protocol ingress, then releases recovery. The final database
contains only that one terminal delivery source. Canonical evidence tests also
prove sequence priority and deterministic upper/lower-case ID tie breaking.
The directly affected matrix is 26/26 tests across three files, 189 assertions,
0 failures; OpenCorvus package typecheck passes. Full aggregate, static
checkers, precision staging and another fresh review remain mandatory.

Post-delivery-race-correction pre-freeze evidence:

- complete serial scheduling impact matrix: 128/128 tests across 18 files,
  564 assertions, 0 failures, 341.25 seconds;
- OpenCorvus package typecheck: pass; root typecheck: 8/8 Turbo tasks pass;
- docs: 339 operations/25 groups; routes: 6 rules/34 files; architecture:
  16 current documents; package topology: 10 packages; public package release
  order: pass;
- control-state inventory: 51 tables/7 allowed fact classes; control leases:
  18 owners/22 acquire sites, all declared;
- working-tree module topology: 1,094 modules/5,466 runtime edges/no retained
  strongly connected component/4 clean imports.

The large-history heartbeat contract builds 2,048 retained terminal Tasks and
then proves fixed eight-row source slices plus immediate continuation through
33 candidates. Its former five-second test-process timeout was below fixture
construction time on the validation host. A later full serial matrix reached
36.26 seconds under host load while the same production query-count and page
assertions remained green, so the fixture-only budget is 60 seconds. Every
bounded-work assertion and production threshold remains unchanged.

No candidate is declared from working-tree evidence. Precision staging,
exact-index release/module/diff gates and a new uninvolved review remain
mandatory.

The next exact-index tree
`23a740b5b1b8d8d652851ef38add11ddc2f9857c` also passed its gates but fresh
uninvolved review returned NOT PASS: P0=0/P1=1/P2=1/P3=1. The P1 was an
execution-occurrence gap: dispatch recovery bound Task, child Session and
dispatch ID, but not the creator Task execution epoch. A terminal Task could
therefore retain a permanent recovery obligation, and reopening the same Task
could admit an epoch-one descriptor into epoch two. The P2 was a second copy
of delivery classification inside the Project descriptor frontier rather than
the declared shared immutable-fact reducer. The P3 was a contract mismatch:
the spec named Protocol sequence as lifecycle authority while the reducer
sorted wall-clock time first.

The correction extends the current, reset-only dispatch-lineage schema with
the creator `execution_epoch`. The production writer derives that epoch inside
the lineage transaction from the exact Tool request, its Orchestrator
assistant Message, that Message's Task-root activation lease and the accepted
ingress. A SQLite trigger enforces the same complete lineage. There is no
migration or compatibility reader: databases without this current shape use
the already selected explicit reset boundary.

One bounded `dispatchRecoveryCandidatesInTransaction` reducer now classifies
both Task-local recovery pages and Project descriptor pages. It requires an
exact lineage/descriptor triple, the lineage epoch to equal the latest opened
Task epoch, the creator epoch to have no terminal fact, and the Task to have no
deletion fact. It then excludes the existing exact delivery disposition,
settlement/infrastructure ingress or terminal lifecycle ingress. Every
settlement and lifecycle delivery path reruns that same predicate inside the
`BEGIN IMMEDIATE` transaction that accepts Task-root ingress, including the
direct abandoned-worker settlement path.

The positive crash cut blocks after the immutable settlement commit and before
Task-root acceptance, terminalizes epoch one, and releases delivery. The
transactional admission returns ignored: no settlement ingress is accepted,
no recovery cursor remains and no retry is armed. Reopening the Task to epoch
two and scanning again leaves the same old descriptor excluded and does not
invoke delivery a second time. Raw SQLite attempts to bind the lineage to
epoch two or to a different Tool Part return the exact creator-occurrence
constraint. Protocol lifecycle evidence now sorts persisted sequence first
and canonical ID second; the test deliberately gives the lower sequence the
later wall-clock time.

Current correction-focused evidence is 25/25 tests across the DDL, schema and
abandoned-dispatch files, 220 assertions, 0 failures, 36.44 seconds. The
direct test fixtures that write lineages were also audited: cross-process and
Goal Workload fixtures now materialize the same completed assistant/Tool/
activation occurrence, while the Project-deletion aggregate owns an explicit
Task-root creator ingress. Their affected process and retention cases pass.
OpenCorvus package typecheck passes. These are working-tree receipts only;
the complete impact matrix, root typecheck, static checkers, precision staging,
exact-tree gates and a new uninvolved review remain mandatory.

Post-correction pre-freeze evidence:

- direct creator-occurrence process/retention matrix: 10/10 tests, 41
  assertions, 0 failures; reviewer-focused DDL/schema/recovery matrix: 25/25,
  220 assertions, 0 failures;
- complete serial scheduling impact matrix: 129/129 tests across 18 files,
  570 assertions, 0 failures, 342.71 seconds;
- OpenCorvus package typecheck: pass; root typecheck: 8/8 Turbo tasks pass;
- docs: 339 operations/25 groups; routes: 6 rules/34 files; architecture:
  16 current documents; package topology: 10 packages; public package release
  order: pass;
- control-state inventory: 51 tables/7 allowed fact classes; control leases:
  18 owners/22 acquire sites, all declared;
- working-tree module topology: 1,094 modules/5,466 runtime edges/no retained
  strongly connected component/4 clean imports.

The release-topology invocation still named the deliberately invalidated
`23a740b5b1b8d8d652851ef38add11ddc2f9857c` index and is not candidate
evidence. Precision restaging and release/module/diff gates against one new,
stable exact tree are required before a fresh uninvolved review.

The later exact-index tree
`e6907c4597150b3d42ed94192dfabbc368d9fff3` passed its focused, aggregate,
typecheck and exact-tree gates, but fresh uninvolved review returned NOT PASS:
P0=0/P1=1/P2=2/P3=0. The P1 was that a retained Task still allowed deletion of
its immutable dispatch lineage, and its creator activation identity could be
rewritten or deleted after lineage insertion. The first P2 was that the shared
classifier loaded every lifecycle event for the selected Tasks inside an
immediate transaction instead of querying only the bounded exact execution
occurrences. The second P2 was stale architecture prose that still described
historical schema migration despite the selected reset-only database epoch.
That tree and all of its candidate evidence are invalidated.

The correction keeps the existing ownership cascade: a retained Task protects
its dispatch lineage from direct deletion; after Task retention deletes the
Task, the existing cascade removes the lineage and its creator activation may
be retired. Separate lineage-specific triggers freeze the exact activation
target, owner occurrence and activation time while permitting only lease
expiry renewal. Existing settlement/disposition triggers and their error
contracts remain unchanged.

The shared recovery classifier now rejects a page larger than 64 exact
descriptors before querying. For one accepted page it issues five fixed query
stages. Lifecycle classification receives only the unique `(task_id,
execution_epoch)` pairs from those lineages through a bounded `VALUES` CTE and
uses the current-open, exact-terminal and deletion partial indexes. It returns
one row per requested occurrence regardless of how many historical epochs the
Task retains. The production query-plan hook, rather than a copied dispatch
SQL surrogate, proves the three lifecycle indexes. A positive test retains
257 closed epochs, reopens epoch 258, and proves one occurrence row, five fixed
stages, identical Task-local and Project exclusion, the 64-descriptor contract,
retention cascade, activation immutability and expiry renewal.

The current architecture now states one reset-only schema epoch consistently:
unknown or historical schema/payload drift fails with `SCHEMA_RESET_REQUIRED`;
there is no migration, payload conversion, trigger repair, compatibility
reader or dual read/write path. These are correction-focused working-tree
receipts only until the complete matrix and exact-tree gates are rerun.

The wider creator-occurrence audit found two Goal Workload production-adapter
tests whose custom lineage hook minted Tool IDs without materializing the
corresponding Task-root assistant/Tool occurrence. The shared test fixture now
exposes its exact creator materializer and those production-chain tests invoke
it before the real claim. This changes no runtime fallback: the production
lineage writer and DDL still require the same persisted occurrence. The whole
Goal Workload contract file passes 27/27 tests and 52 assertions; the Project
retention and cross-process dispatch files pass their remaining 66/66 tests.

Post-review8 correction evidence before precision staging:

- reviewer-focused DDL/schema/recovery matrix: 25/25 tests, 226 assertions,
  0 failures;
- complete serial scheduling impact matrix: 129/129 tests across 18 files,
  576 assertions, 0 failures, 354.47 seconds;
- OpenCorvus package typecheck: pass; root typecheck: 8/8 Turbo tasks pass;
- docs: 339 operations/25 groups; routes: 6 rules/34 files; architecture:
  16 current documents; package topology: 10 packages; public package release
  order: pass;
- control-state inventory: 51 tables/7 allowed fact classes; control leases:
  18 owners/22 acquire sites, all declared;
- working-tree module topology: 1,094 modules/5,466 runtime edges/no retained
  strongly connected component/4 clean imports.

No earlier tree is revived. Precision staging plus release/module/diff gates
against one new exact tree and a fresh uninvolved review remain mandatory.

The first post-review8 exact tree
`67ee10795f4b7a32c25f90db761eb63b9c3ba284` was invalidated before its
independent review completed. A root read-only pass found that the attachment
authority paragraph still said the Database instance ID survived a registered
schema migration immediately before its reset-only rule. The reviewer was
interrupted before any result was accepted. The paragraph now names only a
matching current-schema reopen as stable; historical/unknown schema still has
the single explicit reset boundary.

Fresh review of the subsequent exact tree found no P0 or P1 and two P2
boundaries. First, the first four recovery stages independently selected a
Task-ID set and dispatch-ID set, so a 64-descriptor request could materialize
cross-product rows before JavaScript discarded the non-requested pairs.
Second, the lineage reader was strict but the current DDL accepted unknown
top-level and projected-identity keys, allowing a current-fingerprint transfer
snapshot to pass physical restoration and fail only at a later business read.

The correction keeps one bounded classifier. Its lineage stage matches the
complete Task/child-Session/dispatch triple. The other three delivery stages
rebuild their request set only from those actual lineages and use correlated
existence checks, returning at most one row per requested descriptor even when
multiple qualifying ingress facts exist. Terminal lifecycle delivery now also
binds the requested child Session. Production EXPLAIN hooks exercise 64 exact
requests and prove the disposition, settlement, ingress-source and descriptor
indexes; the existing observer still reports one bounded row count for every
stage and rejects 65 descriptors before querying.

The current lineage DDL now enforces the strict top-level key set, duplicate-key
rejection, Tool collection bounds, canonical case-sensitive Slice refs, exact
Task work scope, target/projected-agent equality, Dynamic Agent ID shape,
runtime-template/Session-kind/dispatch-adapter mapping, both ABI versions,
projection hash and row creation time. The TypeScript reader shares the target,
time and unique workflow-node contract. Transfer preflight and apply restore the
snapshot under that same current DDL; malformed strict-shape and projected
identity snapshots fail before replacing the original database, while the
valid snapshot round-trips its lineage, creator and descriptor.

Correction-focused evidence: OpenCorvus package typecheck passes; 32 tests
across the DDL, transfer, cross-process dispatch and abandoned-recovery files
pass with 261 assertions and no failures. Complete aggregate/typecheck/checker
evidence, precision staging, a new exact tree and fresh uninvolved review remain
mandatory before commit.

Post-correction freeze evidence:

- complete serial scheduling impact matrix: 136/136 tests across 19 files,
  611 assertions, 0 failures, 364.31 seconds;
- OpenCorvus package typecheck: pass; root typecheck: 8/8 Turbo tasks pass;
- docs: 339 operations/25 groups; routes: 6 rules/34 files; architecture:
  16 current documents; package topology: 10 packages;
- control-state inventory: 51 tables/7 allowed fact classes; control leases:
  18 owners/22 acquire sites, all declared;
- exact-index release mutation topology: 5 canonical authorities; exact-index
  module topology: 1,096 modules/5,484 runtime edges/no retained strongly
  connected component/4 clean imports;
- cached and working diff checks pass; working-only paths remain the pre-existing
  Session formatting difference and two Web content exclusions, with no cached
  intersection.

This freeze is review input, not delivery. A fresh uninvolved reviewer must
return no unresolved P0-P3 finding before commit.

### Cut 8b.2 — B9 Event bounded current frontier

#### Recall

- **User requirement:** continue from the pushed scheduling ledger until every
  real problem is closed, then run one exact-remote end-to-end Mission and
  inspect its complete scheduling trajectory before release. Do not reopen or
  delay already delivered cuts.
- **Acceptance:** Event definition discovery is Project-scoped and keyset
  paged; every production recovery, claim, same-job handoff and lease-recovery
  path reduces the same bounded unresolved FIFO head; retained terminal history
  does not enter that hot set; restart and multiple Projects preserve identical
  due work; query stages and plans are proven on the production queries.
- **Hard constraints:** immutable Event definitions, occurrences, Fires,
  receipts and generic control leases remain the only facts. Add no head table,
  mutable projection, process-local cache, compatibility reader, generic queue
  or second scheduler. Explicit history APIs may still project retained
  history, but scheduling paths may not call that history projector.
- **Sources read:** the complete B9 selection above; current
  `event-service.ts`, `event-projection.ts`, `event.sql.ts`, generic control
  lease implementation and schema; Event durable-fire, claim-attempt,
  scheduler fact-control and schema/index tests; all current references to
  `currentEventDefinitions`, `projectEventJobInTransaction`,
  `projectEventFireInTransaction`, `recoverProjectFires`, `claimFire`,
  `enqueueNextFireForJob` and `scheduleLeaseRecovery`.
- **Independent feedback:** the C1/C2 correction reviewer rechecked committed
  source and proved B9 Event was not part of `4abdaea58`; current Event still
  loads all definition revisions and Fire histories on scheduling paths. It
  did not participate in this implementation.

#### Current-source root analysis

The observable cost is not one large public history response. A single Bus
event calls `currentEventDefinitions`, which materializes every revision and
then performs one tombstone query per definition before full-history job
projection. Startup and rollback recovery scan every Fire in the database and
project every receipt and lease. An exact claim and every same-job handoff scan
all Fires again, and lease recovery repeats a per-job version of the same
projection. Retained terminal history therefore increases the one-event,
one-claim and one-heartbeat cost after every restart.

The direct trigger is reuse of `projectEventJobInTransaction` and
`projectEventFireInTransaction`—explicit history/view projectors—as the
scheduler's current-work selector. The data-flow root is the absence of a SQL
current-definition page and unresolved-fire head. FIFO correctness is then
reconstructed in JavaScript from permanent history, so the runtime maps and
physical-capacity permits can limit concurrent effects but cannot bound the DB
work needed to discover one effect. Increasing caches or indexes around the
same `.all()` readers would retain the wrong authority and would still regress
on restart.

#### Selected single-source design

1. A Project-scoped definition query selects only the newest untombstoned row
   for each `definition_id`, ordered by `(definition_id, revision, id)` and
   limited to 64 plus one cursor row. Event matching and Fire creation stream
   those pages inside one immediate writer snapshot, so definition/tombstone,
   one-shot settlement and accepted Fire have one serial order. A fixed page
   query determines completed one-shot definitions; no per-row tombstone or
   Fire history query remains.
2. Every immutable Fire carries its definition-local monotonic queue position,
   allocated for the selected definition set in one fixed query inside the
   existing immediate acceptance transaction. Every terminal receipt carries
   the same definition and queue-position relation, enforced against its Fire
   by current-schema DDL. A partial terminal-frontier index seeks the latest
   contiguous terminal position, and the Fire index seeks exactly position
   `terminal + 1`; retained terminal rows are never walked to prove the head.
   It returns at most one FIFO head per definition in a Project-scoped page.
   Latest retry receipt and current lease are loaded only for those selected
   IDs in fixed set queries. Attempt count and first-start time are aggregate
   queries only when the exact selected Fire is projected or claimed; lease
   history is never materialized.
3. Recovery pages only these heads. Exact claim re-runs the same head reduction
   for its Fire inside the immediate lease-acquire transaction. Success or
   disposition asks the same reducer for that job's next head. A lease-recovery
   timer is definition-level even when seeded by one Fire: when it wakes it
   rereads and enqueues the then-current head. Therefore a remote owner crash
   after terminal commit but before its process-local handoff cannot strand the
   successor. Lease recovery derives its deadline from the same selected head
   instead of scanning that job's Fire history. Process settlement enumerates
   Project IDs from the same bounded unresolved pages.
4. The explicit Event list/fire views retain immutable history semantics, but
   exact Fire projection uses latest-receipt and aggregate lease queries rather
   than loading full child arrays. No production scheduler entry calls the
   retained-history job projector.
5. Composite definition/Fire indexes serve the exact Project, definition and
   Fire-order joins. The terminal receipt remains the sole absorbing boundary;
   retry receipts and generic control leases remain immutable facts rather
   than copied current state.

#### Positive verification plan

- Create more than two definition pages across two Projects with historical
  revisions and tombstones; production matching sees every and only current
  definition in the active Project with fixed query stages per page.
- Retain hundreds of terminal Fires plus multiple unresolved Fires per job;
  production recovery selects exactly one FIFO head per job, hands off the next
  after settlement, and keeps the due set identical after runtime restart.
- Prove pending, live-running, expired-owner and future-retry heads; exact claim
  revalidates under the writer transaction and cannot skip an older head.
- Exercise accept, startup/rollback recovery, claim, next-fire and lease
  recovery through production hooks; none may invoke the retained-history
  selector.
- Run `EXPLAIN QUERY PLAN` against the exported production queries and prove the
  Project/definition, Fire order, terminal receipt, retry receipt and current
  lease indexes. Reject a 65-ID set before issuing child queries.
- Run the complete affected non-UI Event matrix, OpenCorvus/root typecheck,
  docs/routes/control/schema/architecture/package/release/module-topology
  checks, precision staging and a fresh uninvolved read-only review before
  commit and push. Cut 8b.3 Automation starts only from that pushed baseline.

#### Implementation evidence before first independent review

The final affected non-UI matrix reaches its natural terminal result with
84/84 tests and 309 assertions across ten files. The new production-frontier
file contributes 4/4 tests and 22 assertions: 129 current definitions across
three pages and two Projects, fixed definition/one-shot and head/retry/lease
query stages, 260 retained terminal Fires plus 65 FIFO heads, exact queued-head
claim refusal, a real 65-definition recovery and next-Fire handoff, sibling
Project isolation, and first-run versus predecessor cooldown behavior. Existing
Event Mission reservation, durable Fire/retry/replay, Automation frontier,
generic lease, Session deletion, Task wait and current-schema contracts remain
green in the same run.

OpenCorvus package typecheck passes, and root typecheck passes all eight
workspace tasks. Docs pass at 339 operations / 25 groups, routes at 6 rules /
34 files, architecture at 16 current documents, package topology at ten
workspaces, control leases at 18 owners / 22 acquisition sites, control-state
redundancy at 51 tables / seven allowed classes, and the three-component
release family remains `0.0.58-beta`. Pre-evidence exact index tree
`d5e0c8676c131cd54a77d37ce1388f56a44baf6d` passes release mutation with five
canonical authorities and module topology with 1,102 modules, 5,523 runtime
edges, no retained strongly connected component and four clean imports. The
only working-only exclusions are the pre-existing `session/index.ts` formatting
change and two Web content changes. This evidence paragraph is staged next;
the resulting exact tree is the sole input to a fresh uninvolved read-only
review, and commit remains contingent on zero unresolved P0-P3 findings.

#### First exact-tree review corrections

The uninvolved review of exact tree
`824dffb52cc4edd992387715707c8c13a2a2840e` returned P0=0, P1=1, P2=1 and
preserves that tree as the evidence for these corrections:

- the timer seeded by a remote FIFO head stopped when that exact Fire became
  terminal. A crash between terminal commit and the owner's process-local
  `enqueueNextFireForJob` therefore left the successor pending with no recovery
  owner;
- the anti-join query returned only 64 heads but still walked all retained
  terminal Fires to find each one. The test explained a handwritten similar
  query rather than the exact production statement and used only four terminal
  rows per definition.

The correction keeps the same immutable facts and no head table. It adds the
definition-local queue relation and terminal-frontier indexes described above,
uses one exported SQL statement for both production and `EXPLAIN QUERY PLAN`,
and adds a positive remote-terminal crash cut plus deep retained-history
fixture. The old snapshot is not a delivery candidate, but neither its green
evidence nor another agent's delivered work is reopened.

#### Correction verification before repeated review

The corrected non-UI matrix reaches its natural terminal result with 65/65
tests and 250 assertions across nine files. `event-current-frontier` contributes
6/6 tests and 29 assertions. Its retained-history fixture keeps 1,024 terminal
Fires before one head, and `EXPLAIN QUERY PLAN` runs the exported production
head statement itself: it seeks `event_job_fire_terminal_frontier_idx` and
`event_job_fire_definition_frontier_idx` and uses no temporary B-tree. The
terminal crash cut arms recovery for a remote-owned head, commits its terminal
receipt and lease release, omits the owner's handoff, and proves that the
surviving timer rereads the definition frontier and executes only the
successor. A separate causal-cycle case proves that an admission disposition
cannot terminalize ahead of its older FIFO head. The 65-definition multipage
recovery now completes both same-definition Fires without a second explicit
recovery sweep.

OpenCorvus package typecheck exits zero and root typecheck passes all eight
workspace tasks. Docs pass at 339 operations / 25 groups, routes at 6 rules /
34 files, architecture at 16 current documents, package topology at ten
workspaces, control leases at 18 owners / 22 acquisition sites, control-state
redundancy at 51 tables / seven allowed fact classes, version alignment at
`0.0.58-beta`, and public-package publication order is clean. Exact staged tree
`336827bdcad32db116106c882b644ca71f776c5a` passes release mutation with five
canonical authorities and module topology with 1,102 modules, 5,523 runtime
edges, no retained strongly connected component and four clean imports.

The staged closure contains fourteen owned Event/schema/test/document paths.
The pre-existing `session/index.ts` formatting delta and two Web content files
remain working-only with zero cached intersection. This evidence update creates
the next exact review tree; it receives the same diff, docs, release and module
checks before a fresh uninvolved read-only review.

#### Repeated-review transfer and disposition corrections

The uninvolved review of exact tree
`76fabc03cade92563dfc2715aea764305f1fd2de` confirmed the definition-frontier
timer and indexed point-seek corrections, then found two remaining current
contract gaps. The canonical MySQL transfer table order restores Event receipts
and Fires before their referenced Event definitions and target Sessions, while
the new live insert triggers were not part of the existing validated snapshot
restore boundary. A strict current snapshot containing Event history therefore
could not be replayed. Separately, a Fire could persist both a terminal Mission
reservation and `causal_cycle`; runtime disposition precedence selected the
cycle even though the immutable Mission authority requires the exact
`mission_closed` receipt.

The correction reuses the existing validated creation-fact restore primitive:
all four Event creation-order triggers are deferred only inside the transfer
transaction, a complete set-based validator proves definition/queue authority,
Mission reservation ownership, receipt/Fire identity, contiguous terminal FIFO
positions and terminal Mission receipt equivalence, and the current triggers
are restored before commit. No alternate insertion order, fallback reader or
transfer-only repair is introduced. The same Mission receipt equivalence is
enforced by the live receipt trigger. Runtime processing gives the already
frozen terminal Mission reservation precedence over causal-cycle disposition.

Positive acceptance must round-trip a strict current snapshot containing a
definition, occurrence, queued Fires, retry and terminal receipts, plus an
actual Mission-target Fire, then reproduce the exact immutable rows after
import. A separate FIFO case must place a closed-Mission causal-cycle successor
behind an older head and prove that it settles once, at its queue position, as
`mission_closed` with the frozen closure event. Mutated transfer snapshots must
fail typed preflight when either frontier or Mission receipt authority diverges.

The corrected nine-file affected matrix reaches its natural terminal result
with 78/78 tests and 272 assertions. The two new production-shaped contracts
pass independently: a real closed Mission produces two accepted FIFO Fires,
the causal-cycle successor reaches queue position two and both settle against
the one frozen closure event; a second case writes a closed-Mission Fire and a
separate Event Fire with retry plus success receipts, preflights and imports the
strict current MySQL snapshot, and reproduces all Event tables byte-for-byte.
Typed divergent-frontier and divergent-Mission snapshot inputs are rejected by
the same preflight transaction before database replacement.

OpenCorvus package typecheck exits zero and root typecheck passes all eight
workspace tasks. Docs pass at 339 operations / 25 groups, routes at 6 rules /
34 files, architecture at 16 current documents, package topology at ten
workspaces, control leases at 18 owners / 22 acquisition sites, control-state
redundancy at 51 tables / seven allowed fact classes, version alignment remains
`0.0.58-beta`, and public-package publication order is clean. Pre-evidence
exact staged tree `2513c3eb2d8a369f2e51e95a471578df5e16965e` passes release mutation
with five canonical authorities and module topology with 1,102 modules, 5,523
runtime edges, no retained strongly connected component and four clean
imports. The evidence paragraph alone changes the next review tree; code,
tests and all three working-only exclusions remain otherwise frozen.

The uninvolved final review of exact tree
`5b3e766d8e6365cabcdde08898fc85dbae6a0e41` returns FINAL PASS with P0-P3 all
zero. The reviewer independently reproduced 37/37 core tests with 163
assertions, OpenCorvus and root typecheck, docs/routes/architecture/control/
package/release/publication checks, and exact-index module topology. It
confirmed that preflight and apply share the one transactional restore path,
all five deferred triggers are restored before commit, validator or restore
failure rolls back without repair, the live closed-Mission receipt trigger is
fail-closed, and both new production-shaped cases exercise the actual runtime
and database replacement boundaries. This review record is documentation only;
the reviewed production and test blobs remain unchanged.

### Cut 8b.3 — B9 Automation bounded due-Fire frontier

#### Recall and current-source proof

- **User requirement:** close the final scheduling ledger gap without delaying
  another delivered cut, then push, run an exact-remote real Mission trajectory
  and continue repairing every observed anomaly before the three-component beta
  and website release.
- **Observable trigger:** the one-second Automation poll calls
  `currentAutomationFrontiersInTransaction({ status: "active" })`. That helper
  pages definitions in groups of 64 but deliberately exhausts every page, loads
  five fact sets for every definition and only then filters `next_run <= now` in
  JavaScript. Runtime work is therefore proportional to all active definitions,
  even when no Automation is due.
- **Root cause:** a recurring scheduled Fire is created only after claim. The
  existing `automation_fire_due_idx` cannot discover work that has no Fire row,
  so the definition projection and recurrence calculation have become a second
  global due queue. Increasing the page size, caching projections or adding a
  mutable current-state table would preserve that duplicate authority.
- **Old-path limitation:** Cut 5 correctly bounded each definition page and the
  Session-specific one-shot delay frontier, but it did not change the global
  selection source. Its fixed five query stages prove bounded work *per page*,
  not bounded due discovery across the database.
- **Sources searched:** Automation definition/Fire/run/attempt/receipt tables,
  full and frontier reducers, create/update/delete/manual run, poll/claim,
  retry/terminal/Mission-close settlement, Session delay consumption, current
  schema DDL/transfer, claim/fire identity tests and current architecture.
- **Independent feedback:** none at implementation start. A fresh uninvolved
  read-only review is mandatory after the exact tree and complete evidence are
  frozen.

#### Single-authority design

1. Every active recurring definition revision owns exactly one immutable
   pristine `scheduled` Fire for its next recurrence. Create, active update and
   resume insert it in the same definition transaction. Terminal settlement of
   that scheduled Fire inserts its successor in the same transaction as the
   terminal run/attempt receipts and lease release. Retry keeps the same Fire;
   manual Fires never advance or replace the scheduled recurrence.
2. Scheduled Fire identity binds both immutable revision ID and exact due time.
   A later revision may legitimately choose the same timestamp but cannot reuse
   the older revision's occurrence. Paused revisions and tombstones have no live
   due authority; their historical Fires remain immutable history.
3. A pristine Fire is a distinct `scheduled` state: it is not running, does not
   block update/delete/manual run, and is never exposed as `pending_fire_id`.
   Current projection separately identifies the latest executed Fire for public
   history and the current revision's scheduled Fire for `next_run`; ordering a
   manual Fire and a future scheduled Fire by timestamp is not a state reducer.
4. Global poll starts at the Fire due index and returns at most one 64-row page
   of current active recurring candidates whose effective deadline is due and
   whose latest lease is absent or expired. Retry deadlines come only from the
   latest attempt/run receipts of that exact Fire. It does not enumerate future
   definitions, terminal Fire history or unrelated Session delays.
5. Exact claim receives the selected Fire identity and revalidates, in one
   immediate transaction, current revision, active recurring status, scheduled
   origin, effective deadline, lease and Session-busy authority before reserving
   an attempt. The claim does not synthesize a missing scheduled Fire. Manual
   API/Tool claims retain their separate immutable Fire occurrences.
6. Session one-shot delay discovery and its transaction-local consume callback
   remain unchanged. No compatibility reader, fallback, mutable frontier table,
   process-local shadow set or second recurrence calculator is added.
7. The latest physical attempt is a single indexed point lookup. Public history
   may still reduce complete history on explicit reads; heartbeat discovery may
   not.

#### Positive acceptance matrix

- create, update, pause/resume and terminal settlement expose exactly one current
  pristine scheduled Fire, with revision-bound deterministic identity;
- a manual run earlier or later than the scheduled due time leaves the scheduled
  occurrence and recurrence frontier unchanged;
- retry reuses the same Fire and becomes due only at its exact retry deadline;
  success, terminal failure, partial fan-out and Mission-closed settlement
  atomically publish one successor when the definition remains active;
- 257 future definitions plus more than one page of due definitions yield one
  bounded due page in stable due/Fire order, fixed query stages and no duplicate
  or missing work across ticks; two Projects remain isolated;
- deep terminal history does not change the due query count or plan, and
  `EXPLAIN QUERY PLAN` uses the Fire due/revision and retry/lease indexes without
  a full Automation-definition scan;
- owner loss, expired lease, process restart and exact claim collision converge
  on the same Fire/attempt chain; abort after permit acquisition leaves the
  pristine scheduled Fire and no attempt or lease;
- current-schema DDL, strict transfer and retention preserve the new Fire-state
  contract; stale schema continues to fail through the existing reset boundary.

#### Working-source evidence before final freeze

The implementation publishes the first recurring scheduled Fire in the create
or active-revision transaction, publishes a successor with terminal scheduled
settlement, keeps manual and retry identities distinct, and drives the heartbeat
from a 64-row recurring Fire due page plus a 64-row one-shot delay due page. The
two pages are ordered into one 64-item execution frontier; exact claim still
owns the immediate revalidation. Public history and generated OpenAPI/SDK now
include the explicit pristine `scheduled` state.

The complete directly affected non-UI matrix passes 70/70 tests with 282
assertions: Automation claim/Fire identity 24/24, schedule Tool lost-response
recovery 8/8, native Task and Session delay waits 12/12, immutable scheduler
facts 2/2, scheduling DDL lineage 10/10, Mission wake projection 3/3 and current
schema/strict transfer 11/11. The 96-due/257-future positive case returns the
first exact 64 Fire identities through six fixed query stages and confirms the
Fire due index. The same page skips 96 earlier-base-due manual Fires whose exact
retry deadline is still future, and another production-path case proves a due
scheduled sibling yields to the one retrying manual Fire for that definition.
A real scheduled execution retains one attempted Fire and publishes one pristine
successor in its terminal transaction. A first combined
multi-file Bun run reached the known output-channel failure while waiting for
the Session-delay capacity case; isolating that case exposed a real omitted
delay frontier, not a runner-only failure. The correction adds the indexed
one-shot delay due page, after which the full Task/Session file passes 12/12 in
25.96 seconds.

OpenCorvus package typecheck and root typecheck pass, with all eight root
workspace tasks successful. Routes pass 6 rules across 34 files; generated API
documentation passes 339 operations across 25 groups. Architecture indexes 16
current documents, package topology covers ten cycle-free workspaces, control
leases cover 18 owners and 22 acquisition sites, control-state redundancy
covers 51 tables and seven allowed fact classes, public-package publication is
ordered, and the three-component release family remains `0.0.58-beta`. Exact
index release/module/diff evidence and a fresh uninvolved review remain required
before commit.

The preserved pre-correction review snapshot
`7d5741b00bf751f673d490f0c308ae48c8f79b76`
passes release mutation with five canonical authorities and module topology with
1,102 modules, 5,523 runtime edges, no retained strongly connected component
and four clean imports. Cached and working diff checks pass; the working tree is
limited to the pre-existing `session/index.ts` formatting delta and two Web
content exclusions. This evidence paragraph changes only the review record; a
new exact tree and fresh uninvolved read-only review still gate commit.

#### First exact-tree review and architectural correction

The first uninvolved review of exact tree
`9fa42bee3cd684e886d1038393a42cd62ebb71fe` is **NOT PASS** with
P0=0, P1=3, P2=0 and P3=1. Its independently executed production query plans
prove that both recurring and one-shot delay SQL return at most 64 rows but
still scan retained terminal/future-retry history and allocate a temporary
ordering B-tree before that limit. It also proves a scheduled recurring owner
can die after terminal Mission/target receipts commit but before successor
publication, leaving no due fact that can restart the recurrence, and that
strict transfer accepts an active recurring definition after its sole scheduled
Fire is removed. The independently reproduced matrix is 70/70 with 280, not
282, assertions.

Those findings correct one premise in the initial design while preserving the
immutable Fire history. A global query cannot simultaneously retain an
unbounded immutable history, select only unresolved effective deadlines, and
perform work bounded independently of that history unless one indexed relation
owns the current physical delivery frontier. Correlated anti-joins and computed
retry deadlines only move the unbounded work behind a result-row limit. The
correction therefore introduces one domain-specific
`automation_fire_frontier` control relation instead of another business-state
projection:

1. Exactly one row per live Automation definition owns the one Fire currently
   eligible for physical delivery and its `available_at` fence. Immutable
   definition, Fire, attempt, run and receipt rows remain the complete business
   history; heartbeat selection no longer reduces them.
2. Definition acceptance or active revision, manual occurrence admission,
   retry, lease acquisition/renewal, terminal settlement, pause/tombstone and
   successor publication update that one relation in the same immediate writer
   transaction as the fact that changes delivery authority. The relation is the
   sole scheduling source, not a cache reconciled after commit.
3. Scheduled success or terminal failure replaces the current row with the
   successor Fire atomically. A manual terminal occurrence restores the
   already-published scheduled Fire. A one-shot delay terminal or ordinary
   Session-input settlement removes the row. Terminal-at-reservation therefore
   cannot commit without either a successor or a closed one-shot frontier.
4. Claim and renewal move `available_at` to the exact lease expiry; retry moves
   it to the immutable retry deadline. Poll is one indexed
   `(available_at,definition_id,fire_id)` LIMIT page with no history scan or
   temporary ordering tree, and exact claim still revalidates current revision,
   Fire and lease under the writer lock.
5. Current-schema DDL and strict transfer require every current active
   definition to own exactly one structurally valid frontier and every paused or
   tombstoned definition to own none. Missing Fire/frontier, wrong revision,
   stale definition or terminal pointed Fire is a typed transfer validation
   failure. There is no compatibility reader, fallback or second due selector.

Positive correction evidence must cover the complete production SQL plan,
257 retained terminal Fires, at least 96 future retries, more than one due page,
scheduled terminal-reservation crash closure, manual-to-scheduled restoration,
one-shot input settlement, cross-process lease takeover and strict transfer with
both a valid frontier and each structurally invalid variant. A fresh exact tree,
the complete affected matrix and a new uninvolved read-only review are mandatory
before delivery.

#### Architectural-correction first-green evidence

The directly affected matrix now passes 84/84 tests with 325 assertions across
nine files. It includes the production indexed frontier plan, retained terminal
and future-retry history, atomic scheduled successor publication, manual Fire
restoration, one-shot Session settlement, strict transfer shape and terminal
Fire rejection, and a real two-process busy-Session lease takeover. The latter
proves the first poll retains the exact scheduled occurrence without an attempt,
then the expired physical owner converges on one attempted Fire, one successful
receipt and one exact scheduled successor. This is first-green source evidence,
not a delivery receipt. OpenCorvus/root typecheck passes all eight workspace
tasks; docs pass at 339 operations/25 groups, routes at 6 rules/34 files,
architecture at 16 current documents, package topology at ten workspaces,
control state at 52 tables/seven fact classes, leases at 18 owners/22 acquire
sites, version alignment at `0.0.58-beta`, and public-package publication order
is clean. An exact new index tree and fresh uninvolved read-only review still
gate commit and push.

#### Final-review authority-equivalence corrections

The next uninvolved review found no P0 or P1 and two P2 gaps between live DDL
and strict transfer. Transfer proved the attempt's historical lease identity and
ordering but omitted the live admission condition `lease.expires_at >
attempt.time_created`. Live frontier insert/update proved current revision and
deadline shape but did not reject a Fire whose run or latest zero-run attempt
was already terminal.

The correction makes transfer apply the same lease-expiry predicate as live
attempt admission. Frontier insert/update now applies the same pending-Fire
reducer as transfer. The reverse edge is fenced too: the last terminal run or
zero-run attempt receipt cannot commit while that Fire still owns the frontier.
Production settlement transactions therefore advance, restore or clear the
frontier before their terminal receipts; retry receipts retain the same Fire and
deadline. This preserves one committed delivery authority without a second
state table or post-commit reconciliation.

The corrected nine-file matrix passes 84/84 tests with 328 assertions. New
positive contracts reject an attempt whose exact historical lease expires at
its creation time, reject insertion of a terminal Fire as the live frontier,
and reject terminal receipt settlement until the frontier has advanced. The
existing scheduled/manual/retry/one-shot/Mission/cross-process and strict
transfer paths all continue to pass. A new exact tree and fresh read-only review
still gate delivery.

#### Strict-transfer admission and Mission-reservation correction

Fresh review confirmed the terminal-frontier equivalence correction, then found
two P1 restore gaps. The attempt validator compared admission time with the
lease row's *final* mutable expiry. Normal same-millisecond terminal reservation
shortens that row to the attempt timestamp, so a legal production snapshot was
rejected even though the lease was live when the attempt was admitted. Separately,
`automation_run_mission_reservation_insert` executed before transfer had restored
the Automation definition and Mission Session, so any legal run carrying an
opened or closed Mission reservation was rejected by restore ordering.

The selected single-source correction freezes the exact `lease_id`,
`lease_grant_ordinal`, and `lease_expires_at` on the immutable physical attempt at admission. Acquisition
and renewal append an immutable ordered lease-grant fact; live DDL requires the
attempt grant ordinal and expiry to equal the latest grant of the current owner selected by the
same `(time_activated,id)` order as the production reducer. The attempt retains
its lease and grant by foreign key. Transfer validates the exact grant while permitting
the lease row's final mutable expiry to equal its later release boundary; it
does not reinterpret an already-admitted historical attempt against a later
same-millisecond lease. This is current-schema grant history, not a legacy
compatibility inference.
Automation Mission reservation insertion joins the existing
validated-restore protocol: its live trigger is temporarily deferred only
during restore, then one set-based validator checks every restored run against
its fully restored definition, exact same-Session opened/closure Protocol Event
and, for terminal-at-reservation runs, its one exact `mission_closed` receipt.
The live run and receipt triggers enforce the same causal union before all
current triggers are reinstalled and the transaction may commit.

Positive evidence must round-trip an unchanged real terminal-at-reservation
snapshot whose release time equals attempt creation time, preserve active and
terminal Mission reservation shapes, reject a forged frozen admission expiry,
and prove validator/restore failure rolls back without replacing the current
database. A new exact tree and fresh read-only review remain mandatory.

The previous correction snapshot's exact nine-file serial matrix passed 73/73
tests with 302 assertions, including `storage/schema-contract.test.ts`. Its
directly runnable command was:

```powershell
bun test --max-concurrency 1 test/scheduler-claim-and-fire-identity.test.ts test/scheduler-tool-recovery.test.ts test/task-wait-fire-identity.test.ts test/task-wait-current-prompt.test.ts test/scheduler-fact-control.test.ts test/scheduling-occurrence-ddl-lineage.test.ts test/mission-execution-wake-occurrence.test.ts test/scheduler-busy-session-cross-process.test.ts test/storage/schema-contract.test.ts
```

The final-review correction keeps that exact command and adds positive contracts
for same-ms current-lease ordering, retention of an earlier legal attempt, exact
immutable grant ordinal/expiry, active and terminal Mission event authority,
terminal receipt equivalence, persistent transfer apply, and rollback with
trigger restoration.

That exact command now reaches its natural terminal result with 75/75 tests,
323 assertions and zero failures in 136.26 seconds. The four correction-focused
contracts pass independently with 4/4 tests and 34 assertions. OpenCorvus
package typecheck exits zero after the final source and test changes.

The historical snapshot round-tripped the real closed-Mission
terminal-at-reservation snapshot after the lease row had been released to the
attempt timestamp, rejected one forged frozen attempt expiry, and retained the
existing current-schema rollback test.
The matrix also exposed two fixture defects rather than weakening validation:
a 2099 claim followed by a 2026 release created an impossible reversed clock,
and bulk query-plan fixtures left active definitions without their mandatory
frontier after Project cleanup. The fixtures now use real elapsed time and
append exact tombstones after their assertions. Manual/scheduled identity uses
the manual execution hook rather than the scheduled-only hook and proves the
already-published scheduled sibling remains claimable. Bun's default test
concurrency is deliberately not used for these shared global Database/Instance
fixtures; the authoritative command fixes concurrency at one. Static gates, a
new exact tree and a fresh uninvolved read-only review still gate delivery.

Post-correction static evidence is green: OpenCorvus package typecheck exits
zero and root typecheck passes all eight workspace tasks; docs report 339
operations/25 groups, routes 6 rules/34 files, architecture 16 current
documents, package topology ten cycle-free workspaces, control state 53 tables
across seven fact classes, and control leases 18 owners/22 acquire sites.
Public-package publication order passes and the three-component release family
remains `0.0.58-beta`. Exact-index release/module/diff evidence and independent
review remain the final pre-commit gates.

The final-review correction is re-staged across 23 owned paths; the immutable
tree identity is recorded in the external review receipt rather than in the
tree itself. Its release gate reports five canonical mutation authorities and module topology reports
1,103 modules, 5,529 runtime edges, no retained SCC and four clean imports.
Cached and working diff checks pass with zero intersection; the only working
paths are the pre-existing `session/index.ts` formatting delta and two Web
content exclusions. A fresh uninvolved review of this exact tree remains the
only pre-commit gate.

#### Lease-grant ordinal final-review correction

The next exact-tree review confirmed the Mission reservation union, attempt-to-
lease retention and same-millisecond current-lease ordering, then found one P1
and two P2 closure gaps. Strict transfer could still accept an attempt that
selected an older grant from the same lease when a later renewal grant had
already committed before that attempt. The new grant table was absent from the
control-state inventory, and the recorded verification command split its ninth
file into prose while incorrectly describing the preceding 73-test count.

The single-source correction adds `lease_grant_ordinal` to the immutable attempt
and binds `(lease_id, lease_grant_ordinal)` to the retained grant by composite
foreign key. The production writer freezes the current latest ordinal and
expiry in one transaction; live DDL requires that exact latest grant. Strict
transfer requires the same ordinal/expiry and rejects any later ordinal whose
grant was already visible before attempt creation, while a renewal appended
after the attempt remains valid history. The positive test executes both orders
and mutates the accepted transfer snapshot back to the superseded grant to prove
rejection. `EngineControlActivationLeaseGrantTable` is now an explicit
control-state fact inventory entry, so the checker directly covers all 53
tables/seven fact classes. The exact nine-file command above is the sole final
matrix command and its 73-test historical attribution now includes the schema
contract honestly.

Post-correction evidence is 27/27 tests and 112 assertions for the full
Automation identity file, 4/4 and 34 assertions for the authority-focused set,
and 75/75 with 323 assertions for the exact nine-file serial matrix. OpenCorvus
package typecheck exits zero and the control-state checker reports 53 tables
across seven allowed fact classes. Root typecheck passes all eight workspaces;
docs, routes, architecture, package topology, control-lease ownership, public
package order, and `0.0.58-beta` version alignment all pass. The exact-index
release gate reports five canonical authorities and module topology reports
1,103 modules, 5,530 runtime edges, no retained SCC and four clean imports.
Cached/working diff checks remain clean with only the three declared working
exclusions. A fresh uninvolved zero-finding review is the only remaining
pre-commit gate.

### Exact-remote Mission duplex acceptance after Cut 8

#### Recall

- The user requires the complete scheduling remediation to be pushed first,
  followed by a real end-to-end Mission run whose complete scheduling
  trajectory is inspected. A release may proceed only when that trajectory is
  free of unexplained duplication, stale authority, missing delivery, or
  unbounded scheduler churn.
- The run must use the exact pushed tree, an isolated runtime and Project, the
  configured Provider credential plus its matching model catalog, and the
  actual requested model. Credential contents must never enter logs, this
  record, or a commit.
- The working tree still contains the three declared exclusions. They must not
  influence the exact-remote source snapshot or enter this correction.
- Current protocol storage keeps immutable inbox ingress, immutable delivery
  receipts, and control leases as separate facts. Public delivery status and
  result are produced only by `projectProtocolDeliveryInTransaction`.
  Current Task lifecycle is likewise reduced by `projectTaskRowsInTransaction`;
  raw `engine_task` rows no longer contain terminal timestamps.
- Full-repository search found that
  `check-mission-task-duplex-e2e.ts` still read `status`, `delivery_result`, and
  `time_completed` directly from those raw rows. On the exact pushed
  `cd7904714395e34a38f9d21434ba70123c8e19b5` snapshot, this made the delivered
  count permanently zero and made terminal Task detection impossible. The
  model continued making progress-shaped Message/Part writes, so the old
  inactivity clock was renewed indefinitely even though the checker could
  never accept the run.
- The retained isolated run used `openai/gpt-5.6-sol`, created exactly two
  Mission child Tasks, and persisted nine scheduler-message events before it
  was stopped after this checker defect was proven. Its ordinary Message/Part
  chatter had reached 79/251 and the Mission had exceeded one hundred Tool
  calls; this evidence is diagnostic, not a product pass or failure.
- Independent agent feedback before implementation: none. A fresh uninvolved
  read-only review is required after the correction and focused verification.

#### Correction and acceptance boundary

The checker will obtain Task and delivery state through the same current
projection functions as production readers. One small snapshot helper owns
that composition so the real checker and its focused test cannot silently drift
back to raw-row shadow state.

The three-minute inactivity budget will be renewed only by semantic acceptance
progress: a new exact Mission Task, scheduler-message event, terminal delivery
projection, or terminal Task lifecycle projection. Message and Part counts
remain visible diagnostics but cannot extend the run. A separate absolute run
deadline bounds a scenario that keeps producing irrelevant or duplicate
protocol facts. Neither boundary changes production scheduling or teaches the
model a workflow; they only make the external acceptance fail closed with a
retained database for diagnosis.

Positive verification must prove that one current raw Task plus lifecycle facts
projects a terminal timestamp, one immutable inbox plus terminal receipt
projects a delivered result, and Message/Part-only count changes leave the
semantic progress key unchanged. Then the exact pushed source must be rebuilt,
the real Provider run repeated, and its retained database audited for the full
ten-message duplex chain, two terminal notifications, exact correlation and
ordering, duplicate/extra occurrences, waits, ownership/lease settlement,
errors, and per-role usage. Any confirmed product anomaly is repaired and the
fresh exact-remote run repeated before release.

#### Retained-run scheduling finding

The retained database proves a separate product-level latency fault after the
checker drift is removed. The nine scheduler-message events were unique and in
the required semantic order through A's `DECISION` request. Seven earlier
inboxes reached one terminal receipt each. B's `B_DONE` notification waited
about 137 seconds for the Mission Session, while the later Task-terminal
notification and `DECISION` request were still pending when the diagnostic run
was stopped.

The Mission Tool facts explain that delay. Every scheduler wake began a new
revision-zero capability occurrence, then the Mission obeyed the global
"On every wake" checklist: it re-read `frontier.md`, `handoff.md`, and
`tasks.md`, listed Tasks, queried Tasks, and frequently re-read other Mission
state before ending the Turn. A direct scheduler request therefore competed
with broad ordinary reconciliation, and even an informational notification
kept the Session busy long enough to block the next durable inbox. This is a
Prompt contract conflict, not missing persistence or duplicate delivery.

The production correction remains inside the allowed LLM interaction surface.
The Mission Prompt will distinguish ordinary operator/lifecycle wakes from a
visible scheduler Message. A scheduler request must use its first
`capability_search` to activate the canonical `scheduler_message` Tool ref,
read only an exact fact indispensable to the answer, send the correlated reply,
and end that response immediately. A notification uses the visible immutable
fact directly; when it changes no stage/ready-frontier fact it ends the Turn.
When it does change one, the same wake completes only that fact's exact causal
closure: terminal acceptance reads the exact Task and required canonical
Artifacts, updates the exact stale Mission-state file, and performs every
newly-ready dispatch or exact-Task recovery made due by that fact. When that
acceptance makes final completion due, the same bounded closure publishes the
final Artifact, re-queries the complete current child set, binds every accepted
Task's current-Turn evidence and calls `panel_complete_mission`. It never runs
the unconditional full-wake checklist.
This changes no Host routing, Tool selection, delivery authority, or hidden
state and adds no special-case gate. The Prompt contract test records this
positive model contract; the fresh real-provider trajectory must now prove both
the duplex chain and terminal Task acceptance through durable Mission
completion.

#### First exact-tree review and correction

The uninvolved review of exact tree
`8fdf5d1a4dbaeaa84765cbcff317c443166394e3` returned P0=0, P1=2,
P2=1 and P3=0. The checker projection and bounded-progress implementation were
confirmed correct. The first P1 showed that "reply before reconciliation"
still permitted broad work after the reply while the production inbox drain
waited for the entire assistant response. The second showed that ending a
terminal wake immediately after its state write could strand a newly-ready
consumer or final Mission completion because no later ordinary wake is
guaranteed. The P2 identified that the first Prompt test and communication-only
real scenario could not detect either regression.

The accepted correction makes a completed correlated reply the immediate
durable stop of a scheduler-request response. A terminal notification instead
owns one bounded causal closure: exact Task and evidence reconciliation, exact
state update, and the newly due dispatch, recovery, or Mission completion before
the response stops. The real duplex acceptance now requires both terminal Task
results to be accepted and a `panel_complete_mission` durable completion fact;
communication success alone cannot pass. Focused verification, exact staging,
and a fresh uninvolved review remain required before delivery.

The next exact-tree review confirmed the request-reply durable stop and ordinary
terminal causal closure, then found one P1 and one P2 in the final-completion
branch. Production `panel_complete_mission` requires the complete current child
set plus each Task's query and evidence-read references from the same physical
Turn, while the first correction still said to query only the notifying Task.
The corrected completion branch explicitly performs that production preflight
inside the same causal closure, and the positive Prompt contract binds the
complete-set/current-Turn requirement. The real Provider run must pass the
actual Host preflight; static Prompt evidence cannot substitute for it.

#### Exact-remote completion-reveal failure

The first exact-remote run after commit
`acdb3e6adb09b43471c454d1d921372d0f93a929` used an isolated archive of that
commit, the separately verified configured Provider credential and model
catalog, and the requested `openai/gpt-5.6-sol` model. Its source archive digest
was `7E9E77BABF4D83BD19076CE9C405D57B90938645F23B745BF22AD9EDC9F34FD9`.
The retained database proves that the scheduling plane itself completed the
intended chain: exactly two child Tasks were created in the required order;
all ten authored duplex messages plus both terminal notifications were unique;
all inboxes and terminal receipts settled; all three request/reply pairs were
correlated; recipient FIFO, endpoint authority, semantic order and
DONE-before-terminal order passed; both Tasks completed normally; and the
Mission wrote the required post-A_DONE acknowledgement. The run nevertheless
failed after three minutes without semantic progress because the Mission never
published its final Artifact or committed `panel_complete_mission`. At the
failure boundary the checker reported two terminal Tasks, twelve scheduler
events, twelve terminal deliveries, 104 Mission assistant Messages and 323
Mission Parts.

The exact Tool facts locate the direct trigger. Final completion requires the
Mission to publish, re-query the child set and exact Task evidence, then close
the Mission in one physical response. The model first tried to activate four
exact leaves together and received the expected aggregate budget error. It then
successfully revealed the query/read leaves one group at a time, accepted both
Tasks from canonical Completion Decisions, and attempted the final publication
sequence. Activating `publish_interactive_artifact` by itself still produced a
34,039-character Provider Tool payload against the immutable 32,000-character
occurrence budget. Repeated exact attempts could never commit a reveal receipt;
after deactivating the query leaves the occurrence therefore contained only
`capability_search`, and the model generated search-only Turns until the
semantic inactivity boundary stopped the run. Two aggregate reveal attempts
also exceeded the limit, but they are not the root because the single exact
publication leaf is independently impossible to activate.

This is a search-native Tool ABI defect, not a scheduler delivery, persistence,
Mission-state or Provider-capability failure. The current budget test proves
only that each leaf definition is individually no larger than 32,000
characters; it omits the permanent `capability_search` base that the reducer
always counts. The interactive publication leaf exposes one discriminated
union containing nineteen renderer payloads and repeats the common
`schemaVersion`, `title` and `presentation` fields in every JSON Schema branch.
That projection violates the current architecture's requirement that any exact
leaf fit beside the permanent base. Prompt wording cannot make an impossible
leaf executable, and raising the shared limit would remove the bounded Harness
contract rather than fix the leaf.

The same retained database exposed one remaining checker projection drift.
Every scheduler-message source Tool has an immutable request and terminal
outcome, but `allSourceToolsCompleted` searched the legacy `part` table for a
mutable completed Tool state. Current DDL excludes Tool requests from that
table; their visible state is produced only by
`projectToolPartInTransaction`. The acceptance helper will therefore project
the exact `tool_part_request` rows with their outcome facts and the checker will
compare the authored chain against those canonical visible Tool Parts. A
focused positive fact-storage test must prove the projected completed
scheduler Tool together with terminal Task and delivery projections.

Three recoverable model mistakes are also visible and must not be accepted as
a clean trajectory. Both Task schedulers first copied scheduler Protocol event
IDs into `coordination_request` completion evidence before correcting to their
own Session evidence. Initiator A also tried a scheduled `wait` after its peer
request, although the durably delivered request already assigned the future
reply to another scheduler and the reply ingress itself owns the wake. During
the first terminal reconciliation, Mission twice supplied the notification
event ID as a Task terminal reference before calling `panel_query_task` and
using its returned canonical reference. These are discoverability conflicts in
the participant Prompts, not reasons for a Host keyword gate. Orchestrator
guidance will bind scheduler-conversation completion evidence to the current
Orchestrator Session, reserve `coordination_request` for an actual
`agent_coordination_request` Artifact, and use `no_action` rather than `wait`
after a delivered outbound scheduler request. Mission terminal-notification
guidance will require `panel_query_task` first and carry only its returned
`terminal_lifecycle_reference` into Artifact enumeration. The next exact run
must contain no failed Tool occurrence from any of these paths.

The correction keeps one canonical persistence schema and one public action.
Its Provider input schema is a derived factored projection: the shared base is
declared once, the nineteen renderer-specific shapes remain a discriminated
union, and the projection delegates every refinement to
`PublishableInteractiveArtifactPayload` before execution. Persistence still
parses the same canonical payload; no generic JSON escape hatch, compatibility
reader, fallback or second artifact contract is added. The capability budget
matrix must normalize every projectable exact built-in leaf for the strict
OpenAI ABI and prove that `capability_search + one exact leaf` fits both the
32,000-character and 8,000-token limits. Focused artifact tests must also prove
one valid document publication input and a cross-field-invalid payload against
the canonical refinements. Mission final-completion guidance will activate and
invoke one exact final-preflight leaf at a time, explicitly deactivating a leaf
after its result is durable before revealing the next; all steps still remain
inside the same physical response and use the same append-only reveal receipts.
After focused/typecheck/checker verification and an uninvolved zero-finding
review, a new exact pushed snapshot must repeat the real duplex run to durable
Mission completion before release.

The pre-review correction candidate passed the five-file focused matrix with
10 tests and 35 assertions, OpenCorvus package typecheck, root typecheck across
all eight workspaces, documentation validation with 339 operations and 25
groups, route validation with six rules across 34 files, the 16-document
current-architecture index, the ten-workspace package topology, control-state
validation with 53 tables and seven allowed fact classes, and control-lease
validation with 18 owners and 22 acquisition sites. Its exact index tree also
passed release-mutation topology with five canonical authorities and module
topology with 1,103 modules, 5,530 runtime edges, no retained strongly
connected component, and four clean-import boundaries. These checks establish
the review input only; delivery still requires an uninvolved zero-finding
review, commit and push, followed by a fresh exact-remote Provider run from the
new pushed source.

The first uninvolved review reproduced three release-blocking gaps. Joining
two separately closed JSON Schema objects with `allOf` made the compact Tool
schema unsatisfiable for both OpenAI and Anthropic even though local Zod parsing
succeeded. The first projection also stripped unknown properties before the
canonical strict validator could inspect the submitted input. Finally, the
duplex checker recorded usage only as diagnostics and checked completed child
Task hydration, but it did not require the completion-Message-owned final
interactive Artifact or the Mission and both Task scheduler usage owners.

The corrected Provider contract is one closed envelope containing the common
fields once and one closed discriminated `content` union. Execution flattens
that accepted projection exactly once and parses it with the sole canonical
`PublishableInteractiveArtifactPayload` before persistence. A production-shape
test now obtains the actual OpenAI and Anthropic schemas through
`SessionLoop.prepareProviderTool` and validates a document instance with the
matching draft-07 validator; strict unknown-property and canonical cross-field
error contracts are also covered. The duplex acceptance state now requires
exactly one canonical interactive Artifact owned by the Mission completion
Message and containing the run nonce. It also requires non-empty usage for the
Mission Session under `mission` and for each exact child Task scheduler Session
under `orchestrator`; only those exact Session rows contribute to reported
per-role usage. Completion, Artifact and usage therefore form one PASS gate.

After these corrections the five-file focused matrix passed 13 tests and 42
assertions, OpenCorvus package typecheck passed, root typecheck passed all eight
workspaces, and documentation, route, architecture-index and package-topology
checks remained green. A fresh exact tree, its topology checks and a new
uninvolved zero-finding review remain required before delivery.

The next uninvolved review confirmed that the Provider schema, canonical
validation and final Artifact/usage gate were closed, then found one remaining
production ABI conflict: shared Chat/Work examples and seven shipped Expert
Squad writer Prompts still described the former flat renderer fields. The
runtime Tool schema correctly rejected those examples, so shipping both would
teach models an impossible call even though the revealed schema was valid.
No compatibility reader was added. The shared examples and every explicit
shipped invocation instruction now keep `schemaVersion`, `title` and optional
`presentation` under `artifact`, and place renderer-specific fields under the
strict `artifact.content` union. The Prompt test parses both shared example JSON
values through the current Tool parameters. Expert package content revisions
and the embedded payload were regenerated from the same source bytes.

The expanded Prompt, schema, budget and seven affected Expert Squad package
matrix passed 28 tests and 235 assertions; the Expert Squad TypeScript check
and the 121-manifest/133-workflow topology check also passed. Full typecheck,
repository gates, a newly frozen exact tree and another uninvolved review remain
required before commit.

The final pre-review source passed the complete affected Mission/schema matrix
with 13 tests and 42 assertions and the expanded Prompt/Expert Squad matrix
with 28 tests and 235 assertions. Root typecheck passed all eight workspaces.
Documentation remained at 339 operations and 25 groups; routes passed six
rules across 34 files; the current architecture index covered 16 documents;
package topology covered ten workspaces; Expert Squad topology covered 121
manifests and 133 workflows; control-state and lease checks covered 53 tables,
seven allowed fact classes, 18 owners and 22 acquisition sites. Public package
ordering passed, release-family versions remained aligned at `0.0.58-beta`,
and exact-index module topology passed with 1,103 modules, 5,530 runtime edges,
no retained strongly connected component and four clean imports. The exact
tree still requires the mandated final uninvolved review before commit.

#### Exact-remote activity-deadline correction

Commit `f7f3bded4129576c3b9aefe7e29776af484e587b` passed the final
uninvolved review, the complete pre-push gate and was pushed with local and
remote divergence at zero. A fresh Git archive of that exact remote commit was
then run with the separately verified Provider credential, model catalog and
actual `openai/gpt-5.6-sol` request. The archive SHA-256 was
`AC887F1EA74161896FA423CBA0313F012AD400F1AC9958213FE68DBA1C9BC548`.
The retained run database is under
`opencorvus-mission-task-duplex-e2e-6SquWV` and contains no production user
data.

The scheduling contract itself reached its complete ten-message business
chain: exactly two Tasks existed, all ten authored messages were delivered,
every source Tool had a terminal outcome, all three request/reply correlations,
exact endpoints, recipient FIFO and semantic ordering passed, the Mission
acknowledged `A_DONE`, and Task B completed. Task A then dispatched the
canonical Base planner to publish its required evidence plan. The planner
remained observably live: it completed 21 real Tool calls, enumerated and fully
read the eight current same-Task Engine Artifacts, selected the material
authority facts, reread the immutable Task request and stated that authority
closure was complete with no planning blocker. It was processing the next
Provider turn when the checker closed the runtime.

The direct cause is in the checker deadline reducer, not the production
scheduler or Provider. `INACTIVITY_MS` is documented and reported as an
activity boundary, and the checker already calculates a durable activity key
from Task, scheduler event, delivered inbox, Message and canonical Part/Tool
facts. However, only the much coarser milestone progress key renewed the
deadline. Message, Part and completed Tool facts were printed as activity but
could not extend the three-minute window, so a legitimate evidence worker was
terminated while continuously progressing. Raising the timeout or removing the
absolute bound would hide the defect. The single correction is to renew the
inactivity deadline only when the durable activity key changes, while retaining
the immutable fifteen-minute absolute deadline. An unchanged key never renews
the boundary.

The correction will expose one pure deadline reducer beside the duplex snapshot
projection. Its positive contract proves initial observation, a stable cursor,
a later Message/Tool activity cursor, and the absolute-deadline cap. The real
checker will use that reducer and continue reporting the independent milestone
progress key only for diagnostics. After focused tests, typecheck and checker
gates, an uninvolved reviewer must inspect the exact staged tree. Only then may
the corrected checker be committed and pushed, followed by one fresh
exact-remote run. No production scheduling, Task, Mission, Artifact or Provider
contract changes are authorized by this correction.

The first uninvolved review of exact tree
`e31de039360f93143d198fac36f035f5373004af` identified one remaining
activity-source gap: a running Tool writes append-only progress to
`ToolPartProgress`, while the projected running Tool state carries only its
start time. The first positive test also exercised synthetic cursor strings
rather than the persisted production facts. The same bounded checker cut now
derives its cursor from the count and latest `(time, id)` frontier of canonical
Message and Part rows plus Tool request, progress and outcome rows. Its focused
positive test creates a real running Tool in the memory database, appends a
real progress row, proves the exact persisted progress frontier and observes
the resulting deadline renewal while retaining the absolute cap. This closes
the review findings without changing production scheduling behavior.

#### Exact-remote final-reconciliation failure

Commit `ae1f6fe1d877a4cb71db6dc34abb693c27407d73` passed the exact
checker review, pre-push gates and remote-divergence check. A fresh real
Provider run from that pushed source used `openai/gpt-5.6-sol` and retained its
failure database under
`mission-scheduling-ae1f6fe1d-20260903-084100/temp/opencorvus-mission-task-duplex-e2e-596LhT`.
The run is diagnostic rather than acceptance evidence because the optional
Browser MCP could not resolve its separately bundled source dependencies in
the isolated assembly and the Mission did not reach its durable completion
boundary before the immutable fifteen-minute cap.

The scheduling trajectory itself reached the complete intended frontier:
exactly two child Tasks, twelve scheduler events, twelve delivered inboxes,
all ten authored duplex messages plus both terminal notifications, exact
recipient FIFO and endpoints, three correlated replies, both normal Task
terminal states, the Mission acknowledgement after `A_DONE`, and both terminal
wake replies. The Mission nevertheless published no final interactive Artifact
and did not call `panel_complete_mission`. The final acceptance state was
`2:12:12:2:0`.

The retained canonical Tool facts identify four avoidable failures and one
checker projection error rather than an inactivity-boundary defect:

- `capability_search` accepted a model-supplied
  `expected_catalog_snapshot_hash` even though the Host already binds the exact
  occurrence Catalog snapshot. After the first Task changed the current
  occurrence snapshot, the model copied a historical hash and received a
  conflict. This field is a redundant identity authority; Tool-call replay is
  already bound by the exact call, Message, occurrence Harness and persisted
  reveal receipt.
- one Task scheduler attempted to deactivate `wait` when the active-set
  revision already excluded it. Deactivation is mathematical set subtraction;
  treating an absent member as an execution failure adds no integrity and makes
  the desired active set non-idempotent.
- Mission guidance and the Artifact-page Tool description alternated between
  the nonexistent `read_task_artifact` name and the actual
  `panel_read_task_artifact` leaf.
- `panel_query_task_artifacts` required the model to copy a raw
  `terminalEventID` that the Host had just returned. The model changed
  `pev_g0VU...` to `pev_g00VU...` three times, re-querying and re-revealing the
  same facts for roughly fifty seconds. The Host already has the exact earlier
  `panel_query_task` receipt in the same physical Turn and already uses that
  receipt as the sole terminal authority for `panel_complete_mission`.
- the checker required Orchestrator usage on each Task root Session. Real
  Provider usage is correctly owned by the exact child Session whose kind and
  agent are `orchestrator`; both usage streams existed and were non-empty in the
  retained database.

The selected correction removes both redundant model-owned identity fields.
`capability_search` always uses the occurrence Harness snapshot. Artifact page
enumeration requires a prior completed `panel_query_task` row for the Task in
the same physical Turn, derives its exact terminal reference from that
persisted output, verifies it before and after every bounded page read, and
continues returning the reference as an audit fact. It does not select the
latest terminal state, accept a notification ID, fall back to caller input, or
add a compatibility schema. Stateless Panel and gateway requests have no
Session Turn; their explicit current-catalog request binds the canonical
current terminal occurrence at request start and performs the same before/after
revalidation without accepting caller-owned lifecycle identity. Inactive
capability deactivation becomes an idempotent no-op in the one reveal-set reducer while the exact requested
transition remains in the immutable receipt. Mission text names only
`panel_read_task_artifact`. The E2E checker resolves exactly one child
`orchestrator` Session for each Task root and binds required usage to those
Sessions; ambiguity or absence is an explicit checker failure.

Positive verification must cover the production Provider schema without a raw
terminal reference, a real persisted `panel_query_task` receipt driving an
Artifact page and rejecting a page without that receipt, exact current-terminal
revalidation, idempotent inactive-set subtraction, absence of the redundant
Catalog-hash input, and Task-root-to-child-Orchestrator usage-owner resolution.
After focused tests, package/root typecheck and repository gates, a newly frozen
exact tree requires an uninvolved zero-finding review, commit and push. One
fresh exact-remote run from that pushed source must contain no failed Tool
occurrence and must durably publish the nonce-bearing final Artifact and close
the Mission before release.

#### Exact-remote pre-dispatch capability-filter correction

##### Recall

The operator requires the scheduling remediation to continue until a real
Mission run has a normal trajectory, then requires the current three-component
beta version and website to be published. Delivered work from other owners must
not be invalidated or restaged. This correction is accepted only when the same
production-shaped duplex checker, run from an exact pushed commit with the
separately verified Provider and model catalog, creates exactly two Tasks,
completes their direct durable scheduler protocol, publishes the nonce-bearing
interactive Artifact, and durably closes the Mission. A passing static test or
mock is not end-to-end evidence.

Hard constraints remain: preserve the immutable Mission-held Expert Squad
snapshot; require one exact held `promptProfile` for each Mission-created Task;
do not let the Host choose a Squad, infer a fallback profile, or bypass the
catalog; retain streaming Provider calls and the existing reveal-receipt
identity; do not modify the unrelated working changes in `session/index.ts` or
the two Web content files. Read material for this cut includes the retained
Mission state and SQLite Tool facts, the frozen capability Catalog attachment,
`capability/descriptor.ts`, `capability/catalog.ts`,
`capability/reveal-owner.ts`, `tool/capability-search.ts`, the Mission launch
authority and General Mission Skill, current capability and Expert Squad
architecture, focused catalog/reveal tests, and the introduction history of
`next_owner_kinds`. Whole-repository search found only the canonical input and
catalog implementation plus two focused test uses; there is no separate public
API implementation. No independent-agent feedback exists for this correction
yet; an uninvolved read-only review is required after implementation and
verification.

##### Failure evidence and root cause

Exact remote commit `c0b5f7620342961ed82824c520779bc1b417522c`
was run with the actual `openai/gpt-5.6-sol` model. The retained root is
`mission-scheduling-c0b5f7620-20260903-final/temp/opencorvus-mission-task-duplex-e2e-KEKOWi`.
The three-minute durable-activity deadline ended the run at progress
`0:0:0:0:0`: zero Tasks, scheduler events and delivered inboxes, with 14
Messages, 40 Parts and twelve completed Tool requests/outcomes. The Mission had
already written an explicit authority-blocked frontier and entered standby, so
this is a terminal pre-dispatch failure rather than an observation timeout.

The frozen Catalog attachment proves that the Mission held four visible Expert
Squads: `advanced`, `base`, `research-studio` and `squad-sdk`. All have
`next_owner.kind=create_task_with_expert_squad`. Every one of the six Expert
Squad searches, including the empty enumeration query, supplied both
`kinds=[expert_squad]` and `next_owner_kinds=[call_tool]`. The catalog correctly
applied filters conjunctively and therefore returned an empty set. The Tool
contract, however, did not make the conjunction or the incompatible owner kind
visible, and the completed empty result was indistinguishable from a genuinely
empty held-Squad set. The model consequently converted a malformed filter
intersection into a false durable authority blocker.

The direct trigger is therefore not Task creation, scheduler delivery, Expert
Squad installation, fuzzy ranking or the held snapshot. It is an ambiguous
search contract: two valid independent filter dimensions can form an
impossible intersection and silently report capability absence. Existing tests
prove each dimension separately but do not cover this production combination.
Adding Squad keywords would only hide the issue because the incompatible owner
filter eliminates every candidate before ranking. Letting Task creation inherit
the active profile would violate the fixed held-owner contract.

Repository history identifies a second part of the same regression. Before the
Phase B occurrence-bound reveal migration, the production Tool reported
`visible_expert_squad_count`, Mission-only `held_expert_squad_count`, the
canonical persisted Mission `product_pillar`, and a divergent
`requested_product_pillar`; it also searched with the canonical Mission pillar.
Commit `36fdc0495` moved execution into the reveal owner but dropped those facts
and used the raw request pillar. The current Mission Prompt still instructs the
model to read the visible count, and current architecture still requires all
four diagnostics. The retained run records `Held Squad count: not exposed`, so
the missing diagnostics materially converted the filter error into a false
authority blocker rather than merely reducing observability.

##### Single correction

Keep both useful filter dimensions and their conjunctive meaning. The one
catalog candidate reducer will also compute, from the same frozen views, a
structured filter diagnostic whenever requested `kinds` have visible
candidates under all other structural filters but none can satisfy the supplied
`next_owner_kinds`. The completed `capability_search` result will expose the
requested kinds, requested next-owner kinds, and the actual compatible
next-owner kinds. A genuine empty held set or a text query with no fuzzy match
will not be mislabeled. Tool and field descriptions will state that filters are
ANDed, that an empty query enumerates structural matches, and that Expert Squad
search either omits `next_owner_kinds` or uses
`create_task_with_expert_squad`. The Host still does not select, broaden or
retry any query; the model receives exact facts and must submit the corrected
search itself.

The occurrence-bound reveal owner will also restore the existing Mission
diagnostic contract. The original persisted Tool input remains the immutable
replay and materialization identity, while result projection uses the canonical
Mission product pillar supplied by the Session authority. Output and metadata
report visible and held counts, the canonical pillar, and a divergent requested
pillar. Non-Mission callers retain an explicitly requested pillar as their
effective filter. No compatibility reader or second catalog projection is
introduced.

Positive tests must use a real Mission-visible Catalog containing an Expert
Squad and a callable Tool. They must prove that the production-invalid
`expert_squad + call_tool` query completes with zero results plus the exact
compatible-owner diagnostic, that the corrected empty Expert Squad query
returns the held Squad, and that a genuinely absent requested kind has no false
diagnostic. A reveal-owner test must prove the diagnostic reaches the persisted
completed Tool output without a failed Tool occurrence. After focused tests and
typecheck, the exact staged tree requires one uninvolved review. Delivery then
requires commit, fetch/merge, push, and a fresh exact-remote duplex run; the
earlier failed run remains diagnostic evidence only.

#### Exact-remote final Artifact occurrence correction

##### Recall

The operator requires the real Mission duplex checker to prove a normal
scheduler trajectory from an exact pushed commit before release. The checker
must retain the immutable fifteen-minute absolute bound, exact two-Task
cardinality, the twelve-event scheduler set, direct durable correlation, final
Artifact, canonical Task evidence, exact usage owners and durable Mission
completion. It must not broaden evidence across separate Session inputs or turn
a successful Mission into a PASS by ignoring a missing Artifact. Read material
for this correction includes the retained exact-remote database, the Mission
frontier and Task event logs, the persisted Message/Tool/Artifact facts,
`mission-task-duplex-snapshot.ts`, the real checker, its focused test, and the
current Panel physical-Turn contract. Whole-repository search found no second
duplex final-evidence reducer. No independent-agent feedback exists for this
correction yet; a new uninvolved read-only review is required after
implementation and verification.

##### Failure evidence and root cause

Exact pushed commit `04404da4e642f3fb3fa76554895a349bd7983a1e`
was run from a fresh Git archive with archive SHA-256
`CC0E381DB6A3ED4ED28D6CE9B878E7C3E2739C813D5F8FD398977E36826CEC81`,
the separately verified credential and model catalog, and the actual model
`openai/gpt-5.6-sol`. The retained runtime root is
`opencorvus-mission-task-duplex-e2e-6aDtu9`; it contains no production user
data. The result file was absent because the immutable absolute deadline
expired, so this run remains diagnostic rather than acceptance evidence.

The production trajectory itself completed. Exactly two Tasks were created in
the required order. Responder B delivered `READY_B`, directly answered A's
correlated `PEER_CONFIRM`, delivered `B_DONE`, and completed normally. Initiator
A delivered `READY_A`, acknowledged Mission `START_PEER` with B's exact Task
identity, completed the sibling exchange, received Mission's correlated
`DECISION`, delivered `A_DONE`, and completed normally. Mission accepted both
canonical Completion Decisions, published nonce-bearing interactive Artifact
`art_g0VU7ltKm00j5BdfSexD`, re-queried exactly both Tasks, re-enumerated and
fully read both evidence artifacts, called `panel_complete_mission`, and
persisted `boardLane=completed`. Exact usage existed for Mission and both child
Orchestrator owners; no third Task or operator relay existed.

The sole remaining gate reported
`final_artifact_occurrence_missing`, `final_artifact_payload_invalid`, and
`final_artifact_nonce_missing`. The final Artifact was persisted under assistant
Message `msg_g0VU7lnNi00Z1K9Zh5V1`; completion was persisted under later
assistant Message `msg_g0VU7mCdP00GUaQnrCHy`. Both Messages belong to the same
Mission Session and have the exact common parent input Message
`msg_hL7P984rEzmk6BlmxUC3`. The checker nevertheless required the Artifact
Message ID to equal the completion Message ID. That equality contradicts the
real streaming Tool loop: publish must finish before its result is available,
and the model must then query and read current evidence before it can submit the
irreversible completion call. Each sequential Tool result creates another
assistant Message, while the common parent remains the canonical physical-Turn
occurrence.

##### Single correction

The one duplex final-evidence reducer will keep Mission completion mandatory,
resolve its exact parent input occurrence, and accept exactly one canonical
nonce-bearing interactive Artifact from the same Mission Session and the same
parent occurrence. An Artifact from a previous or later input remains rejected;
multiple Artifacts in the completion occurrence remain ambiguous and rejected.
The result continues to report the exact Artifact ID and exact usage owners. No
production Mission, scheduler, Provider, Artifact or completion behavior changes.

Positive verification must cover the real sequential shape: Artifact and
completion in different assistant Messages with one common parent are accepted;
an otherwise valid Artifact under a different parent is rejected; absent
completion occurrence authority and multiple same-occurrence Artifacts remain
typed blockers. After focused tests, package/root typecheck and repository
gates, the exact staged tree requires an uninvolved zero-finding review, commit,
fetch/merge and push. A fresh exact-remote run must then produce its result file
and independently prove the complete trajectory before release.

##### Validation and independent review

The focused final-evidence matrix passed four tests and seventeen assertions.
The retained real-run database projected `ready=true`, one exact nonce-bearing
Artifact, no missing usage owner, two completed Tasks and a completed Mission
after the correction. Root typecheck passed eight of eight workspaces;
documentation, routes, architecture index, package topology, release-mutation
topology and exact-index module topology remained green at 1,103 modules, 5,530
runtime edges, no retained strongly connected component and four clean imports.
An uninvolved read-only reviewer inspected exact tree
`ccde2a8dd1ed5ff49661b26e1c60d834b4550785`, independently reran the focused
matrix, and returned FINAL PASS with P0-P3 all zero. The only post-review source
change is this evidence record; no implementation, test or current architecture
fact changed.

#### Exact-remote source bundle and terminal-evidence correction

##### Recall

The operator requires dependency reuse rather than repeated installation and
requires the exact-remote Mission run to close inside the existing fifteen-minute
absolute bound with no abnormal scheduler trajectory. A clean result may not be
manufactured by extending that bound, suppressing runtime errors, omitting Task
evidence, or rerunning until model variance happens to pass. The source snapshot
must reuse already available third-party dependency bytes while resolving every
`@opencorvus-ai/*` workspace import against that exact snapshot. Mission must
still completely read every deliverable, report, review, and evidence Artifact
on which acceptance relies. It must not turn unrelated package bindings or
Task-root ingress audit facts into mandatory acceptance inputs merely because
they share the terminal Artifact catalog.

Read material for this correction includes the retained runtime database and
Tool facts, `mission-core.txt`, the General Mission Skill, Panel Artifact Tool
descriptions, Browser MCP source launcher and bundle checks, package export
maps, the exact source cache layout, and the previous successful retained run.
Whole-repository search found one Browser source launcher and one Mission
terminal-reconciliation contract. No independent-agent feedback exists for
this correction yet; an uninvolved read-only review is required after the
implementation and focused verification.

##### Failure evidence and root cause

Exact pushed commit `cc0e86a70119f0d277612ea3d141ffaff8d597a1` was
archived with SHA-256
`A27CFEADA873EDCE6DC28E222586BA497E18A8CEF054B188D9A82356D1402CF1`
and run with the separately verified credential/model catalog and actual
`openai/gpt-5.6-sol` request. The retained runtime root is
`opencorvus-mission-task-duplex-e2e-shX2IE`; it contains no production user
data. The immutable deadline ended at `2:12:12:2:0`. All twelve scheduler
events and inbox deliveries were durable, all source Tools completed, both
Tasks completed, the Mission acknowledged `A_DONE`, all terminal replies were
complete, direct endpoint/correlation/FIFO/semantic-order checks passed, no
Tool occurrence failed, and no usage owner was missing. The Mission had not yet
published its final Artifact or completed, so the run is diagnostic rather
than acceptance evidence.

The runtime repeatedly reported that the Browser MCP Node bundle could not
resolve `@opencorvus-ai/util/runtime-paths`, `runtime-directories`, and
`process-node`. Reproducing the launcher's exact `bun build --target=node`
command from both the Project directory and package directory failed under the
same already-populated cache. The imports resolve through Bun's runtime
resolver, and the same bundle succeeds immediately with
`--conditions=source` (266 modules, one 1.72 MB output). The package export map
routes Node `import` to unbuilt `dist/*.js` and source/Bun conditions to the
tracked TypeScript. The launcher omitted the source condition; installing the
same dependency graph cannot create those workspace build outputs and is not
the fix. The exact cache view also exposed an assembly error: package-local
workspace Junctions pointed at an older source snapshot. Correct reuse retains
third-party cache targets but binds every workspace package to the exact source
being evaluated.

The Mission itself made 86 completed Tool calls. After the two Tasks finished,
it correctly enumerated one bounded Artifact page per Task but then read seven
control/evidence entries individually: both Completion Decisions plus two and
three Task-root ingress dispositions. The final A catalog also contained only
package/runtime bindings in addition to those facts. The Mission had already
observed every nonce-bearing scheduler message and durable correlation in its
own visible history; the current Completion Decision was the required terminal
evidence, and there was no Task deliverable/report Artifact. Reading internal
ingress dispositions did not strengthen this stage acceptance and consumed the
remaining completion window. Current prompt text says to select only the
entries needed by stage acceptance, but does not explicitly distinguish
control-plane audit entries from acceptance evidence, so model variance can
turn bounded catalog enumeration into an unnecessary serial read walk.

##### Single correction

The Browser source launcher and the release artifact's shared Browser bundle
builder will pass Bun's `source` condition to their existing build operations.
Packaged Browser runtime selection, cache publication, digest verification,
process supervision, external runtime modules, and Node target remain
unchanged. The artifact check will build the complete entry, while the
concurrency test will run the real source launcher from an unrelated temporary
Project working directory. Together they prove that the package's tracked
source exports rather than Project-local build products satisfy both bundles.

Mission terminal reconciliation will retain complete catalog pagination and
complete reads for every selected semantic input. It will state positively
that package-revision bindings, execution-capsule bindings, and Task-root
ingress dispositions are control-plane audit facts, while the current
Completion Decision plus every actual deliverable/report/review/evidence item
needed by the stage are acceptance inputs. When a direct scheduler protocol is
already present in the Mission's visible durable messages, the Completion
Decision is the required terminal Artifact; additional control-plane facts are
read only to resolve a concrete contradiction or missing acceptance fact. This
changes model guidance, not Host acceptance gates, lifecycle authority,
Artifact truth, or evidence retention.

Positive verification must prove the real Browser source bundle from a
dependency-free temporary Project directory, the Mission prompt's exact
evidence-selection contract, the existing duplex snapshot matrix, package/root
typecheck, docs/routes/topology gates, and an uninvolved zero-finding review.
After commit, fetch/merge and push, the final exact-remote source cache will be
assembled without an installer: third-party package entries reference the
existing cache and workspace links reference the exact archived source. The
same immutable checker must then produce a result file with no Browser startup
error, no failed Tool occurrence, one nonce-bearing final Artifact, and durable
Mission completion.

##### Validation and independent review

The combined Browser bundle, Mission guidance, and duplex snapshot matrix
passed eleven tests and thirty assertions. Root typecheck passed all eight
workspace tasks. Documentation passed at 339 operations and 25 groups; routes
passed six rules across 34 files; the architecture index covered 16 current
documents; package topology covered ten workspaces; module topology covered
1,103 modules and 5,530 runtime edges with no retained strongly connected
component and four clean imports. Control-lease ownership passed 18 owners and
22 acquire sites, control-state redundancy passed 53 tables and seven fact
classes, release mutation retained five authorities, and public-package,
Expert Squad, and `0.0.58-beta` version checks passed.

An uninvolved read-only reviewer inspected exact staged tree
`9a89dbba91177dff7577f0ef326443d34f4e6e60`, independently reran the real
concurrent Browser source launcher, complete release bundle, and Mission
guidance tests, and returned FINAL PASS with P0-P3 all zero. The reviewer
confirmed that the correction neither changes packaged runtime selection nor
weakens terminal evidence: every required Completion Decision, deliverable,
report, review, and evidence Artifact remains a complete read, while an audit
fact is additionally read whenever a concrete contradiction or missing
acceptance fact requires it.

#### Exact-remote terminal-convergence correction after `b104c84d0`

##### Recall

The operator requires the complete remediation ledger to converge without
agents blocking one another, then requires real Provider Mission acceptance
with no abnormal scheduling trajectory. The exact run keeps the immutable
fifteen-minute absolute deadline; extending it, retrying until variance passes,
hiding participant turns, eagerly exposing the former broad Tool surface, or
adding a Host workflow gate are not acceptable corrections. Dependency
assembly must reuse the existing third-party cache and exact workspace source;
no installer is part of this correction.

Read material includes exact pushed commit
`b104c84d03b023940cb5b6aeefa41b7b935baec0`, retained runtime database
`opencorvus-mission-task-duplex-e2e-PPnrEL`, all Mission and child scheduler
Message/Tool facts, Provider usage facts, `mission-core.txt`,
`orchestrator-core.txt`, the General Mission Skill, the Harness/reveal reducer,
runtime Tool ownership, strict Provider Tool budgets, and the real duplex
checker. Whole-repository search covered every Mission/Task scheduler
communication instruction, every revision-zero construction point, and all
current budget tests. Independent-agent feedback for this post-run correction
is none; an uninvolved read-only review is required after implementation and
focused verification.

##### Failure evidence and horizontal root-cause audit

The exact source archive has SHA-256
`750830F58F7032597D79E3050455D3859CA006F9C8F3D83948FCDC29611452ED` and
used the separately verified `openai/gpt-5.6-sol` model. Browser and Computer
MCP started successfully. Exactly two Tasks, twelve scheduler events, twelve
terminal inbox deliveries and all three correlated replies completed; both
Tasks completed normally; every source Tool had one terminal outcome; no Tool
occurrence failed; endpoint authority, FIFO, semantic order and terminal order
all passed. Mission remained running and did not publish the nonce-bearing
interactive Artifact or call `panel_complete_mission`. The failure is therefore
terminal convergence after a successful scheduling chain, not scheduler
delivery, persistence, Browser startup, Task lifecycle, or checker projection.

The immutable facts quantify the cost. Mission made 65 Provider calls and 59
Tool calls, including 18 `capability_search` and 31 `mission_state` calls. The
two child schedulers made 32 Provider/Tool calls, including another 18
`capability_search` calls. Across the scenario, 36 of 91 Tool calls only
discovered or activated another Tool. Several Task occurrences first searched
for a named scheduler Tool and then issued a second search carrying the exact
runtime-projection ref even though the canonical ref is determined by the
projected Orchestrator owner. Non-terminal READY/DONE facts were also copied
through repeated Mission-state reads and full-file writes even though their
immutable scheduler Messages already are the durable coordination evidence.

After the last Task terminal notification, Mission correctly called
`panel_query_task`, `panel_query_task_artifacts`, and
`panel_read_task_artifact`, but current Prompt text forced a separate
`capability_search` before each small leaf and then another search for
`mission_state`. At the deadline its latest action was only the state reveal;
publication had not started. This serial tail is required by the current phrase
"activate at most one new final-preflight Tool" even though the canonical
reveal reducer permits five exact leaves and the actual strict Provider
definitions leave ample room. In the retained occurrence, search plus
`panel_query_task`, `panel_query_task_artifacts`, and
`panel_read_task_artifact` individually measured 4,221, 8,812, and 4,929
characters. Their leaf increments over the 3,252-character base, together with
`panel_complete_mission`, remain far below the 32,000-character and 8,000-token
limits. `publish_interactive_artifact` remains the one large leaf and must stay
alone.

The shared audit reaches the same boundary for Mission, Task scheduler,
ordinary/terminal scheduler Messages, retry/restart-safe reveal receipts,
serial and sibling-Task paths, and multi-Project isolation. The immutable
Catalog/Harness binding, explicit exact refs, per-input revision reset, Tool
permission, and owner-specific execution checks remain correct. Persisting
active reveals across inputs would create a second mutable authority and is
rejected. Eagerly exposing every scheduler capability would restore the broad
payload that search-native projection removed and is also rejected. The
remaining abnormality is the Prompt's failure to use the reducer's existing
bounded multi-leaf transaction and its unnecessary duplication of already
durable scheduler facts.

##### Single correction and acceptance boundary

Mission terminal reconciliation will activate the complete small audit group
in one `capability_search`: `panel_query_task`,
`panel_query_task_artifacts`, `panel_read_task_artifact`, and, only for final
completion, `panel_complete_mission`. It will page and call those leaves in the
required causal order. `publish_interactive_artifact` remains a separate
single-leaf activation. After publication, Mission deactivates it while
activating the complete small completion group, re-queries the full current
child set, completely reads every relied-on canonical evidence Artifact, and
calls `panel_complete_mission` in that same physical Turn. This uses the
existing five-ref compare-and-swap reducer and immutable payload limits; it
does not add a workflow Tool, batch executor, hidden selection, fallback, or
Host route.

A visible scheduler notification is already a durable participant fact. The
Mission Prompt will prohibit copying its subject, body, correlation, delivery,
or progress into Mission state. A state write remains required only when the
fact actually changes the authored stage graph, ownership, acceptance judgment,
dependency frontier, force-majeure blocker, or next-wake action. READY, DONE,
and correlated replies remain directly inspectable evidence and are not
shadowed by markdown.

The Task Orchestrator Prompt will name the existing canonical projected refs
for `scheduler_message`, `no_action`, and `manage_task`. When one or more of
those actions are already determined by the current scheduler ingress, the
first search activates their exact refs directly instead of spending a fuzzy
discovery Turn and a second activation Turn. This changes no grant, owner,
schema, permission, lifecycle or decision authority.

Positive verification must normalize the actual strict OpenAI and Anthropic
definitions and prove both the terminal audit group and final completion group
fit beside the permanent search base, while publication alone still fits and
is not combined with another leaf. Prompt-contract tests must prove exact ref
activation, durable-message non-duplication, ordered grouped reconciliation,
and the publication/group handoff. Existing reveal reducer, scheduler-message,
terminal authority and duplex snapshot tests must remain green. After package
and root typecheck, docs/routes/topology gates, exact staging, and uninvolved
zero-finding review, the commit is pushed and the same exact-remote run is
reassembled from the existing cache. Acceptance requires a result file,
exactly one nonce-bearing final Artifact, durable Mission completion, no failed
Tool occurrence, the exact duplex chain, and a materially shorter terminal
tail without duplicate dispatch, state shadowing, or search-only loops.

##### Implemented candidate and local verification

The implemented correction changes only the two role-core Prompt contracts and
their positive contract/budget tests. Mission now uses one bounded reveal for
the three-leaf terminal audit group, one isolated publication reveal, and one
four-leaf completion group. It treats the visible scheduler Message as the sole
durable owner of communication fields and writes only authored Mission facts.
The Task Orchestrator now activates the already determined canonical
`runtime-projection:orchestrator` refs for `scheduler_message`, `no_action`, and
`manage_task` directly and together when one ingress requires them.

The focused Prompt and strict Provider budget matrix passes 5/5 tests and 37
assertions. The budget test materializes the real Mission Tool definitions,
normalizes them through both Anthropic and strict OpenAI adapters, and proves
the exact three-leaf audit group, four-leaf completion group, and isolated
publication leaf all fit the canonical reveal limits. Reveal receipt and owner,
scheduler delivery, Mission/Task duplex contract and snapshot, Mission terminal
authority, Prompt contract, and budget coverage pass 27/27 tests when the one
Execution Capsule source-enumeration race from the parallel run is rerun in its
own file; that file passes 5/5 and 30 assertions. OpenCorvus package typecheck
passes, and root typecheck passes 8/8 workspaces.

Current checkers pass: docs 339 operations/25 groups, routes 6 rules/34 files,
architecture index 16 current documents, package topology 10 workspaces,
control leases 18 owners/22 acquisition sites, control-state redundancy 53
tables/7 allowed fact classes, release mutation topology 5 authorities,
publication order 3 packages, and release-family version `0.0.58-beta`.
Exact staged-tree module topology passes with 1,103 modules, 5,530 runtime
edges, no retained cycle, and four clean imports. Exact staged-tree release
mutation topology also reports the same five canonical authorities. No
dependency installer ran.

##### Exact-remote success and remaining trajectory abnormality

Commit `ff9a8d4d114ac7ae681e4657c7bf78e7cc074b75` was pushed and verified at
zero local/remote divergence. A fresh Git archive of that exact commit was
assembled without an installer: the existing root and all ten workspace
dependency caches, generated SDK distribution and native process-supervisor
binary were reused through filesystem links, while every `@opencorvus-ai/*`
workspace import still resolved to the archived source. The source archive
SHA-256 was
`5C9D520F9C0084B1766252AF786E6D58C616E5467F069774E3333AC23864431F`.
The authority source separately proved a configured OpenAI credential and an
`openai/gpt-5.6-sol` model projection without exposing either file's content.

The real Provider run returned `ok: true` in
`D:\myhexin-local\.codex-benchmarks\mission-scheduling-ff9a8d4d1-20260903-final\result.json`.
It created exactly two Tasks, delivered the exact 12-event duplex set through
12 inboxes, preserved the three correlated replies, recipient FIFO and semantic
order, completed both Tasks after their DONE facts, produced no failed Tool
Part, published nonce-bearing Artifact `art_g0VU8S6BE005ernStFRw`, and durably
completed Mission `fbb38fe01ceeeceb`. The terminal audit group, isolated
publication leaf and four-leaf final completion group all appeared in the
intended order and the final completion transaction succeeded.

This is functional acceptance, not a clean scheduling trajectory. From the
first durable READY fact to Mission completion the run took about 671 seconds.
Mission made 66 Provider calls and accounted for 2,136,664 total tokens when
cache reads are included; the two Task schedulers together made another 20
calls and accounted for 487,411 tokens. The preceding failed exact-remote run
made 65 Mission calls. The terminal grouping correction therefore closed the
missing final Artifact/completion defect but did not materially reduce the
per-wake call tax.

The current source explains that fixed cost. Every authoritative scheduler
Message starts a new input occurrence, and every input correctly resets dynamic
reveal state to revision zero. Native Mission nevertheless accesses its two
small, role-invariant transport leaves, `mission_state` and
`scheduler_message`, only by first calling `capability_search`. The visible
message is already the durable input and these Tool identities are already
fixed by the native Mission role; repeatedly discovering them is not a business
decision, permission decision, Catalog refresh or recovery boundary. Persisting
the prior input's active reveal would create a mutable cross-occurrence shadow
and remains rejected.

##### Native Mission transport correction

The single correction is a platform-declared native Mission transport base
containing exactly `mission_state` and `scheduler_message` beside the permanent
`capability_search` definition. The Tool-pool catalog is the one membership
source. On every Provider step, SessionLoop re-materializes those exact Registry
definitions from the current input's immutable Catalog/Harness binding, applies
the same permission and Tool-switch policies, and includes their normalized
definitions in the reveal base digest and the existing 32,000-character /
8,000-token total budget. There is no Session cache, persisted active set,
workflow gate, inferred message router, compatibility branch or alternate Tool
executor.

The base names are part of the reducer's immutable base description. An exact
search cannot activate a Provider name already owned by that base; this closes
the duplicate-definition ambiguity for all permanent Provider definitions,
including `capability_search` itself. Rare Mission management leaves remain
search-revealed. In particular `panel_create_task`, the terminal audit group,
the isolated large publication leaf and the final completion group keep their
existing exact reveal receipts and causal order.

Positive acceptance must prove with the actual strict OpenAI and Anthropic
normalizations that the three-leaf native base fits the total budget, that the
base plus isolated publication still fits, and that the base plus terminal and
completion groups still fits. A real SessionLoop Mission occurrence must expose
the three base Tools before any reveal, preserve them after a reveal/deactivate
cycle, and execute both native transport leaves through their ordinary persisted
ToolPart path. Reducer tests must prove a permanent-base activation is rejected
without changing revision or active refs. Prompt tests must stop instructing
Mission to reveal either base leaf. Existing Task projected capability authority,
StructuredOutput base accounting, reveal recovery, permission, terminal and
duplex contracts must remain green. After exact staging and uninvolved zero-
finding review, the pushed source requires one fresh exact-remote run whose
result includes per-agent Tool-name counts and phase timing; functional PASS
alone is insufficient if the repeated search/state loop remains.

##### Native Mission transport implementation evidence

The implementation keeps one membership declaration,
`NATIVE_MISSION_TRANSPORT_TOOL_IDS`, in the pure Tool-ID catalog and projects
that exact set into the native Mission role. SessionLoop selects the eligible
subset with the merged execution permission and current Message Tool switches,
requires exact occurrence Harness execution grants, materializes only those
Registry leaves, binds them through the ordinary persisted ToolPart wrapper,
and includes their real Provider-normalized definitions in the immutable base
digest and total payload budget. The reveal reducer now carries the canonically
sorted permanent Provider names and returns a typed base-definition conflict
before a candidate can duplicate one; persisted conflicting receipts remain
corrupt occurrence evidence.

The positive runtime contract creates real native Mission occurrences. Revision
zero exposes exactly `capability_search`, `mission_state`, and
`scheduler_message`; Tool switches and merged permission each narrow the base;
one exact `wait` reveal and deactivation preserves the three-leaf base; and both
transport leaves execute through their persisted Mission assistant ToolParts,
including a real durable scheduler notification to a Mission-owned Task. The
strict Anthropic and OpenAI budget contract measures the three-leaf base, the
base plus the terminal audit group, the base plus the completion group, and the
base plus the isolated publication leaf against the 32,000-character and
8,000-token ceilings.

Before final review, the focused non-UI matrix passed 26 tests with 121
assertions across reveal ownership/recovery, receipt reduction, Structured
Output accounting, Skill reveal, strict Provider budgets, terminal Mission
authority and scheduler prompt contracts. The dedicated native base/reducer
matrix then passed 10 tests with 17 assertions. OpenCorvus package typecheck and
root typecheck passed, with the latter completing all eight workspaces. Docs
reported 339 operations and 25 groups; routes reported six rules across 34
files; architecture and package topology, version alignment at `0.0.58-beta`,
control-state (53 tables/seven allowed fact classes), control-lease (18 owners/
22 acquire sites), and release-mutation topology (five authorities) all passed.
The exact code/test/documentation index before this evidence paragraph was
`5403aef4a6f7295fc270fada676b128778e85d2a`; its module topology contained
1,103 modules, 5,531 runtime edges, no retained strongly connected component,
and four clean imports. No dependency installer or network package fetch ran.

The first independent review of tree
`fd0fd4bd0af3e742a4ba40270abdf3d8c4f8f1d8` returned P2=1: a reveal whose
Provider name collided with a conditional StructuredOutput reservation reached
the new base-name conflict before the established Provider-name authority and
therefore lost the exact structured/incoming owner diagnostic. SessionLoop now
checks an existing structured reservation at exact materialization and returns
the original `ProviderToolNameCollisionError`; identical permanent Registry
ownership still reaches the reducer's base-definition conflict, so the two
contracts no longer shadow each other. Both the native base/reducer matrix and
the existing Registry and projected StructuredOutput collision tests pass after
the correction. Because source changed, `fd0fd4...` is historical review input
and the corrected exact tree requires a fresh independent review.

The fresh independent review of corrected tree
`30d3b9d770b5d36250161091bfe9655810409add` kept the StructuredOutput correction
and all non-Mission checks at zero findings, but found one P1 recovery gap.
Revision-zero `scheduler_message` has no reveal receipt. Its ToolPart and
permission request therefore persisted only the old name-derived built-in
Provider digest; after an approved Ask-me request lost its process before the
effect began, a same-name definition or materializer change reconstructed a new
Tool under the old authorization and could execute it. The tree remains review
evidence only and is not a delivery candidate.

The correction reuses the existing permission invocation as the only durable
authority. Every Registry built-in wrapper now derives its permission Provider
digest from the real normalized Provider definition digest and the same exact
materializer-binding digest already used by reveal receipts, including the
frozen Harness owner revision and Catalog snapshot. Direct execution and
permission continuation call that one wrapper; no base cache, shadow state,
compatibility reader, alternate executor, or name-only fallback was added.

Two production-shaped operating-system process cuts exercise native Mission's
real `scheduler_message` Tool under Ask-me policy. Both first persist the ToolPart
and permission request, then terminate the producer process before effect start.
With the same authority, a second process resumes the exact request, writes one
scheduler event, completes the ToolPart, and retires the continuation once. With
a changed Provider definition under the same Tool ID, the second process records
one `StaleContinuationError`, terminalizes the ToolPart as an error, and writes
zero scheduler events. The complete native transport file passes 6/6. The
permission continuation plus native file matrix passes 14/14; existing
SessionLoop/Tool-result permission recovery passes 7/7, including both result-
and Part-boundary process cuts; reveal/budget/prompt coverage passes 16/16; and
the full two-mode permission authority passes 17/17. OpenCorvus package
typecheck passes after the production correction. A new exact tree and fresh
uninvolved review remain mandatory before delivery.

Post-correction verification is now complete. The affected matrices pass 54/54:
14 permission-continuation/native-transport cases with 33 assertions, seven
SessionLoop and Tool-result permission-recovery cases with 22 assertions, 16
reveal/budget/prompt cases with 73 assertions, and all 17 two-mode permission
authority cases with 56 assertions. The native file's two process cuts each
start from a different isolated Project and reach their natural terminal result.
OpenCorvus package typecheck passes; root typecheck passes all eight workspaces,
with OpenCorvus executed fresh. Docs pass at 339 operations/25 groups, routes at
six rules/34 files, architecture index at 16 current documents, package topology
at ten workspaces, control leases at 18 owners/22 acquisition sites,
control-state redundancy at 53 tables/seven allowed fact classes, and version
alignment at the three-component `0.0.58-beta`. Pre-evidence exact tree
`6e231c50596be5d25d7f720ea4924aa695cb1dba` passes release topology with five
canonical authorities and module topology with 1,103 modules, 5,531 runtime
edges, no retained strongly connected component, and four clean imports. After
this evidence paragraph is staged, the new exact tree must repeat diff/docs/
release/module gates and receive a fresh uninvolved zero-finding review.

The next uninvolved review of exact tree
`8612f5caf8910411438aa9061863b596f29f07f6` returned P0=0, P1=2, P2=2 and
P3=0. It proved four concrete closure gaps: Ask recovery did not reconstruct a
persisted JSON-schema StructuredOutput reservation before folding an existing
reveal receipt; Harness or Registry disappearance and a permission/switch-
removed Tool failed before the permission wrapper and therefore did not retire
the request; the Mission prompt stated the two native leaves were always
visible despite legitimate permission/switch narrowing; and an existing real
post-execution plugin fixture omitted the now-mandatory discovery grant. The
tree is review evidence only and was not committed.

The correction keeps the input occurrence as the authority boundary. Live and
recovered turns now build the same StructuredOutput reservation from the same
persisted format, model and assistant identity. A valid historical receipt that
activated a later-promoted native transport leaf proves the older occurrence's
pre-promotion base and is reduced against that immutable base; new occurrences
use the current native base. The receipt remains the sole fact and no version
switch, shadow state, fallback executor or cross-occurrence cache was added.
Harness and exact Registry materialization drift now raise the existing typed
Catalog-stale contract, recovery maps that determinate surface drift to the
permission continuation's typed stale outcome, terminalizes the ToolPart, and
retires the ledger request through the same direct-reply and startup-recovery
path. A Tool removed by current permission or Message switches reaches the same
terminal contract. The prompt now tells Mission to use either transport leaf
directly only when it is visible on the current Provider surface.

Five new operating-system process paths extend the original same-authority and
definition-drift pair: a StructuredOutput occurrence first persists a real
`wait` reveal before losing the scheduler permission owner; an older occurrence
first persists `scheduler_message` as a revealed leaf before base promotion;
and exact Registry disappearance and Harness-grant disappearance each recover
under zero external effect. The complete native file passes 10/10. Every stale
case ends with an error ToolPart, one durable stale retirement and zero
scheduler events; the exact StructuredOutput and historical-base cases each
write one scheduler event and retire once. The full SessionLoop authority file
passes 9/9 after its three projected-worker fixtures were brought onto the
current canonical Task/dispatch-lineage authority rather than bypassing the
database trigger. The real post-execution plugin case passes inside its full
36-case Tool-result file, and the full two-mode permission authority passes
17/17 with 56 assertions. The bounded Expert Squad catalog file passes 14/14
after its installation assertion was bound to the exact current package
version and digest instead of a stale literal. A new exact staged tree, full
checkers and a fresh zero-finding independent review remain mandatory before
commit.

The final source-corrected staged tree reviewed before recording the review is
`baa01b05b44860b59357d628f38882ccd61c94d6`. Its full gates pass: OpenCorvus
package typecheck and root typecheck (eight workspaces); docs at 339
operations/25 groups; routes at six rules/34 files; architecture index at 16
current documents; package topology at ten workspaces; control leases at 18
owners/22 acquisition sites; control-state redundancy at 53 tables/seven
allowed fact classes; release topology with five canonical authorities;
three-component version alignment at `0.0.58-beta`; and module topology at
1,103 modules, 5,531 runtime edges, no retained strongly connected component
and four clean imports. Cached and working diff checks pass, and the existing
Session formatting difference plus two Web content differences have zero
cached intersection.

A fresh uninvolved read-only reviewer returned FINAL PASS for that exact tree
with P0=0, P1=0, P2=0 and P3=0. The reviewer independently ran the affected
nine-file non-UI matrix at 90/90 with 317 assertions and the startup-recovery
plus complete two-mode permission matrix at 25/25 with 81 assertions, for
115/115 total, and reran OpenCorvus package typecheck successfully. It also
verified that the tree hash remained unchanged after review and that no UI
tests, generators, edits, staging, commits, pushes or process termination were
performed during the review.

Appending only those two evidence paragraphs produced documentation checkpoint
tree `cf48ec57f235a8b7abacf822f75cc2f381c133a6`: its difference from reviewed
tree `baa01b05b44860b59357d628f38882ccd61c94d6` is exactly 22 inserted lines in
this record and no source, test or architecture change. On that checkpoint,
docs repeat at 339 operations/25 groups, release topology repeats with five
canonical authorities, module topology repeats at 1,103 modules, 5,531 runtime
edges, no retained strongly connected component and four clean imports, and
both cached and working diff checks pass. The three pre-existing excluded paths
still have zero cached intersection.

##### Exact-remote trajectory evidence projection

The exact-remote acceptance contract above requires the result itself to expose
the evidence needed to distinguish functional convergence from an expensive
per-wake loop. The existing checker recorded aggregate Tool, Message and token
counts but did not record Tool names by producing agent or persisted phase
timing. Repeating the Provider run without that projection would leave the
native-transport outcome dependent on a manual database reconstruction.

The checker now derives one read-only trajectory projection from its terminal
database snapshot. Every Tool request is joined to its parent assistant Message
and grouped by canonical assistant agent and Tool name. Phase milestones come
from persisted Mission Session creation, first persisted Task creation, first
and last scheduler events, last child-Task completion and the durable Mission
completion receipt; the result records both those timestamps and their six
named elapsed durations. Each Task's completion is checked against its own
creation before aggregation. An unmatched Tool request parent or an impossible
negative duration fails the evidence projection instead of being hidden under
an unknown bucket. No scheduler input, Host gate, cache, runtime policy or
acceptance state was added.

The positive snapshot contract passes 5/5 tests with 19 assertions and proves
the exact sorted per-agent Tool-name counts plus all milestone and duration
fields. OpenCorvus package typecheck passes after integration into the real
Provider checker. A scoped exact-tree review and normal push are still required
before the next Provider run; that run must assemble the pushed source from the
existing dependency cache without invoking an installer.

The first uninvolved review of trajectory-evidence tree
`f480ae948f39b88aa50509d760f03d7d870d1c55` returned P0=0, P1=2, P2=0 and
P3=0. The process-local pre-request clock could not be reconstructed from the
retained database, and aggregate minimum/maximum Task times could hide one
Task whose completion preceded its own creation. The corrected projection uses
the persisted Mission Session creation as its sole start milestone and checks
every Task's creation/completion pair before calculating aggregate phases. The
same positive contract now covers the typed impossible-time result, and the
focused 5/5 matrix, package typecheck and docs checker pass again. Because the
review findings changed the evidence implementation, a newly frozen tree and
fresh zero-finding review remain required before commit.

The corrected implementation tree is
`7542f6d2a3eb520a7976889a313cda775681d379`. A fresh uninvolved read-only
reviewer returned FINAL PASS with P0=0, P1=0, P2=0 and P3=0, independently
repeating the focused 5/5 tests with 19 assertions and OpenCorvus package
typecheck. The review verified the persisted Mission creation authority, each
Task's independent time ordering, missing Tool-parent failure, deterministic
agent/Tool ordering, real result integration and zero cached intersection with
the three excluded working paths. The tree remained exact after review and the
reviewer made no edits or external calls.

##### Cache-reused native-transport run and Mission-state round-trip root cause

The fresh real-Provider run used exact pushed source
`0da07fa208abbdcfdb6875e212e4b80c609af3bf` and
`openai/gpt-5.6-sol`. Its source archive SHA-256 is
`BCFE706185395C95A697F9F1B87A3408D7BBB1899B2927BCF51A369FD8D41024`.
Assembly invoked no installer and made no dependency download: 190 existing
third-party cache targets were reused through 236 `node_modules` junctions,
the existing SDK distribution and native process supervisor were reused, and
only 46 workspace targets came from the exact source archive. The independently
parseable result is
`D:\myhexin-local\.codex-benchmarks\mission-scheduling-0da07fa20-20260903-native-transport\result.json`,
19,474 bytes with SHA-256
`F69428186BA5549F83DE364559C5F5F0A5E5F2DB3B5CBCA2693E085DD969929F`.

Functional protocol acceptance passed. Mission `041b5702cf3d0138` created
exactly Tasks `tsk_g00VU9INnz00pgyoXtjz` and
`tsk_g00VU9IpfR001Dz5Yphw`; all twelve exact scheduler events reached twelve
durable inboxes; every source Tool completed; all three correlated replies,
recipient FIFO, semantic order and terminal order passed; both Tasks completed;
Mission published nonce-bearing Artifact `art_g0VU9LAFE00kRa3Y6JQc`; and the
durable Mission completion receipt was recorded. No Tool occurrence failed.

The trajectory is not accepted. Mission took 125,175 ms to create its first
Task, the child Task lifecycle occupied 472,472 ms, final reconciliation after
both Tasks were terminal took another 264,253 ms, and Mission completion took
861,900 ms from persisted Mission creation. Mission issued 53 Tool calls:
26 `mission_state`, nine `capability_search`, three `panel_query_task`, four
`panel_query_task_artifacts`, four `panel_read_task_artifact`, two
`panel_create_task`, two `scheduler_message`, and one each of
`panel_view_tasks`, `publish_interactive_artifact`, and
`panel_complete_mission`. Its 59 Provider calls accounted for 2,116,207 total
tokens including cache reads. The two Task Orchestrators issued 20 Tool and
Provider calls and accounted for another 487,413 tokens. Native Mission
transport therefore removed half of the former search tax, from eighteen
Mission searches to nine, but did not close the dominant state round trips or
produce a clean end-to-end trajectory.

The direct trigger is the current `mission_state` public schema. It permits
exactly one `read`, `write`, or `list` operation for one of four fixed files per
Tool call, while the Mission contract requires three files to be read at the
start of every ordinary wake and commonly changes more than one authored file
before a dispatch or completion boundary. The Tool result and every file
replacement are already bounded, but the interface forces independent model
round trips for one logical Mission-state snapshot or commit. Prompt guidance
can prevent scheduler Message shadow copies, but it cannot turn a one-file Tool
schema into one bounded operation. The native transport correction addressed
search activation only, so it could not remove this independent structural tax.

Whole-repository search found one production definition in
`tool/mission-state.ts`, Registry publication through `tool/global-tools.ts`,
the native Mission materializer in `session/loop.ts`, one direct runtime
acceptance use in `capability/native-mission-transport-base.test.ts`, prompt
contracts in `mission-core.txt` and
`scheduler-message-harness-contract.test.ts`, Provider budget coverage, and
the current search-native architecture. There is no route, SDK, alternative
Mission-state writer, database projection, or other model-visible caller to
preserve. The three unrelated working paths remain outside this correction.
Independent-agent feedback before implementation is none; a fresh uninvolved
read-only review remains mandatory after verification.

The single replacement is one bounded snapshot/commit protocol on the existing
four-file authority. `snapshot` returns all four logical files, including exact
existence, byte count and content, in canonical order. `commit` accepts one to
four unique complete-file replacements, validates the existing 256 KiB
per-file ceiling before writing anything, and applies them in canonical order
with `handoff.md` last. Each replacement uses the repository's mature durable
atomic file primitive. The four files remain the sole durable Mission memory;
there is no bundle shadow, Session cache, cross-occurrence active state, Host
workflow gate, inferred action, database mirror, fallback, or old model-facing
action union. Re-executing the same complete replacement remains idempotent,
and the existing last-written handoff boundary continues to make partial
process interruption recoverable by the next snapshot.

Mission uses one `snapshot` on an ordinary wake and one `commit` for all
authored changes before the next irreversible boundary. A scheduler Message
whose visible fact changes no authored Mission state uses neither operation; a
scheduler causal closure that does change authored state includes only the
changed files in one commit. Positive acceptance must prove the exact empty and
populated four-file snapshot, a multi-file commit with exact byte metadata,
native Mission execution through a persisted ToolPart, updated prompt
contracts, and strict Provider budgets. Existing reveal/recovery, terminal
grouping, scheduler-message, Mission completion, package typecheck and docs
checks must remain green before exact staging and independent review.

The implementation removes the per-file `read`/`write`/`list` action union and
publishes only `snapshot` and `commit`. Snapshot distinguishes an absent file
from a present empty file and reports UTF-8 bytes for all four canonical names.
Commit rejects a non-unique update set during schema validation, measures every
complete replacement before the first write, orders updates independently of
model input, and uses `Filesystem.writeDurableAtomic`; `handoff.md` is the last
possible replacement. Mission Prompt guidance now takes one snapshot on an
ordinary wake, commits all current authored changes together, and explicitly
performs no state operation for a scheduler Message that changes no authored
fact. Current architecture records that same authority boundary.

The first focused current-source matrix passes 15/15 with 55 assertions: ten
native Mission transport/recovery cases, both Mission and Task scheduler Prompt
contracts, and all three strict Provider Tool-budget cases. The native runtime
case executes an empty snapshot, an intentionally input-reordered two-file
commit, a populated snapshot, and `scheduler_message` through persisted Tool
Parts; the observed commit order is `frontier.md` then `handoff.md`, and the
snapshot reports exact existence, content and byte counts for all four files.
The exact Mission trajectory projection repeats at 5/5 with 19 assertions, and
the reveal owner repeats at 5/5 with 19 assertions including the real two-
process compare-and-swap path. OpenCorvus package typecheck passes, and root
typecheck passes all eight workspaces with OpenCorvus executed fresh.

One exploratory six-file Bun invocation was not used as acceptance evidence:
its first stateful test exceeded Bun's five-second default at 5.89 seconds,
triggered global `Instance` disposal, and caused cascading timeouts in later
files. Serial reruns closed the two task-relevant files above. A separate
terminal-Panel file, which has no changed source or test path in this cut,
completed its first three cases but its two process-supervisor-heavy cases
exceeded their existing hard 30-second cleanup boundary on this host; no Panel
failure is attributed to or hidden by the Mission-state protocol change.

Exact staged tree `3118e424cf22ba07216922ffc70f464911d41242`
contains only the six owned source, prompt, test, architecture and record paths.
Docs pass at 339 operations/25 groups; routes at six rules/34 files;
architecture index at 16 current documents; package topology at ten workspaces;
control leases at 18 owners/22 acquisition sites; control-state redundancy at
53 tables/seven allowed fact classes; version alignment at the three-component
`0.0.58-beta`; release topology at five canonical authorities; and module
topology at 1,103 modules, 5,532 runtime edges, no retained strongly connected
component and four clean imports. Cached and working diff checks pass. The
existing Session formatting difference and two Web content differences have
zero cached intersection. Appending this evidence changes only this record;
the newly staged tree requires one fresh uninvolved read-only review before
commit.

The uninvolved review of that first snapshot/commit tree returned NOT PASS
with P1=3 and P2=1. The old 256 KiB per-file ceiling could create state that
the shared 50 KiB Tool result boundary could never return. Four sequential
durable replacements were individually atomic but did not publish one logical
generation, so interruption could expose a mixed revision. The permanent
native Mission Provider definitions were recomputed rather than bound to the
authoritative input occurrence, allowing an old occurrence to cross a schema
change. The focused tests did not exercise these three boundaries. That tree
is retained only as review evidence and is not a delivery candidate.

The correction uses one physical authority instead of a four-file commit
simulation. The four public markdown names remain the logical vocabulary, but
their current state is one canonical `state.json` document. Snapshot computes
a digest revision from all four logical projections and validates its exact
encoded output against `Truncate.MAX_BYTES`. Commit requires that exact
`base_revision`, compares it while holding the shared cross-process fact lock,
constructs the complete next snapshot in memory, validates the same output
boundary, and publishes it with one durable atomic replacement. This makes an
old or new complete revision the only observable outcomes. First access
migrates the former four-file layout under that authority and deletes the old
physical files after the canonical document is durable; current execution has
no legacy read fallback.

The Catalog input payload advances to version 3 and records the canonically
ordered permanent Provider Tool names plus their normalized definition digest.
Initial execution, continuation, and permission resume compare the exact
current native base before exposing it. A version-2 payload is recognized only
to raise the typed stale-occurrence result; it is never interpreted as current
authority. Positive acceptance now additionally requires present-empty state,
near-boundary escaped output, over-boundary rejection with an unchanged
revision, stale-revision rejection, legacy-layout migration, one-winner
cross-process compare-and-swap, and native-definition drift retirement before
an external effect. New verification and a fresh uninvolved review are still
required before this correction can be committed.

The corrected current-source verification passes 41/41 focused tests with 140
assertions when the process-heavy files run in isolated Bun processes: native
Mission transport 13/13, occurrence Catalog 18/18, reveal reducer 5/5, and
Prompt plus strict Provider budget 5/5. This includes the exact encoded-size
boundary with JSON escaping, present-empty content, unchanged revision after
an oversized proposal, typed stale revision, one-time legacy migration, one
winner across two operating-system processes, version-2 Catalog retirement,
definition drift with zero scheduler effect, StructuredOutput recovery, and
the historical reveal-before-promotion path. OpenCorvus and root typecheck pass
with all eight root workspaces. Docs pass at 339 operations/25 groups, routes
at six rules/34 files, architecture index at 16 current documents, package
topology at ten workspaces, control leases at 18 owners/22 acquisition sites,
control-state redundancy at 53 tables/seven allowed fact classes, and version
alignment at `0.0.58-beta`. Exact-index module topology passes at 1,103
modules, 5,535 runtime edges, no retained strongly connected component and
four clean imports; release topology finds the five canonical authorities.
Cached and working diff checks pass, and the Session formatting difference and
two Web content paths remain working-only with zero cached intersection.

One exploratory combined Bun process is excluded from acceptance evidence. A
pre-existing MCP process-supervisor cleanup lost its Windows physical
settlement marker in the final Catalog case, poisoned shared Project disposal,
and made later native/reveal cases inherit the same request ID. All three files
then passed independently, including the same Catalog case. A separate first
state-boundary run exposed Windows `MoveFileExW` contention when the data file
itself was also the lock anchor. The correction now uses a stable sidecar lock
anchor and leaves `state.json` as the sole state authority; the bounded,
migration and real two-process cases pass after that change. No installer or
dependency download was invoked. The staged correction still requires a fresh
uninvolved exact-tree review before commit.

The first uninvolved review of that exact correction found one P1 and two P2
gaps. A valid former four-file layout could still be larger than the new 50 KiB
complete snapshot boundary and therefore had no explicit migration recovery;
same-input continuation materialized the permanent Provider base once before
detecting the existing binding and again during Tool resolution; and acceptance
did not yet cover the real post-publication migration crash cut or version-2
Catalog retirement through both ordinary and permission continuation. The
reviewed tree remains historical evidence while these narrow findings are
corrected; the prior implementation and green evidence are not discarded.

The correction keeps one authority at every boundary. An oversized valid
former layout now produces `MissionStateLegacyMigrationRequiredError` before
`state.json` is created, reports the exact Mission directory, per-file bytes,
encoded output bytes and limit, and preserves the former files unchanged so an
operator can archive or trim bulk evidence and retry the one migration. A real
process test exits immediately after the canonical document is durably
published with retirement pending; a fresh process reads that complete
generation, retires every former file and marks the same document complete.
The same-input binding branch no longer performs the pre-bind permanent-base
materialization and performs exactly one actual base materialization per later
Provider step. A version-2 Catalog on an ordinary continuation is detected
after the current assistant is durably admitted and owner-bound, producing a
terminal `StaleCatalogOccurrenceError` without a second Provider step. The
permission continuation converts the same stale authority into its typed
continuation error, terminalizes the exact Tool Part, and records zero scheduler
effects. These reviewer corrections require the full focused matrix, typechecks,
repository checkers, a new exact index tree and a fresh uninvolved zero-finding
review before commit.

The reviewer-correction matrix now passes all five added boundaries with 16
assertions: one permanent-base materialization on a same-input continuation,
typed oversized-former-layout recovery, a real publication-to-retirement
process crash, version-2 permission continuation with zero scheduler effect,
and version-2 ordinary continuation with one first Provider step followed by a
terminal stale assistant before any second Provider step. The complete native
Mission transport file passes 18/18 with 42 assertions. Reveal passes 5/5 with
19 assertions, Mission/Task scheduler Prompt guidance 2/2 with three
assertions, and StructuredOutput base budgeting 1/1 with four assertions. The
Catalog file's 13 non-supervisor cases pass in its shared process; each of the
five process-supervisor cases also passes in an independent process, for all 18
current Catalog cases and 49 assertions. The single-process aggregate is not
claimed green: one pre-existing Windows MCP supervisor loses its physical
settlement marker and poisons later disposal in that process. This separate
runtime defect remains open for a later cut instead of being attributed to or
hidden by the Catalog correction.

OpenCorvus package typecheck and root typecheck pass, with all eight root
workspace tasks successful. Docs pass at 339 operations/25 groups, routes at
six rules/34 files, architecture index at 16 current documents, package
topology at ten workspaces, control leases at 18 owners/22 acquisition sites,
control-state redundancy at 53 tables/seven allowed fact classes, release
version alignment at `0.0.58-beta`, and public package publication order is
valid. Exact index tree `e4b3fdb9c161562ad1bb526dfdc40627dd6e669d`
passes release mutation topology with five authorities and module topology with
1,103 modules, 5,535 runtime edges, no retained strongly connected component,
and four clean imports. The host C volume contained 3,461 abandoned historical
test roots and only 946,765,824 free bytes; no live Bun, Node or Git test process
owned them. Recursive removal was rejected by the local safety policy, so this
cut did not delete or bypass anything and directed its isolated test-owned
temporary roots to `D:\\myhexin-local\\.opencorvus-test-temp`, where the
existing owner-marker cleanup contract remains in force. No installer or
dependency download was invoked. Appending this evidence changes only this
record; the resulting exact tree still requires a fresh uninvolved zero-finding
review before commit.

The uninvolved final review of exact tree
`1bc27619ac4f4ae1b4ce2e6f82f28c9f0f19035a` returned FINAL PASS with
P0=P1=P2=P3=0. It independently confirmed the typed lossless oversized-legacy
recovery boundary, real post-publication process-crash retirement, one
permanent-base materialization on same-input continuation, and explicit
ordinary/permission version-2 terminal paths with no unauthorized Provider or
scheduler effect. It found no remaining legacy action, current four-file
fallback, parallel state authority, Host workflow gate, Provider schema bypass,
or excluded-path overlap. The reviewer made no file, index, commit, network,
Provider or process changes, and its final `git write-tree` remained exact.
This paragraph records that completed review only; it changes no production or
test contract.

##### Exact-source acceptance and remaining terminal-trajectory correction

###### Recall

The operator requires the current three-component release-family source on
branch `v0.0.55beta` (package version `0.0.58-beta`) to pass a real Provider
Mission run with a normal scheduling trajectory before any beta or website
release. The run must reuse the existing dependency, SDK and native caches,
must not install or download packages, and a functional PASS is insufficient
when the persisted trajectory still exposes repeated reconciliation or a
background ownership failure. The unrelated Session formatting difference and
two Web content paths remain outside this cut. Read material for this
correction includes the exact run result, Mission Prompt and Panel completion
contracts, persisted Artifact-read and Task-review fact reducers, Project
Memory lease and Organizer drivers, their production entry points and focused
tests, and current Panel/search-native architecture. Whole-repository search
found one Mission completion writer, one Project Memory Organizer driver, and
no alternate acceptance or memory-retry authority. Independent-agent feedback
before implementation is none; an uninvolved read-only review remains required
after the corrected current tree is green.

###### Exact run evidence

The real run used pushed commit
`d51dc38cde73ee36e63338da55b1432e54cfb792`, exact source archive SHA-256
`52CF7C1E0E684163F75A2F3BA538B9A875B02E23A9B66B4C096254FEF50E188F`,
and the separately verified `openai/gpt-5.6-sol` projection. It invoked no
installer and made no dependency download: 237 existing dependency junctions,
46 exact-source workspace targets, 191 external cache targets and the existing
process-supervisor binary were reused. The first launch exposed an assembly
mistake because the isolated source lacked the Rust target cache; it failed
before Provider use and the same exact source was relaunched with
`OPENCORVUS_PROCESS_SUPERVISOR` bound to the existing cached executable. This
is retained as harness evidence and is not a product scheduling failure.

The parseable PASS result is
`D:\myhexin-local\.codex-benchmarks\mission-scheduling-d51dc38cd-20260904-state-snapshot\result.json`,
19,374 bytes with SHA-256
`8FE37500A3CD2400BA70548702825A538CCE0CCBA2152860C318985EE56B5AF4`.
Exactly two Tasks, twelve scheduler events, twelve delivered inboxes, all three
correlated replies, recipient FIFO, semantic order, terminal ordering, both
Task completions, the nonce-bearing final Artifact and durable Mission
completion passed. Every source Tool settled and no Tool occurrence failed.

The trajectory is still not release acceptance. Mission completion took
614,483 ms; the final 175,517 ms elapsed after both Tasks were already
terminal. Mission made 32 Tool calls and 38 Provider calls, accounting for
1,213,437 total tokens including cache reads. The two Task Orchestrators made
20 calls and accounted for another 485,375 tokens. Mission repeated three
Task queries, four Artifact catalog queries and four Artifact reads even though
only two terminal Task occurrences existed. It also used eight
`mission_state` calls and seven `capability_search` calls; the next result must
retain action-level trajectory evidence so a bounded state commit cannot be
confused with an unnecessary snapshot.

The run independently exposed one Project Memory control-plane failure. The
Organizer reported `ProjectMemoryInvariantError` because its organization
lease was stale for revision zero; every later prompt projection remained
`revision=0`, `pendingCount=1`, and `recalled=false`. The final server shutdown
then logged expected runtime cancellation as errors after the checker had
already written PASS. The shutdown messages are observability noise rather
than a Mission failure, but the stale Organizer lease is a real unfinished
background occurrence.

###### Horizontal root cause and single replacements

Mission currently mints complete Artifact-read references during each terminal
Task wake, but `panel_complete_mission` resolves them only inside the current
input occurrence and separately requires a current-Turn `panel_query_task`
receipt. A completed Task's terminal lifecycle reference and every complete
read window are already immutable persisted facts. Repeating both Task queries,
both catalogs and both bodies in the final wake therefore does not protect
against reopen: the completion writer already compares each read's exact
terminal lifecycle reference with the Task's current reference. It only adds a
fixed five-call tail in this two-Task scenario.

The replacement keeps those existing facts as the sole authority. Terminal
Task reconciliation records every Host-minted `artifact_read_ref` emitted by a
complete chunk sequence with the authored stage acceptance in Mission state.
Final completion resolves all Task acceptance sets through one fixed-count
indexed batch reducer from
only those supplied references in earlier completed assistant actions in the
same Mission Session. The supplied chunks alone must prove complete byte
coverage, every read must precede the completion Tool, and every bound terminal
lifecycle reference must equal that Task's current completed occurrence. No
other Session read may fill a gap, so old and current occurrences cannot be
mixed into false completeness. No Task status, Artifact body, locator or
acceptance projection is copied. Reopen makes the old reference ineligible by
the same lifecycle comparison. `panel_complete_mission` still requires the
complete current child set and remains the only durable Mission completion
writer, but the final wake no longer re-queries or re-reads already accepted
immutable evidence or performs one Session-history scan per Task.

Project Memory has a separate lost-redrive race. A Session or Project config
change intentionally advances `availabilityGeneration`, revokes the active
Organizer lease and publishes another organization request. The in-process
driver correctly marks that request as `again` while the old Provider call is
running, but a stale commit throws before the `do/while` condition is reached;
the `finally` block then deletes the scheduled slot and silently discards the
queued redrive. The replacement keeps the durable lease and pending evidence
as sole facts, settles the revoked attempt to `retry_wait`, and lets the same
scheduled owner consume its already-recorded `again` request with the current
configuration. It does not renew a revoked lease, accept stale model output,
drop pending evidence, add a timer, or create a second queue.

Positive verification must prove completion in a later Mission input from
earlier complete reads of the unchanged terminal occurrences, continued
rejection after a real reopen changes that occurrence, exact completion receipt
locators, and Prompt/architecture removal of final rereads. Memory verification
must hold an actual Organizer Provider turn, invalidate its lease through the
production config-change request path, let the stale attempt settle, and prove
the queued second attempt consumes the same pending occurrence into revision
one. Focused tests, package/root typecheck and repository checkers precede one
new exact tree and an uninvolved read-only review. A fresh exact-source real
Provider run must then preserve the functional duplex result, omit the stale
Memory lease failure, and show the reduced Task query/catalog/read tail before
release.

###### Review corrections and current verification

The first uninvolved review of exact tree
`b080a0df4a6e60e211ba46be74c76b21d9ff9cfc` returned `NOT PASS` with two P1,
two P2 and one P3 findings. A Session-wide completeness projection could mix
an old complete read with a current partial read; completion and board replay
also repeated that history projection per Task. A touched config-recovery test
asserted one MCP invocation even though the current peer-convergence owner
correctly retries the committed transition. The completion item schema still
described a same-Turn reference, and Recall named the branch as though it were
the package version.

The corrected reducer accepts only the full chunk-reference sets supplied by
the completion request, requires every chunk to bind the same exact current
terminal occurrence, and computes byte completeness from those chunks alone.
It resolves all Tasks through a fixed-count indexed batch across both inline
Tool outcomes and Permission-owned durable results; query-plan tests prove the
three reference and join-frontier expression indexes. The config recovery test
now proves the production queued peer retry publishes the committed config
change and advances the Organizer generation without a second writer call.
The canonical SDK generator synchronized the Mission completion item and outer
descriptions. Typed process-shutdown cancellation now settles a wake at info
severity while an untyped Provider failure remains an error.

The final affected matrix passed 58 tests with 330 assertions across Mission
completion, Artifact facts, Prompt guidance, trajectory projection, Project
Memory, storage schema and cancellation classification. Root typecheck passed
8/8 workspaces. Repository checks passed for docs (339 operations, 25 groups),
routes (6 rules, 34 files), architecture index (16 documents), package topology
(10 workspaces), control-state ownership (53 tables, 7 allowed fact classes),
control leases (18 owners, 22 acquire sites), release mutation (5 canonical
authorities), public-package publication, and three-component release-family
version `0.0.58-beta`. Exact-index module topology passed with 1,103 modules,
5,537 runtime edges, no retained cycle and four clean imports. Cached and
working diff checks passed. The Session formatting difference and two Web
content files remain working-only and have zero cached intersection. A fresh
uninvolved review of corrected exact index tree
`1714d4696135ff39a063fdd0d1837aa9e5193b29` returned `FINAL PASS`, P0-P3=0.
The reviewer independently reran 44 focused tests with 251 assertions, eleven
storage-schema tests with 76 assertions, and the OpenCorvus package typecheck;
all passed. It confirmed supplied-only occurrence isolation, the fixed-count
indexed reducer including Permission-owned results, current terminal-lifecycle
binding, Project Memory redrive, typed shutdown classification, generated API
alignment, and zero cached intersection with the three working-only exclusions.

###### Post-push exact-source trajectory audit

Commit `029304700c033d754add1d203316611bebfb24b3` was pushed to
`origin/v0.0.55beta` with zero divergence after the complete pre-push hook. The
post-push acceptance source archive has SHA-256
`7057F5ECCE749D8CE94CBAEE014244E653F62850DFD367F1009D53982D6B2A63`.
It again reused 46 exact-source workspace dependency targets, 191 existing
external cache targets and the existing process-supervisor executable; no
installer or dependency download ran. One first launch failed before scheduling
because the old isolated OAuth authority had expired and its refresh settled as
an uncertain exchange. A second isolated authority copied the already-valid
current OAuth authority and its separately verified canonical `models.json`;
credential contents were never logged or persisted in this record.

The retained second-run root is
`D:\myhexin-local\.codex-benchmarks\mission-scheduling-029304700-20260904-postfix-r2\temp\opencorvus-mission-task-duplex-e2e-gpaxUS`.
The requested model and actual Provider model were both
`openai/gpt-5.6-sol`. Both Tasks completed, all twelve scheduler events reached
their twelve inboxes, all three correlated replies preserved order and
identity, terminal ordering passed, Project Memory advanced to revision one,
the final interactive Artifact was ready, and the Mission durably completed.
The checker correctly returned nonzero because one of 52 Tool occurrences
failed.

Read-only database inspection proves two independent trajectory defects and
one checker defect. First, the initial `panel_create_task` request supplied the
schema-foreign `allow_create_task` field plus null-valued optional fields. The
strict Tool rejected it and the model immediately repeated the same semantic
creation successfully. Whole-repository search found no `allow_create_task`
definition or guidance; the actual optional parameter is `allow_create`.
Therefore calling that field "obsolete" was not supported by evidence. The
shared schema's optional knobs may contribute ambiguity, but that causal claim
is not proven and does not authorize deleting valid Mission/channel inputs.
This cut preserves their semantics and adds production Provider-schema execution
coverage for minimal Mission creation and explicit schema-invalid input. The
corrected real run must still prove one successful creation occurrence per
child, with no failed Tool. A repeated failure requires further actual Provider
input investigation, not a compatibility alias or an inferred new API.

Second, the Mission did persist the first complete read references
`ar_nQouZUa5WyyJtoUt` and `ar_LQZWdLvvckWZZmqs` in both `tasks.md` and authored
acceptance state. It nevertheless performed a final extra Task query, two
extra catalog queries and two extra reads and completed with newly minted
references. The direct trigger is not the production reducer or prompt: the
E2E request itself still says to re-query both Tasks and bind evidence from the
final physical Turn. That stale request contradicts the current architecture,
which requires retained immutable references and prohibits rereading an
unchanged accepted occurrence. The E2E request must state the current contract,
and its acceptance predicate must positively require exactly one terminal
query/catalog/read chain per child Task rather than merely serialize counts for
later inspection.

Finally, graceful server settlement passes a plain cancellation `Error` through
the runtime execution reservation. `SessionWake.loopFailureDisposition`
recognizes typed cancellation values but not the exact plain object stored in
the reservation's aborted signal, so seven expected wake settlements are logged
as failures during checker cleanup. Exact object identity between the rejected
operation and its aborted-signal reason is sufficient cancellation authority;
an unrelated error remains a failure. The correction will add that exact
identity branch and a positive classification test without message matching or
a shutdown-specific fallback.

Verification for this correction must prove the exact Mission create Tool
schema, one successful creation occurrence per requested child, exactly two
Mission terminal query/catalog/read chains, completion from the earlier
retained references, and expected shutdown cancellation classification. It must
then pass focused tests, package typecheck, one uninvolved read-only review, a
scoped commit and push, followed by the same cache-reusing exact-source real
Provider Mission run. Independent-agent feedback before implementation is none.

Implementation preserves the production Mission evidence reducer and all
creation parameters. Minimal Mission creation passes the actual
`SessionLoop.prepareProviderTool` execution boundary; the unknown field produces
the existing `InvalidToolInputError`. The checker now records a typed
`accepted`/`trajectory_mismatch` projection for its bounded single-decision
per-Task case: one query, catalog and complete read per Task, exact read-reference
reuse, causal query-to-read-to-publication-to-completion order, two creation
occurrences and one final publication/completion. A durably completed Mission
with settled terminal replies and final evidence immediately reports an
irreversible failed-Tool or reconciliation mismatch instead of waiting another
inactivity interval.

The first affected verification passed 19/19 tests and 50 assertions for the
Provider input contract, trajectory and cancellation classification. The
runtime-settlement file exposed a pre-existing stale fixture: it appended a
Task aggregate event without creating that Task, violating the current Protocol
foreign-authority check after the database gate reopened. The fixture now uses
a real persisted Session aggregate while preserving both the exact database
admission error and successful post-gate append contract. The whole file then
passed 16/16 tests and 30 assertions, including the real server settlement reason
flow. No production Protocol authority or Panel input schema changed.

The complete affected six-file matrix subsequently passed 41/41 tests with 118
assertions in 42.17 seconds. OpenCorvus package typecheck exited zero, docs
passed at 339 operations/25 groups, and working diff validation passed. A
read-only replay of the retained real run through the new reconciliation
projection returned `trajectory_mismatch`, with three creation attempts and
two queries/catalogs/reads for each Task, matching the manually audited facts.
The current candidate still requires independent read-only review and the
complete normal pre-push hook before delivery; none of these deterministic
results constitutes the required fresh real Provider acceptance.

The independent review of `0832345f1f716cc22154e14d8eeb5555641772e9`
found one P2 and one P3, both in the checker: its captured Tool snapshot can lag
the later awaited Mission projection, and the new reconciliation field was
missing from the explicit evidence type and final result serialization. The
reviewer independently passed 35 tests with 80 assertions and found no additional
production wake or ownership defect. Corrections require the projection's exact
completed Tool Part to exist in the captured snapshot before classifying a
terminal mismatch; an earlier snapshot is explicitly `pending_completion` and
the next settled snapshot becomes `accepted`. The projection is now present in
both the typed evidence and final `trajectory.reconciliation` report. Positive
tests cover running-to-settled and newer-completion identity observations. The
real checker script is also included explicitly in a TypeScript program check,
because the normal package configuration excludes scripts.
The corrected complete six-file matrix passed 41/41 tests with 120 assertions
in 45.60 seconds; the explicit script-inclusive TypeScript check is still
running and is not yet claimed green.
That check completed with seven diagnostics in the checker closure: a recovery
callback returned a non-void value, progress-key input omitted its declared
Tool collection, old scheduler assertions accessed unknown Tool input, the new
helper assumed every Tool input/time was materialized, and the existing custom
Error lacked `override`. These are now corrected at the exact call/type
boundaries. Node-hosted TypeScript semantic and syntax checks for all three
checker modules report zero diagnostics; the package source was separately
typechecked. Snapshot/duplex-contract verification passes 8/8 with 27 assertions.
An uninvolved re-review already returned zero findings for the snapshot/report
corrections; these final script type refinements still require its focused
confirmation before commit.

That focused independent review returned `FINAL PASS`, P0-P3=0, for exact
staged tree `e05193030346ec28397c374f1ab74ed3b60e1caa`. The reviewer
independently reran the eight snapshot/duplex-contract cases with 27 assertions,
confirmed the type refinements and preserved exclusions, and made no changes.
This paragraph records the completed review only; production and checker
behavior are unchanged. Fresh real Provider acceptance remains required after
the normal scoped commit and push.

### 2026-09-04 exact-source real acceptance and remaining diagnostic boundaries

The correction was delivered as `a97eed21233bc0d50a04a98e5fdab9ccd84b107e`
and pushed to `origin/v0.0.55beta`, with zero ahead/behind after fetch. Its normal
hook passed root typecheck (8/8), routes (6/34), docs (339/25), control leases
(18/22), architecture (16), package topology (10), release mutation (5), module
topology (1,103 modules/5,537 edges/zero retained cycles/four clean imports),
and zero secret-scan findings. The three unrelated working-only exclusions
were preserved.

The first exact-source launch used an older isolated credential copy. Although
its expiry was in the future, the actual Provider returned HTTP 401 with an
invalidated OAuth token before creating a Task. Checking expiry and model
catalog alone had not proved usability. After that process naturally exited,
the current authorized credential was copied into a new isolated authority,
with the exact model catalog copied and checked independently. A minimal
streaming request returned HTTP 200, completed text and response model
`gpt-5.6-sol`. The formal credential/configuration was not modified. Both
launches reused the same source archive, 237 existing dependency links and
cached supervisor; no install, download or compilation was run.

The subsequent real run's evidence root is
`D:\myhexin-local\.codex-benchmarks\mission-scheduling-a97eed212-20260904-retained-refs-r2`.
`authority-preflight.json` records the credential usability/model check without
secrets. `result.json` reports `ok: true` for Mission `303aa45c8366b88c`, actual
model `openai/gpt-5.6-sol`, exactly two child Tasks, 12 delivered scheduler
events/inboxes, three correlated replies, correct recipient FIFO and semantic
order, and both terminal notifications after the Tasks' DONE facts. All 47
Tool occurrences succeeded. Reconciliation is `accepted`: each child has one
query, one catalog, one complete read, and the original Host-minted reference
is accepted at completion. Publication and Mission completion each occur once.
The observed duration to durable Mission completion is 639,444 ms; 175,330 ms
of that follows the last child terminal event. Provider usage is 923,342 total
tokens for Mission (including 540,288 cache-read tokens), 499,996 for the two
Orchestrators (including 204,672 cache-read tokens), and 3,413 for Memory.
These are transport-accounted totals, not all newly processed input tokens.
The process naturally returned zero and removed its own temporary runtime.

This passing core-chain evidence is retained, not superseded merely because
additional observations remain. The final log contains one typed
`ExecutionCancellationError` in `session.processor` at 14:10:53.615 UTC, with
origin `process.shutdown`; durable Mission completion was at 14:10:53.144 UTC.
The checker starts cleanup as soon as its completion/evidence predicate passes,
without proving that the final assistant stream has settled. The production
processor logs every caught failure at error severity and persists its existing
typed cancellation outcome. No wake-loop failure was reported. This proves an
incomplete checker teardown boundary, not another failed duplex chain or failed
Task. The next correction must wait for the actual final Prompt/assistant
settlement before claiming a clean final response and closing the server; it
must not hide the log or weaken cancellation/physical ownership semantics.
The captured `trajectory-observation.json` is explicitly an incomplete,
read-only pre-completion snapshot, not a replacement for the final result.

The historical MCP supervisor incident also remains unclosed. Fresh current-
source checks passed Catalog 18/18 (52 assertions), Catalog/native Mission/
reveal 41/41 (113), and supervisor/terminal Panel/Catalog 37/37 (119). The last
combination used the existing source-fingerprinted
`runtime-889b1c65a33a506f` helper. A passive, test-only child-process observer
then captured three focused long-call/listChanged executions: 3/3 (9 assertions),
each MCP helper exiting with code zero, null signal and empty stderr after
stdin closure. No production source was modified for these observations.

Independent read-only review confirmed the historical directory retained only
helper/ready/request facts for request
`c4aa50eb-957f-4849-bb73-bc8183cae69b`. The old log lacks raw helper exit code,
signal and pre-exit stderr, so the trigger is unknown. Live ownership correctly
rejects missing physical settlement proof; startup recovery separately requires
exact prior owner/helper death and the helper's kill-on-close Job ownership.
The difference is not evidence of two settlement writers. Repeated in-process
disposal propagates the same rejected handle, which explains the observed
cascade but does not identify why the helper exited. Green reruns do not close
that historical incident. The next diagnostic is an instrumented, isolated
helper-death/real-successor crash cut, not repeated undiagnosed aggregates or
relaxed marker validation.

Release is not complete. Read-only remote inspection found occupied tags
`v0.0.56-beta`, `v0.0.57-beta` and `v0.0.58-beta`, while current source version
is `0.0.58-beta`. The original requested 0.0.56 beta cannot be rebound to this
source without rewriting an existing immutable identity. Version direction has
been requested from the user; no tag, Release or website deployment was changed.

### Final-response settlement correction — Recall and implementation plan

The user still requires the complete Mission trajectory to finish without an
anomaly before release, while retaining already proven work and reusing caches.
The directly observed trigger is checker cleanup 471 ms after the completion
receipt, while the Provider is still streaming the final assistant response.
The existing predicate proves domain completion, tool/evidence success and
earlier terminal-notification replies, but not settlement of the physical
response carrying the final completion. Production `SessionProcessor` correctly
persists the cancellation it receives from `Server.stop`; muting that log would
not fix the premature shutdown.

Read/search scope: the checker and all callers/tests of its final-evidence
projection; `SessionStatus` exact input-generation lifecycle; Prompt state
ownership/wait APIs; `SessionProcessor` assistant completion; and the Panel
completion receipt. No public route, schema, durable table, scheduler queue,
retry, Project capacity, Prompt owner or UI implementation changes are needed.
Task and Mission event/retry/terminal checks remain unchanged. The issue is a
read-only acceptance boundary in this isolated checker, not a new production
scheduler mechanism. Independent feedback confirms the previous core-chain
evidence remains valid, but full-response settlement was not established.

The final-evidence projection will additionally require the exact completion
assistant to be durably finished, every assistant of its exact input occurrence
to be finished without an error, a successful stop response at or after that
completion assistant, and the actual `SessionStatus` for that same input to be
idle or successfully terminal. A missing/earlier/other-input observation remains
pending; an actual failed response is explicit failure. The checker will keep
its existing bounded activity loop until these conditions hold, then capture
the final usage and response identity before cleanup. A retained standby Prompt
owner is not itself failure: the physical execution lifecycle, not owner-slot
existence, determines readiness. No sleeps, new completion facts or host-side
workflow decisions will be added. Cleanup failures retain the diagnostic root.

Positive verification will cover receipt-before-response, streaming/retry,
settled stop response, wrong input generation, earlier stop response and typed
failed response. At least one check will use real persisted Session Messages
and the real execution lifecycle rather than only manually prepared booleans.

Implementation verification: the snapshot and duplex-contract files passed
9/9 tests with 36 assertions, including real persisted assistant Messages and
the exact Session execution lifecycle. A TypeScript program using the package
configuration plus both checker script entrypoints returned zero diagnostics.
No production source, dependencies, generated payloads or native binaries were
changed. Independent review and a fresh real final-response/cleanup observation
are still required; the previous real core-chain pass remains valid evidence.

Independent review returned FINAL PASS, P0-P3=0, on implementation tree
`1cd295e755e4cb0e4c4fac69b22b8fcee2418b83`; its independent rerun also passed
9/9 with 36 assertions. Docs validation passed 339 operations/25 groups.

A separate isolated Windows helper-death observation then exercised the real
default process-instance observer, without a constant test observer or changing
production code. Evidence is retained at
`D:\myhexin-local\.codex-benchmarks\mission-scheduling-a97eed212-20260904-retained-refs\helper-death-ugSGvk\evidence.json`;
the parent directory's `helper-death-recovery.mjs` is the diagnostic runner. Its first
two launches exposed harness setup errors (missing test process-root isolation,
then listener readiness preceding Bun server startup); both were corrected
before the successful observation, not classified as production failures.
The successful run injected death only into its exact test-owned helper,
observed the expected missing-settlement error and retained live registry owner,
and kept the helper/ready/request records. A real peer inspected one request
and retained that live owner. After the exact test owner was killed, a fresh
successor inspected and removed precisely one request, with zero unknown or
quarantined requests. Rebinding the exact target port proved physical listener
release. This used the cached source-fingerprinted native helper; no build or
installation was performed. It establishes live-owner retention and actual
successor recovery after helper death, but does not reconstruct the unknown
trigger of the older incident. Final real Provider response/cleanup acceptance
remains outstanding.

### 2026-09-04 final-response acceptance delivered

The checker correction was independently approved at tree
`b320616c692ea399140de813cbd4342277251508` and delivered as
`7a2fc56f8473462fb870b8116bac8d843296c2e5`. Fetch/merge found no upstream
changes; the complete outgoing set contained only this reviewed four-file
commit. Normal push checks passed root typecheck 8/8 (seven cache hits),
routes 6/34, docs 339/25, control leases 18/22, architecture 16, package topology
10, release authorities 5, exact-source module topology 1,103/5,537/zero cycles/
four clean imports, and secret scan zero. A fetch in the main checkout verified
zero ahead/behind. The archived source is intentionally not a Git checkout;
initial Git verification commands there failed and were rerun successfully in
the main checkout, without restarting the already-running acceptance.

Real Provider acceptance used this exact commit, archive SHA-256
`401630aa425fd848f89565900432223a0ea2ab20fd4cda82bd375bdfc8e63051`,
237 reused dependency links, the cached source-fingerprinted native helper, and
a separately verified current credential/model catalog. Its streaming authority
preflight returned HTTP 200 and exact model `gpt-5.6-sol`; no formal credential,
dependency installation, download or native compilation was performed.

Evidence root:
`D:\myhexin-local\.codex-benchmarks\mission-scheduling-7a2fc56f8-20260904-final-response`.
`result.json` SHA-256 is
`0e6553a84c238a8d9d197ca88001a601742da5e41966b07b1c54393a79046374`.
The process naturally exited zero. Mission `3b37557459fe202e`, actual model
`openai/gpt-5.6-sol`, produced exactly two child Tasks, 12 exact scheduler events
and delivered inboxes, three correlated replies, correct recipient FIFO and
semantic order, and terminal notifications after DONE. All 48 Tool occurrences
succeeded. Each child was queried once, catalogued once, read once and accepted
using the same Host-minted read reference. Publication and completion each
occurred once.

The final response `msg_g0VUGOOfv00VPDyOwJrv` settled at
`1788533532101`, 8,138 ms after the completion receipt. Only then did the checker
accept and clean up. The full log contains zero error-level records, no final
response cancellation error, and completes both server and database cleanup;
the isolated temporary directory is empty afterward. This closes the concrete
premature-checker-teardown defect; previous core-chain evidence remains valid.

Duration was 671,024 ms to the Mission receipt and 679,162 ms to the settled
final response; last Task terminal to receipt was 165,623 ms. Usage totals were
Mission 1,084,177 (including 630,400 cache-read), Orchestrator 481,890 (including
197,120 cache-read), and Memory 3,480. These include cached transport-accounted
tokens and do not establish a performance improvement.

Full-goal boundary: this passed Mission protocol/response/cleanup case is not a
substitute for the older four-case Light consulting acceptance. Read-only review
of its task and evidence found only the pre-correction `34ab15e9` real results;
the subsequent typed-ref/Light implementation tests do not supply a fresh real
four-case result. That acceptance must be rerun with the original cases/budgets,
current package identity, exact model and corrected clarification accounting.
The historical helper's original exit trigger remains unknown, although its
actual live-peer/dead-owner recovery contract is now demonstrated above. No
Release, tag or website deployment has been changed.
Then run focused checker contracts, explicit script typechecking, docs/diff
checks and independent review; commit/push the scoped correction and perform
the final cache-reusing real Provider run after the remaining diagnostic work
is settled. Prior successful chain evidence is not discarded.
