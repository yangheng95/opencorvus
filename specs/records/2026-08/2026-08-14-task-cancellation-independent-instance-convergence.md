# Task cancellation and Workload identity convergence

## Recall

The operator reported that Task `tsk_g00VSF7uqR004Xn6h3zg` could not be actively stopped and supplied an
`opencorvus.debug.v2` bundle plus a desktop screenshot. The requested diagnosis must separate observed facts from
inference, keep unavailable data unknown rather than zero, reconstruct the timeline, identify the direct trigger and
likely root cause with confidence, call out persisted/runtime/rendered contradictions, and propose the smallest
read-only confirmation checks. Because the failure is locally evidenced and the operator asked to address the
exposed problems, this delivery repairs and verifies both the shared cancellation mechanism and the two distinct
Goal Workload publication identity defects recorded in the same Task.

Acceptance requires:

- the public cancellation request may return an accepted receipt without leaving convergence inside the accepting
  HTTP request's Project Instance lease;
- cancellation retains one durable request, one process-local joined operation, the existing convergence heartbeat,
  physical Prompt/queue settlement, and one terminal `task.cancelled` transaction;
- a positive focused test closes the accepting Instance lease before late cancellation work continues, then proves
  the Task and its checkpoint reach the durable cancelled contract;
- cold Project bootstrap resumes a durable pending cancellation without recursively acquiring the same initializing
  cache entry;
- Goal Workload publication accepts the production Task-root -> Orchestrator -> analyst Session topology, while the
  exact analyst parent and dispatch identities remain authoritative;
- coordination redispatch records one continuation source in both dispatch lineage and Worker Turn descriptor;
- the audit covers every production `cancelTask` entry, startup reconciliation, Task/Mission/Session execution
  occurrences, normal and terminal paths, retry/restart recovery, concurrent callers, and project isolation;
- focused non-UI verification, documentation checks, full-diff inspection, and an independent read-only Agent review
  complete before commit and push.

Hard constraints read from `AGENTS.md`: analyze before editing; use current architecture records as authority;
preserve unrelated dirty changes; add a focused positive non-UI test; do not run UI automation; update both spec
indexes; commit every owned modification and merge upstream before automatically pushing.

Read evidence and sources:

- the supplied debug bundle and screenshot;
- `C:/Users/hengu/AppData/Local/opencorvus/log/2026-08-14T050137-19964-1.log`;
- `specs/current/architecture/task-control-plane.md`;
- the 2026-08-10 cancellation, 2026-08-11 debug-bundle, and 2026-08-12 evolution records;
- the Task cancel route, Task API, Instance ownership, cancellation scope/lifecycle/status, Session Prompt state,
  Goal Workload publication validator, coordination redispatch assembly, and focused test sources;
- every repository definition and production call site found for `requestTaskCancellation`, `cancelTask`, pending
  cancellation reconciliation, cancellation projection, and terminal cancellation publication.

Full-repository search result: the Overlay/API route calls `requestTaskCancellation`; Mission close, Task lifecycle
tools, panel child cancellation, archive/delete helpers, and startup recovery converge through the same
`EngineService.cancelTask` implementation. There is no second Task cancellation implementation. Startup calls
`reconcilePendingTaskCancellations` from Project bootstrap. The older evolution record already describes the same
closed-lease defect and intended repair, but the current implementation and tests did not contain it. Goal Workload
publication has one relational validator and one dispatch-lineage source. Production coordination redispatch derives
the same logical continuation source twice, but only projects it into the Worker Turn descriptor.

Independent Agent feedback after first verification found and caused repair of a cold-bootstrap recursive Instance
lease deadlock in the initial design. It also identified stale specification wording, stray cancellation debug output,
a concurrent operator-cancel/Project-delete admission risk, a missing Project boundary in the Workload ancestry query,
and an insufficient coordination wiring test. Each finding is incorporated below; final re-review is pending.

## Evidence, timeline, and diagnosis

### Observed facts

- The Task was created at `04:42:34Z` and remained durably `active` with no completion time or terminal event in the
  debug projection generated at `05:18:23Z`.
- Cancellation request `pev_g0VSFGfa000bo8kw66x5` was persisted at `05:17:20Z` with actor `user`, source
  `task.cancel`, surface `overlay.composer_stop`, and the supplied request identity.
