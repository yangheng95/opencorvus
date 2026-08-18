# Task-root Host fault releases head-of-line order

## Recall

- User request: unattended mode — proceed with the deletion-led minimal-Host reform without waiting for instructions. This slice is `docs/state-audit.md` STA-01 (P0, the named absorbing state) together with STA-03 (its self-enforcement arms).
- Acceptance:
  - `blocked/integrity_conflict` is gone as a Task/FIFO residency state; a broken Host write invariant settles on the exact ingress that observed it and the Task's FIFO continues;
  - a later operator ingress activates while an earlier ingress is faulted, and the faulted ingress never reaches the runner — releasing the line must not execute anything under the violation;
  - each arm of the old `conflict()` predicate is either named individually in the surfaced fault or deleted with evidence that a durable constraint already holds it;
  - ambiguity that could change a decision or an effect still fails closed for that ingress; no arm picks a winner by time or ID;
  - the settlement stays visible and idempotent, consumes no activation budget, arms no retry timer, and does not terminalize the Task;
  - the head-of-line release has one definition shared by the durable acquisition fence and the scan;
  - wake totality is still exhaustive over the projection union at compile time;
  - a falsification probe shows the FIFO wedges again without the release.
- Hard constraints: no new gate; a Host fault may not become a durable user Task state; only an explicit user/operator ingress opens new work; no feature flag, fallback, or parallel path; preserve every unrelated working-tree change; converge the tracked current architecture in the same delivery.
- Read material: `specs/records/2026-08/2026-08-17-minimal-host-reform-plan-calibration.md`; `docs/state-audit.md` (STA-01, STA-03, STA-04, Appendix A/B); `docs/host-reform-plan.md`; `specs/current/architecture/task-control-plane.md`; `packages/opencorvus/src/engine/{task-root-ingress-reducer,task-root-ingress-delivery,task-root-fact-store,task-root-ingress-integrity,task-lifecycle,model}.ts`; `packages/opencorvus/src/orchestrator/agent.ts`; `packages/opencorvus/src/protocol/protocol.sql.ts`; `packages/opencorvus/test/task-control-integrity-blocked.test.ts`.
- Whole-repository search:
  - the ingress `blocked` value had a bounded consumer set: the projection union, the wake classification, two reduction sites, the debug zod union, one activation-attempt constant, the surfacing helper's reason/exit text, two `orchestrator/agent.ts` guards, and three tests. Every other `"blocked"` in the repository belongs to an unrelated domain — merge-back tool status, agent-coordination severity, the memory task planner, frontend-design roles;
  - `task.blocked` as an event type has no append site in the current tree and none in history; it survives only in three allowlists (one server route projection set, two Overlay policy sets), so it went with the concept;
  - **the durable head-of-line gate is not in the scan**: `acquireTaskRootIngressLease` re-reduces every preceding ingress and refuses acquisition unless it is `resolved`, `terminal_inapplicable`, or `exhausted`. That transaction, not the scan's control flow, is what made `blocked` absorb the FIFO;
  - the evidence reader is scoped per ingress through that ingress's activation leases, so a later ingress cannot inherit the corrupt evidence of an earlier one — which is why releasing the line is safe;
  - `protocol_event` carries partial unique indexes making one open, one boundary request, and one terminal fact per (Task, epoch) durable, and one deletion per Task.
- Starting workspace: the same in-flight reform slice as the two preceding records, plus their changes. Typecheck green before this change.
- Independent agent feedback: none.

## Observed facts and diagnosis

`blocked/integrity_conflict` was the reform's named worst case, and the audit's charge held up: its evidence is entirely the Host detecting its own broken writes, and its only exits were an epoch-bumping Retry or hand repair of the database. Neither is an ordinary user action, and for an active Task with no terminal event to retry, it was a plain deadlock.

Two findings sharpen where the defect actually lived.

**The gate was durable, not procedural.** The scan's catch-all made a blocked ingress stop the Task, but even with the scan fixed the Task stayed wedged: `acquireTaskRootIngressLease` re-reduces every preceding ingress inside the acquisition transaction and refuses unless it reached `resolved`, `terminal_inapplicable`, or `exhausted`. A probe confirmed this directly — after the scan reached the follow-up ingress and projected it `ready`, acquisition still returned `acquired: false`. Head-of-line order was enforced in two places with two different notions of "settled", and the durable one is what starved later operator messages.

**Releasing the line is safe because evidence is per-ingress.** `readTaskRootIngressEvidence` starts from the activation leases targeting *that* ingress and reads only assistant Messages claiming them. Corrupt evidence attached to one ingress is invisible to the next, which reduces from its own facts. Combined with the reduction returning a fault before any decision set can be read, no ingress can execute under another's violation — so continuing the FIFO abandons exactly one ingress rather than risking a wrong effect.

