# Scheduler liveness and control convergence

## Contract

| Field | Value |
| --- | --- |
| Task | Repair confirmed scheduler liveness, ownership, state-projection, retry, and recovery defects without adding a Host workflow gate, fallback scheduler, watchdog state machine, or duplicate source of truth. |
| Input | Exact durable Task ingress, Session lifecycle events, Event Job fires, Task Queue rows, process-local execution owners, current Expert Squad workflow facts, and real provider/backend execution. |
| Qualified output | Every accepted execution occurrence either retains one physical owner, has one durable recovery owner, or reaches an explicit terminal/disposition fact; current lifecycle control sees its exact authoritative outcome; project concurrency is enforced across all Instances; observed progress cannot be timed out before its coalesced durable heartbeat; real checker assertions match current production capabilities. |
| Environment | Repository test preload through `packages/opencorvus/script/run-tests.ts`; real checker through `bun run check:task-control-real` with `TASK_CONTROL_CHECK_ALLOW_REAL_PROVIDER=1`, an explicit `TASK_CONTROL_CHECK_AUTH_SOURCE`, explicit `TASK_CONTROL_CHECK_MODEL`, and explicit supported deployment mode. Credentials are never copied into records or output. |
| Timeout | Focused tests use bounded positive contracts. Long model/backend/checker work uses activity-resetting inactivity windows. No fixed wall-clock deadline may terminate continuously progressing work. Windows cleanup preserves the primary checker result and retries only exact validated temporary-root cleanup after owned descendants settle. |
| Acceptance | Focused regressions, aggregate scheduler/runtime tests, typecheck, build, docs checks, diff/secret checks, the repaired real checker, and a new uninvolved read-only review all pass. |

## Recalled constraints

- `specs/current/architecture/task-control-plane.md`: visible operator status answers are legitimate message settlement and must not require a scheduler mutation.
- `2026-08-10-task-detached-worker-lifecycle-convergence-repair.md`: exact terminal lifecycle publication and event-keyed root wake are already repaired; this work must not reintroduce attached dispatch or duplicate lifecycle delivery.
- `2026-08-11-scheduler-systemic-fault-audit-and-repair.md`: durable claim, physical Promise, admission, rollback, and recovery ownership remain separate authorities; no prompt-owner heuristic may replace them.
- `2026-08-10-task-control-responsiveness-and-cancellation-convergence-plan.md`: real control-plane verification is activity-aware, uses the real server/provider path, and must measure durable ingress and cancellation convergence.
- Scheduler judgment remains in the Orchestrator. The Host may project and validate exact facts, identity, ownership, and transport settlement; it may not infer workflow success from tool names, parse prose into business state, or manufacture a fallback decision.

## Independent audit register

Three independent read-only reviews inspected state/protocol, concurrency/deadlock, and recovery/resilience surfaces before implementation. They agreed that the incident is not a mutex deadlock and not the older lost-terminal-wake defect. It is a semantic lost-progress state: the worker terminal event and wake both exist, but the current Turn can consume the wake using stale nonterminal reasoning and leave `Task=active`, every worker terminal, no pending ingress, no wait, and no root owner.

