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
