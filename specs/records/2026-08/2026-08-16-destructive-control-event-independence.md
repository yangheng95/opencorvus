# Destructive control event independence

## Recall

### User requirement

The supplied Task and Chat debug bundles show that archive/delete can be rejected after a Provider stream is interrupted. The corrected product requirement is stronger than repairing that one incident: **no persisted event may prevent archive or delete**. Provider, Tool, queue, ingress, Task, Mission, and Session facts remain auditable, but they cannot veto an explicit destructive control operation.

### Acceptance criteria

1. A non-terminal Task with an accepted Provider request and no exact Provider outcome reaches one durable `task.cancelled` boundary when archive/delete is requested after its process-local prompt owners have stopped.
2. Task archive sets `engine_task.time_archived`; Task delete appends the durable deletion boundary. Neither operation fabricates an outcome for the interrupted Provider request.
3. Mission archive/delete inherits the same behavior for every bound Task; an unresolved child event cannot reject the Mission operation.
4. Chat archive/delete remains governed by prompt-owner settlement and Session lineage only; message/effect facts cannot become a completion gate.
5. Project delete inherits the Task behavior. Filesystem safety and a proven live process owner remain physical safety conditions, not event-based vetoes.
6. Focused backend verification completes under the existing activity-aware runner. Destructive control retains the current inactivity budgets for physical prompt and ingress settlement.

### Hard constraints

- Preserve exact immutable event history. Do not synthesize a Provider/Tool outcome and do not mutate an incomplete assistant merely to make deletion legal.
- Keep one cancellation implementation. Do not add a fallback archive/delete path or a second state source.
- Cancellation may publish its terminal boundary only after owned prompt/process handles are proven stopped; unknown historical effects may coexist with the terminal Task.
- Do not add, change, or run UI automation. This repair is in the backend control plane.
- Preserve unrelated worktree changes and add a focused positive contract test.

### Sources read

- `specs/current/architecture/task-control-plane.md`
- `specs/records/2026-08/2026-08-10-task-control-responsiveness-and-cancellation-convergence-plan.md`
- `specs/records/2026-08/2026-08-16-task-control-liveness-axioms.md`
- `specs/records/2026-08/2026-08-14-computer-use-scope-and-project-delete-settlement-repair.md`
- `packages/opencorvus/src/task-api/index.ts`
- `packages/opencorvus/src/session/loop.ts`
- `packages/opencorvus/src/server/routes/orchestrator.ts`
- `packages/opencorvus/src/server/routes/mission.ts`
- `packages/opencorvus/src/server/routes/right-sidebar-conversation.ts`
- `packages/opencorvus/src/project/delete.ts`
- `packages/opencorvus/src/engine/state.ts`
- Both user-supplied debug bundles and the referenced runtime logs/database facts.

### Whole-repository search

Searches covered archive/delete definitions and callers, `cancelTaskOnce`, incomplete-assistant terminalization, Provider request/outcome storage, activation fences, Task terminal projection, Mission execution closure, right-sidebar Session closure, project deletion, retry/restart recovery, and existing focused tests. Production entry points reduce to four paths:

| Surface | Control path | Event dependency audit |
| --- | --- | --- |
| Task | orchestrator route -> `setTaskArchived` / `deleteTask` -> `cancelTask` | Fails today because cancellation tries to rewrite an incomplete assistant before publishing `task.cancelled`. |
| Mission | mission route -> `closeMissionExecution` -> every active child `cancelTask` | Inherits the same Task failure and rejects the Mission operation. |
| Chat | right-sidebar route -> close prompt -> `Session.setArchived` / `deleteSession` | Physical prompt settlement is retained; lifecycle publication is excluded from the retention critical path. |
| Project | `deleteProject` -> every Task `deleteTask` -> physical quarantine/row deletion | Inherits the same Task failure; later filesystem checks are physical safety conditions. |

The normal, retry, restart-recovery, serial, parallel, and multi-project paths all converge through `cancelTaskOnce` under a per-Task cancellation authority. Ordinary recovery still owns incomplete-assistant terminalization; explicit destructive control must not use that recovery mutation as a prerequisite.

### Independent agent feedback

The first read-only review found that the narrow Provider fix still left two event gates: Task cancellation published Agent lifecycle/coordination facts before `task.cancelled`, and Mission close drained every scheduler inbox in the Project. It also found that the initial two tests did not prove Mission isolation or auxiliary-event independence. The implementation was expanded to remove both gates and the benchmark now includes a historical Agent lifecycle occurrence whose input Message is missing plus an unrelated invalid Mission scheduler wake. The second review found that Mission abort had accidentally inherited retention-only physical settlement and that the initial Agent lifecycle seed would not have exercised the old failure. Mission abort now retains terminal lifecycle publication, and the stronger missing-input occurrence locks the removed failure path. The final read-only review found no unresolved issues.