**Half of `conflict()` restated a database guarantee.** Two of its six arms — duplicate lifecycle rows per (epoch, kind), and more than one terminal fact for the epoch — are already impossible: `protocol_event_task_epoch_open_idx`, `_boundary_request_idx`, `_terminal_idx`, and `_task_deleted_idx` make each unique per (Task, epoch) or per Task. The reducer was re-deriving them and paying for it with a verdict that stopped the Task. The same two predicates appear again as throws in `taskLifecycleProjectionInTransaction` (STA-03), on a read path the board, the store, and the Task API all project through — which is how one impossible row used to take out every view of a Task at once.

The remaining four arms are real, and they are not one condition: a policy row that is not the one the ingress was accepted with, a decision set no single assistant Turn can own, one activity request with two outcomes, and a completed Turn referencing an activation with no lease. They were all reported as the single word `integrity_conflict`, which told an operator nothing about what to look at.

## Canonical repair

1. Replace the projection arm with `host_fault`, carrying a reason that names the exact broken invariant: `evidence_violation`, `policy_drift`, `decision_ambiguous`, `outcome_ambiguous`, `turn_without_activation`, `interaction_ambiguous`.
2. Turn `conflict(): boolean` into `hostFault(): reason | undefined`, and delete the two arms the unique indexes already hold, documenting the index as the enforcing boundary.
3. Delete the matching two throws from the lifecycle projection for the same reason (STA-03). The two remaining throws — a lifecycle event with no `execution_epoch`, and a Task with no open fact — are not gates: no projection value exists to return, so they stay.
4. Introduce `taskRootIngressReleasesHeadOfLine` as the single definition of "has no decision left to make" — `resolved`, `terminal_inapplicable`, `exhausted`, `host_fault` — and use it in the durable acquisition fence, replacing the inline three-state test.
5. Give the scan a `host_fault` branch that surfaces the settlement and continues to the next ingress, instead of falling into the stop-the-Task catch-all. Deliberately do **not** memoize it, unlike `exhausted`: the invariant it names can be repaired by a later append, and a process-local memo would blind that process to the repair until restart. The surfaced artifact is deterministic per (ingress, state, reason), so re-observation costs one evidence read and writes no duplicate fact.
6. Rewrite the surfaced exit text: both settled states now release the line, so the fault names the Host invariant to repair and tells the operator a new message redoes the work.
7. Keep both `orchestrator/agent.ts` guards that stop an integrity violation from terminalizing the Task, with corrected rationale — a Host defect may not become a durable user Task state — and delete the `task.blocked` event vocabulary from the three allowlists that still carried it.
8. Converge `specs/current/architecture/task-control-plane.md` and regenerate the published API artifacts.

## Verification

- `bun run typecheck` (root, all 10 packages): passed.
- `bun run test` over the task-control suite — integrity 3, wake-totality 4, ingress-reducer 11, liveness 13, cancellation-convergence 2, reconciliation 6, reconciliation-gate 1, sweep-scope 2, abandoned-dispatch 2, infra-budget 2: 46 passed, 0 failed.
- Every remaining test that reduces an ingress, projects a lifecycle, or acquires a lease — fact-store 3, operator-message-resumes 4, reopen-workspace-recovery 2, destructive-control-event-independence 5: 14 passed, 0 failed.
- New positive contract `lets a later operator ingress run past a Host-faulted head`: the head reduces to `host_fault`, the follow-up ingress reaches `leased`, `activated` is 1, and the runner ran exactly once with the follow-up's own event — the faulted head never reaches it.
- Falsification probe: with `host_fault` removed from `taskRootIngressReleasesHeadOfLine`, that test fails with `activated: 0` and an empty runner log — the wedge reproduces from the durable fence alone, confirming which line of code owns the defect.
- Retained contracts: the faulted ingress still consumes no activation budget (one seeded lease after three scans), still writes exactly one surfaced artifact across repeated scans, still arms no retry timer, and still records zero driver failures.
- Wake totality is enforced at compile time: the fixture table is keyed by `TaskRootIngressProjection["state"]`, and all six `host_fault` reasons are asserted to classify as a surfaced infrastructure fact.
- `bun run script/generate.ts` then `bun run docs:check`: passed (332 ops, 25 groups); `integrity_conflict` no longer appears in `packages/sdk/openapi.json` and `host_fault` does.

## Follow-on

STA-04 (the Retry intent surface) is now unblocked: Retry was `blocked`'s only user-side exit, and there is no longer a state that requires it. Removing it is a separate slice, together with `canRetry` and the terminal-only admission gate.