- The two active workers and root Orchestrator occurrence emitted abort evidence and terminal `aborted` lifecycle
  facts between `05:17:20Z` and `05:17:22Z`. No post-terminal execution activity appears in the supplied bundle.
- The production log records `owner_acquired`, `session_cancellation_requested`, `task_queue_idle`, and
  `session_prompts_settled`, then `Cannot access instance context through a closed instance cache lease:
  d:\\myhexin-local\\demos\\long-absa-task` at `05:17:22.224Z`.
- Recovery repeatedly acquired the same durable cancellation occurrence and failed after `session_prompts_settled`.
  It never logged `incomplete_assistants_terminalized`, `agent_lifecycle_published`, `root_wake_queue_idle`, or
  `terminal_committed` for this Task.
- The bundle therefore consistently exposes a cancellation request without a terminal event, while the Task remains
  active and the three live-at-request execution occurrences are already aborted.

Unavailable and therefore unknown from the supplied bundle alone: the exact JavaScript stack, in-memory lease
identity, whether the desktop process later restarted, and the present state of the external demo Task. None is
treated as zero or as evidence against the logged failure.

### Direct trigger and root cause

The direct trigger is the `202` cancellation route returning its accepted projection while the unawaited
`cancelTask` operation continues. `requestTaskCancellation` starts `cancelTask` in the HTTP handler's inherited
Project Instance context. Once the request finishes, that lease closes. The continuation still carries the inherited
asynchronous context; `provideActiveTaskRootSessionInstance` sees a nominal `Instance.current()` and executes its
callback directly. A later Project-bound read or publication asserts the inherited authority and throws.

Confidence is high: the real stage boundary matches the control flow; the thrown message is the explicit Instance
closed-authority assertion; retries reproduce the same boundary; and the 2026-08-12 record independently documents
the same chain. Historical `idle` Orchestrator occurrences are persisted execution history, not the blocker: physical
Prompt and queue settlement already completed before the error.

The root defect is ownership, not cancellation classification. A convergence operation allowed to outlive the HTTP
response does not own an independent Instance lease. Existing tests keep their outer test Instance alive while
awaiting convergence and miss this boundary. The older record stated the repair but current code and test history did
not retain it, so the production defect recurred.

The first two Goal Workload failures are a separate relational-validation defect. The durable Task root is
`ses_-zUXkrxTzzzKCOHwEk45`; its child Orchestrator is `ses_-zUXkruxKzzt2DpPnoEq`; the Workload analyst is a child of
that Orchestrator. The validator's error says "does not descend", but its implementation requires the Orchestrator to
equal the Task root. The supplied production topology is valid and the equality check is false.

The later `worker_turn_descriptor_mismatch` is a second persisted identity contradiction. The coordination
redispatch Worker Turn descriptor marks a continuation and names its source dispatch, while dispatch lineage stores
the coordination action but omits `continuation_of_dispatch_id`. The tool computes the coordination source for the
descriptor but only forwards an explicit `prior_dispatch` source into lineage. Confidence is high because both facts
for the failed dispatch are present and the production assembly has the exact split derivation.

The infrastructure interruption at `05:00:08Z` proves that an earlier backend process ended while one execution was
streaming. The supplied evidence does not establish why that process ended, so its cause remains unknown. Recovery
subsequently resumed execution; it is not treated as zero activity or folded into either identity defect.

### Contradictory state planes

- Persisted Task: `active`, cancellation requested, no terminal cancellation event.
- Runtime execution: active root and worker occurrences are terminal `aborted`; Prompt and queue cancellation settled.
- Rendered UI: the desktop keeps the Task spinner after Stop, agreeing with the active Task projection but hiding that
  physical executions stopped and convergence is repeatedly failing.
- Historical execution: ten earlier Orchestrator occurrences remain `idle`; this is misleading under a `nonterminal`
  debug label but is not current physical ownership evidence.
- Documentation at the incident revision: the 2026-08-12 record says the repair was preserved, while production code starts
  `cancelTaskOnce` directly in caller context and lacks the required lease-boundary test.