## Benchmark contract

### Task definition

Exercise the real Task API with an open Task whose child assistant has a durable Provider request but no outcome, then request archive and delete.

### Input -> qualified output

- Input: root/orchestrator Session tree, open Task lifecycle, incomplete orchestrator assistant, accepted Provider request, no Provider outcome, an invalid historical Agent lifecycle event, and no live process-local prompt owner.
- Archive output: `setTaskArchived(..., true)` resolves, lifecycle projects `cancelled`, and `time_archived` is populated.
- Delete output: `deleteTask(...)` resolves and the Task deletion boundary is durable.
- Audit output: the Provider request remains present and still has no fabricated outcome.
- Mission isolation input/output: archive one Mission while another Mission owns an invalid delivered scheduler wake; the target Mission archives and the unrelated inbox remains auditable.

### Environment

Use the repository's in-memory project/SQLite fixture and production `EngineService` control path. No Provider credential or external service is required. Run focused backend tests through `packages/opencorvus/script/run-tests.ts`, whose wrapper enforces inactivity-based timeout behavior.

### Timeout

The focused runner uses an inactivity timeout rather than a fixed wall-clock deadline. Production cancellation keeps its existing 5-second prompt-settlement and 60-second ingress-settlement inactivity budgets.

### Passing metrics

- 100% of archive/delete benchmark cases resolve successfully.
- Exactly one cancellation terminal boundary is projected per Task.
- 0 fabricated Provider outcomes.
- Focused test, package typecheck, and documentation check pass.

## Root cause and design decision

The direct incident trigger was a supervisor shutdown during a streaming Provider request. The durable request fact therefore correctly has no outcome. Explicit cancellation then called `terminalizeRecoveredIncompleteAssistant`; that attempted to mark the assistant complete, and the activation fence correctly rejected completion because an accepted external effect had no exact outcome. This recovery mutation was incorrectly placed on the destructive-control critical path, so Task cancellation never reached `task.cancelled`; Task archive returned HTTP 500 and Mission archive eventually returned HTTP 409.

The fix removes incomplete-assistant terminalization, Agent lifecycle publication, coordination-event mutation, and Permission-event settlement from explicit Task cancellation/deletion. Physical prompt/process settlement and Task-root ingress owner idleness remain mandatory; once proven, the Task publishes `task.cancelled`. Destructive Session/Mission/Chat paths use the same physical-only prompt settlement mode, while ordinary abort/recovery paths may still publish lifecycle facts. Historical Permission facts remain audit evidence and cannot delay the response after the retention boundary.

Mission close no longer drains the Project-wide scheduler. Its existing Mission execution closure atomically settles target wakes and rejects later non-operator wakes; another Mission or Task's inbox is therefore neither required nor touched. The incomplete assistant, outcome-less Provider request, historical lifecycle event, and unrelated scheduler inbox remain immutable audit evidence. Restart recovery retains its ordinary recovery behavior; there is no alternate archive/delete implementation.

## Impact and risk

- Provider and Tool facts: preserved exactly; no invented terminal result.
- Task/Mission/Project: no longer blocked by historical effect, Agent lifecycle, coordination, Permission, or unrelated scheduler facts once executable owners are stopped.
- Session/Chat: destructive settlement now proves physical prompt completion without requiring lifecycle publication.
- Concurrency: existing cancellation authority and destructive root scope still serialize duplicate archive/delete requests.
- Restart: a cancelled Task is terminal and does not reactivate ingress; unresolved historical effect facts remain inspectable.
- Risk: consumers must tolerate a terminal Task containing an incomplete assistant. The current control-plane architecture already permits exact pre-boundary effects to settle after cancellation, so Task terminality cannot imply message/effect completion.

## Verification record

- `bun script/run-tests.ts test/destructive-control-event-independence.test.ts`: 5 passed. Covers Task archive, Task delete, one exact cancellation boundary, preserved unknown Provider outcome, historical Agent lifecycle evidence with a missing input Message, Mission isolation from an unrelated invalid scheduler wake, Chat archive after a real physical prompt owner settles, and ordinary Mission abort terminal lifecycle publication.
- Adjacent focused suites: Provider activity 1 passed; Task cancellation convergence 2 passed; Mission process recovery 6 passed; Mission durable activity 3 passed; Project directory/deletion and Worktree garbage collection 46 passed.
- `bun run typecheck` in `packages/opencorvus`: passed.
- `bun run docs:check`: passed (333 operations, 25 groups).
- Independent review: final read-only review passed with no unresolved findings after all first- and second-review findings were addressed.