| Severity | Confirmed defect | Root cause and impact | Repair boundary |
| --- | --- | --- | --- |
| P0 | Exact lifecycle wake can settle transport without semantic progress | The current wake projects event/session/dispatch identity but not the exact terminal status. Queue settlement correctly verifies the assistant receipt only; it cannot become a Host workflow gate. A stale status reply can therefore drain the unique wake. One active orphan also blocks later Tasks in the same directory. | Project the exact canonical lifecycle status/reason/error/summary into the current wake and make execution-control decision obligations unambiguous. Preserve prose-only settlement for genuine operator status questions. Add real model/backend convergence coverage. |
| P1 | Event fire can remain `running` without an owner in the same process | `processFire` claims before its protected block. Preamble failures leave a leased running row; the outer catch only logs and no recovery timer is installed. | Put every post-claim operation under one lease-fenced settlement path. Any nonterminal exit schedules recovery for the same fire ID. Catch admission-close at timer delivery and rely on the existing rollback/reopen recovery authority. |
| P1 | Task Queue concurrency is split by Instance | Capacity uses Instance-local `inFlight`, while primary and managed-worktree Instances can represent the same project. Different Sessions can exceed the configured project limit. | Make the durable claim itself enforce one project-wide running-row capacity predicate. Pending selection uses the same predicate, preventing spin when capacity is full. |
| P1 | Task Queue progress heartbeat races inactivity recovery and fans out unbounded control owners | Every stream delta creates an independent queue-control Promise. A delta can be observed before its delayed DB touch while the old timer cancels the real prompt. | Record a process-local monotonic progress epoch synchronously, coalesce persistence to one owner per Task, and recheck that epoch before inactivity cancellation. |
| P1 | Exact terminal ingress stops self-healing after two failures in one runtime | A runtime-attempt cap returns `delivery_exhausted`; only successor startup scans failed ingress. A long-lived process can remain stalled indefinitely. | Retain bounded immediate attempts, then install one durable-identity retry timer/owner in the current runtime. Runtime shutdown hands the same failed ingress to existing startup recovery; no replacement wake is created. |
| P2 | Fresh Mission acceptance-resume can lose full wake provenance | `missionAcceptanceResume` participates in typed control but is absent from `hasCurrentWakeIngress`, so first materialization can omit reviewed terminal/evidence provenance. | Include it in the single current-ingress projection and add a fresh-Session regression. |
| P2 | Prompt over-gates ordinary operator status input | One section forbids status questions from authorizing implementation, while the decision-epoch section requires every operator input to end in a scheduler tool. | Distinguish conversation-only operator status/diagnosis from execution-control ingress. Only the latter requires a visible scheduling/lifecycle tool decision. |
| P2 | Event recovery timer can throw during admission close | Timer callback calls `enqueueFire` after `scheduler_event_fire` admission closes and before scheduler disposal. | Catch the typed close, retain the same durable fire, and let rollback/reopen or successor recovery re-admit it. |
| P2 | Durable Bus manual retry API lacks occurrence single-flight | The public retry path can bypass normal owned-publication dedupe. There is no current production call, but concurrent future use could double-deliver. | Close the API over the existing occurrence-keyed owner or add a fenced delivery claim and a concurrent positive test. Do not create another receipt model. |
| P1 checker | Real Task-control checker asserts a deleted LSP runtime and masks primary failure with Windows cleanup | Production permanently reports LSP unavailable. A worker can run `tsserver` through supervised shell, but `owners.lsp` can never appear. Cleanup `EBUSY` can overwrite the stage failure. | Assert the current production execution owner/tool evidence, not deleted LSP state. Preserve primary errors, terminate only checker-owned descendants, and retry deletion only inside the validated temporary root. |

No lock-order cycle was confirmed. Existing physical protections for Task loop launch, exact assistant anchoring, detached lifecycle delivery, Automation occurrence identity, cancellation settlement, and runtime handoff remain in force and are regression subjects rather than replacement targets.

## Implementation order

1. Repair current lifecycle/control fact projection, Mission provenance, and decision-epoch wording; add focused prompt/projection tests.
2. Repair Event fire post-claim ownership and admission-close recovery; inject failures at each preamble boundary and verify the same fire ID succeeds.
3. Repair Task Queue project capacity and coalesced progress epoch; verify two Instances at concurrency one and a blocked heartbeat commit at the inactivity boundary.
4. Add same-runtime exact-ingress delayed retry ownership and shutdown handoff coverage.
5. Repair the real checker contract and Windows cleanup without restoring the deleted LSP subsystem.
6. Close the currently unused concurrent Bus retry hazard if its existing API can be made occurrence-single-flight without a second state model; otherwise record it as an intentionally unavailable API and remove exposure only with explicit deletion approval.
7. Run focused and aggregate verification, then the real provider checker, followed by a new uninvolved read-only review.

## Evidence ledger

- Incident Task: `tsk_g019fecb9865a000000000000A7BjS9EeYXOiF`.
- Canonical worker terminal occurrence: `pev_worker_terminal_g019fecbe8849000000000005CmbduqBwIef_007`; status `terminal/completed` for dispatch `dispatch_g019fecba45ee000000000003HmVHXdHq0HKNv`.
- Lifecycle delivery wake: `art_g019fecbe8fe800000000000exDlMFYmC7QV`; reached `drained` with an assistant reply that still described the worker as nonterminal.
- Stable orphan proof: Task active; worker terminal; lifecycle wake drained; no pending/running wake; no scheduled wait; no current prompt owner.
- Merge baseline: `f80a4d30ef2b8dfe1f45eb29bd40e9ed380f5284`.
- Verification results: pending implementation.
- Final independent review: pending implementation.

