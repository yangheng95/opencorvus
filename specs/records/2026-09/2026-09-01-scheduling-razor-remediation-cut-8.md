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
