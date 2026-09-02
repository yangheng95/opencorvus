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
8. Freeze an exact tree and obtain a fresh, uninvolved, read-only review. Any valid finding invalidates that tree; repeat until P0–P3 are all zero.
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

This work is a later sub-cut. It must not be used to delay the independent B8/B9 deletion/query corrections, and it must not introduce a generic job framework.

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

- Remove every current-architecture claim that `TaskQueueService` exists. The current owners are Task-root ingress reduction/activation and `SessionWake`.
- C2 is closed in current source: the obsolete `18-scheduled-automations.md` no longer exists, while `task-control-plane.md` and `02-data.md` already distinguish Automation and Event. Keep Event as a distinct event-identity domain; the experimental HTTP route and schedule Tool are adapters to the same `EventService`, not parallel implementations. Update only the stale audit ledger claim.

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
