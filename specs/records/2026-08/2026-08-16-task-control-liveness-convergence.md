# Task-control liveness convergence

## Recall

- User request: the scheduler keeps hanging and looping after the state system was trimmed; analyse the multi-agent scheduling pain points and wrong abstractions, and deliver a mathematically complete scheme plus the repair.
- Incident bundle: `task:tsk_g00VSNnNmV009A6KHQ0K` ("开发俄罗斯方块网页游戏"), status `active`, four accepted epoch-1 ingresses, sequences 3 and 4 reduced to `ready` with `activations=0`, both Orchestrator occurrences `idle`, no process incident and no abnormal terminal.
- Observed database facts (`opencorvus.db`, read-only copy):
  - sequence 1 (`task` source) activated at 16:17:28 and resolved with three sibling `dispatch_agent` receipts;
  - sequence 2 (`agent.execution.lifecycle` for the first worker Session) activated at 16:19:13 and resolved at 16:20:32 with `no_action`;
  - sequences 3 and 4 (lifecycle events for the second and third worker Sessions, accepted 16:19:25 and 16:20:29) have **zero rows** in `engine_control_activation_lease`;
  - the sequence 2 lease expiry `16:21:54` equals one 40s renewal past its 120s grant, so its activation was still live when sequences 3 and 4 were accepted;
  - across the whole database only this Task has unactivated ingresses, and no `task_root_ingress` target has more than one lease, so the fault is a lost wake rather than a retry storm.
- Acceptance criteria:
  - an ingress accepted while the FIFO head holds a live activation is activated once that head resolves, with no operator input and no restart;
  - reduction, FIFO fencing, lease fencing and epoch fencing keep their existing authority;
  - a Task whose scan faults cannot starve a sibling Task and cannot spin;
  - concurrent reconcilers keep converging on one physical activation;
  - focused positive tests, typecheck and documentation checks pass.
- Hard constraints: no durable delivery status, no second queue, no mutable projection write-back, no prose parsing, no synthetic decision. Preserve every unrelated dirty-worktree change from the concurrent runtime-occurrence work.
- Read material: `specs/current/architecture/task-control-plane.md`; `2026-08-15-task-root-fact-reduction-kernel.md`; `2026-08-15-task-root-parallel-decision-lock-convergence.md`; the Task-root reducer, fact store, reconciler, Orchestrator loop and project bootstrap.

## Root cause

`2026-08-15-task-root-parallel-decision-lock-convergence.md` repaired the *safety* half of this incident class: one assistant Turn owning three `dispatch_agent` receipts is one atomic decision set, so the creation ingress no longer reduces to `blocked/integrity_conflict`. The present incident reproduces the same visible symptom with that repair working correctly — sequences 1 and 2 both reduce to `resolved`. What remained unrepaired is the *liveness* half, which the architecture never stated and the implementation therefore never had.

`reconcileTaskControlPlane` was a one-shot, edge-triggered scan over a work set captured before its longest `await`:

1. the pass that accepted sequence 2 read the epoch ingress list `[1, 2]`, then blocked inside `activate` for the whole Orchestrator Turn;
2. the passes triggered by accepting sequences 3 and 4 found the FIFO head leased, set `stopTask`, and returned — correct fencing, but they left no durable or runtime trace of their demand;
3. when the sequence 2 activation completed, its owning pass re-projected sequence 2, found `resolved`, advanced its **stale snapshot** `[1, 2]`, found it exhausted, and returned.

No edge remained. "The FIFO head became resolved" is precisely the transition that enables the next ingress, and it was the one transition that started no scan. Two worker results were stranded permanently.

The abstraction error is that `Queue = Hint(unresolved projection)` was treated as sufficient. A lossy hint is sound only when some independent mechanism re-derives the enabled set; the control plane had none, so every liveness guarantee silently depended on a caller happening to call again after the blocking condition cleared.

## Contract repair

Reduction is piecewise-constant in time between the finitely many instants it reads, so the enabled set can grow only at a fact append or at one of those instants. Both classes are now closed by one process-local liveness coordinate per Task:

1. a monotone revision incremented by every producer;
2. one owner that re-scans while the revision it observed is stale, so a scan always begins strictly after any append;
3. an epoch ingress list re-read on every pass, so a stale snapshot cannot hide an accepted ingress;
4. one timer per settled scan, armed at `taskRootIngressWakeInstant` — the earliest instant that Task's own projections can change.

Requests never join a running scan, because a scan may await an Orchestrator Turn whose Tools re-enter the control plane. A bounded step guard converts a non-decreasing progress measure into timer pacing rather than a hot loop, and a faulted scan is isolated per Task under exponential backoff.

## Implementation and verification

1. `taskRootIngressWakeInstant` added to the reducer as the pure time-transition projection.
2. `TaskControlDriver` added as the single-flight revision fixpoint owner, with injectable clock, timer and project re-entry; timer-fired scans re-enter their owning project through `reenterActiveInstance` so a re-arm cannot read another project's Database.
3. `reconcileTaskControlPlane` split into `scanTaskControlPlane` (one pass, re-reading its work set) plus driver routing; a single-Task request still reports its owner's first-pass fault, a project-wide request isolates each Task.
4. `test/task-control-liveness.test.ts` reproduces the incident directly: the runner for the head ingress accepts a second ingress and issues the blocked concurrent request before committing its decision.
5. Focused evidence: liveness 6/6, Task-control reconciliation 5/5, reducer 10/10, fact store 3/3, dispatch-agent managed lifecycle, Task wait fire identity and Orchestrator initial render all pass (30/30 across seven files). `packages/opencorvus` typecheck passes.
6. Falsification evidence: forcing the driver to a single pass reproduces the exact production projection — one activation, second ingress left `ready` — proving the test detects the original defect rather than the new code.

## Status

- Root-cause implementation complete and covered by a regression test that fails against the previous behaviour.
- Not addressed in this change, and recorded as open: project bootstrap awaits `reconcileTaskControlPlane()` for every Task, so opening a project blocks on any Orchestrator Turn that reconciliation starts; and a `waiting` ingress with no resume deadline still head-of-line blocks its whole epoch FIFO until an operator answers.
- Three failing tests in the working tree (`engine-interrupted-session-recovery`, `runtime-server-ownership`, `algorithm-batch-one` worktree ownership) belong to the concurrent runtime-process-occurrence work in the same dirty tree and are independent of this change; `listInterruptedSessionEvidence` is absent from `HEAD` as well.