- Workload relation: persisted Session ancestry is Task root -> Orchestrator -> analyst, while the validator renders
  the valid descendant as unrelated because it implements equality rather than ancestry.
- Workload continuation: the descriptor persists `kind=continuation` and a source dispatch, while lineage for that
  same dispatch persists no continuation source.

### Smallest read-only checks

1. Filter the exact backend log by Task and request event. `session_prompts_settled`, then the closed-lease error,
   without `terminal_committed`, confirms the boundary.
2. Read the Task row, cancellation-authority row, and protocol event chain. `time_completed IS NULL`, a present request
   authority, and no linked `task.cancelled` event confirm the persisted contradiction.
3. Read lifecycle events for the three active-at-request input Message identities. Terminal `aborted` facts confirm
   physical cancellation succeeded before Task terminalization failed.
4. Inspect the incident revision's `requestTaskCancellation -> cancelTask -> cancelTaskOnce` path and Instance
   assertions. An independent initialized lease around the accepted operation would falsify the source diagnosis;
   the incident revision has none.
5. Query the recursive Session parent chain for each failed producer and compare the Orchestrator identity; this
   confirms or falsifies the relational-validator diagnosis without writing data.
6. Read dispatch lineage and Worker Turn descriptor for `art_g0VSFFkbx00PiW2G77zq`; equal continuation sources would
   falsify the coordination-redispatch diagnosis, while the observed missing lineage field confirms it.

## Shared-mechanism audit and design

`cancelTask` is the single convergence primitive. Only the public `202 Accepted` entry creates an operation in
`runWithInitializedIndependentProject`, using the exact root Session directory from `taskCwd(taskID)`. That primitive
exits caller database and Instance contexts, acquires a fresh initialized lease in the same canonical Project cache
entry, and holds it until convergence settles. Ordinary awaited callers retain their current owner; startup recovery
must do so because Project bootstrap already holds the initializing cache-entry lease. Duplicate callers still join
`cancellationOperations`; project checks happen before creating the operation; terminal idempotency remains unchanged.

The joined operation retains mutable destructive authority only for Project deletion admission. If an operator-owned
cancel is already in flight when deletion joins it, the join promotes the operation with the deletion admission and
late Project-bound publications resolve that admission at use time. This preserves one convergence operation without
letting Project deletion depend on caller ordering.

Goal Workload relational integrity uses a recursive, cycle-safe, Project-bound Session traversal from the Task's
persisted root and requires the lineage Orchestrator to be in that tree. The existing exact analyst-parent check remains. Coordination
redispatch resolves one `sourceDispatchID` and passes it to both `createDispatchLineageOrigin` and `DispatchTurnSchema`,
removing the split source of truth.

No fallback, compatibility path, status source, retry policy, timeout change, or Host workflow gate is added.
Task/Mission/Session occurrence cancellation and lifecycle publication stay in their existing functions. Normal
completion and non-cancellation terminal paths do not enter `cancelTask`. Project deletion keeps its separate deletion
admission path. Concurrent Tasks acquire their exact directory-bound leases and remain project-isolated.

The cancellation regression test pauses at the existing late-stage hook, obtains the accepted projection inside one initialized
Instance callback, returns so the accepting lease closes, then releases the pause. The positive contract requires the
same operation to reach durable `cancelled` and its cancelled checkpoint to settle.

A second cancellation test disposes the cache after persisting an accepted request and invokes the real
`InstanceBootstrap`; successful terminal convergence proves startup does not self-deadlock. Workload tests publish
through a production-shaped Task-root -> Orchestrator -> analyst tree and assert coordination continuation source
agreement.

## Verification plan

- Run the focused cancellation test with the new lease-boundary case, then the focused cancellation file.
- Run OpenCorvus typecheck, documentation checks, and `git diff --check`.
- Inspect only owned diffs while preserving pre-existing dirty files.
- Request the mandatory independent read-only Agent review after first green verification; repair valid findings and
  repeat affected checks and review until no finding remains.
- Commit only owned files, pull and merge upstream, audit the complete outgoing commit set, rerun necessary checks
  after any merge, and push the current branch.

## Acceptance state

Implementation, focused positive tests, aggregate checks, and the final independent read-only re-review are complete
with no unresolved findings. Git delivery follows this accepted record.
