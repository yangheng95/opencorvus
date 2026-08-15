# Task-root parallel-decision lock convergence

## Recall

- User request: diagnose “two handoffs” and the frozen Mission-created Task `tsk_g00VSMEqb400uDXtoI2Z`, then “根治锁有问题”.
- Observed incident facts:
  - one Orchestrator assistant Turn successfully completed three sibling `dispatch_agent` Tool calls for the `greenfield-interface-delivery` ready frontier;
  - the three worker Sessions later persisted `terminal/completed` lifecycle events, `terminal_success` dispatch settlements, and three accepted lifecycle Task-root ingresses;
  - only the creation ingress has an activation lease; every later lifecycle ingress has zero leases and the Orchestrator never reaches a second decision point;
  - the creation ingress reduces to `blocked/integrity_conflict` because the reducer counts three completed Tool Parts as three mutually exclusive decisions even though they belong to one assistant Turn;
  - lifecycle rows use the current Task aggregate identity `(aggregate_type='task', aggregate_id=taskID, task_id=NULL)`, while `taskExecutionProjectionForTask` still filters `task_id=taskID`, so persisted terminal events render as `unknown`/pending;
  - protocol transport keeps Session identity in the envelope, but the Overlay lifecycle consumer reads `properties.sessionID`; task-event replay therefore needs a read-time derived lifecycle payload rather than a duplicated durable field.
- Acceptance criteria:
  - one assistant Turn containing multiple completed `dispatch_agent` receipts is one atomic scheduler decision set and resolves its ingress;
  - incompatible decision kinds in one Turn, or decision receipts spanning multiple assistant Turns for the same ingress, still reduce to typed `blocked/integrity_conflict`;
  - resolving a parallel dispatch set releases the FIFO so accepted worker-terminal lifecycle ingresses can acquire leases and reach subsequent Orchestrator decisions;
  - current-schema lifecycle events project terminal status from the Task aggregate and replay with derived Session/agent routing identity;
  - ordinary single decisions, prose continuation, question/wait, cancellation/closure, retry/restart reconciliation, Session occurrence reuse, concurrent terminal delivery, and multi-project isolation retain one fact authority;
  - focused positive tests, typecheck, documentation checks, and an uninvolved read-only review pass.
- Hard constraints: preserve immutable fact reduction and FIFO fencing; do not add mutable status, a second queue, fallback, scanner state, workflow gate, prose parsing, synthetic messages, non-streaming LLM calls, or UI automation tests. Preserve every unrelated dirty-worktree change.
- Read material: `specs/current/architecture/task-control-plane.md`; `2026-08-15-task-root-fact-reduction-kernel.md`; `2026-08-15-task-root-ingress-decision-convergence.md`; Task-root reducer/fact reader/reconciler; dispatch Tool lifecycle delivery; worker descriptors and settlements; Protocol Store and Task event transport; Workbench execution projection; the incident database, Task APIs, transcript, task logs, and runtime logs.
- Repository-wide search results:
  - `dispatch_agent`, `respond_agent_coordination`, `manage_task`, `question`, and `wait` are decision Tool names, but only completed effects classified as `satisfies_current_epoch` or `inspect_dispatch_outcome` enter reducer evidence;
  - `decisionID` is consumed only by the reducer tests and Task-control reconciliation assertion, so replacing a scalar receipt with an ordered decision-set identity does not create a compatibility surface;
  - production lifecycle completion already enters `dispatchTaskLoop` through `reconcileTerminalAgentLifecycleDelivery`; the missing wake is downstream FIFO admission, not missing worker completion publication;
  - Task aggregate identity is already the documented current authority and other Protocol queries use `(aggregate_type, aggregate_id)`; the execution projection is the stale exception;
  - Task-root reconciliation is shared by creation, operator/Mission ingress, worker lifecycle completion, startup recovery, retry/replan, cancellation/closure and multi-project initialization.
- Independent agent feedback: the first post-implementation review found that lifecycle routing was projected both in `ProtocolStore.eventView` (from the latest Session descriptor) and in two server serializers (from the exact occurrence), leaving public/archive readers inconsistent and allowing an old occurrence to be relabeled by a newer descriptor. The valid P1 was repaired by moving exact `inputMessageID` projection into one neutral Protocol read projector used by `eventView` and deleting both route-level projections. Repeat read-only review is pending.

## Root cause and contract repair

`DecisionFact` is a Tool-level fact, not the semantic decision aggregate. The semantic unit is the completed assistant Turn that owns those Tool receipts. Reduction must therefore group valid decision facts by `assistantMessageID`:

1. zero decision groups leaves the ingress unresolved;
2. exactly one group resolves the ingress when either it contains one valid decision receipt or every receipt in the group is `dispatch_agent`;
3. more than one assistant decision group is an immutable conflict;
4. a multi-receipt group containing any non-dispatch decision is an immutable conflict.

The resolved projection exposes the ordered `decisionIDs` of the one atomic group. It does not persist a new set row or infer workflow readiness; dispatch occurrence and workflow binding guards remain the domain authorities for whether each requested dispatch was legal.

## Implementation and verification plan

1. Replace scalar decision uniqueness in the reducer with assistant-owned atomic decision-set reduction; update the current architecture wording.
2. Add reducer contracts for parallel dispatch success, mixed-decision conflict, and cross-Turn conflict.
3. Add a production-reader reconciliation test proving a three-dispatch first ingress releases a second FIFO ingress.
4. Query execution lifecycle events through current Task aggregate identity and add a positive terminal projection test.
5. Project Protocol lifecycle transport payloads from the envelope plus persisted Session/worker facts so replay carries canonical camel-case routing fields without durable duplication.
6. Run the official isolated focused runner for reducer, reconciliation, event projection, worker lifecycle/recovery, Mission Task startup, cancellation and multi-project tests; then typecheck, docs check and diff check.
7. Obtain an uninvolved read-only review, fix every valid finding, rerun affected evidence, then commit and push in the user-authorized batched delivery.

## Status

- Root-cause implementation complete: assistant-owned parallel dispatch reduction, FIFO continuation, Task-aggregate execution projection and read-time lifecycle routing projection are covered by focused positive tests.
- Official isolated-runner evidence: reducer 10/10, fact persistence 3/3, FIFO reconciliation 3/3, active operator/cancellation 2/2, delegated-worker authority 1/1, process-recovery ingress 1/1, cancellation protocol 1/1, Mission duplex 2/2, multi-project runtime ownership 4/4 and Task execution/transport projection 2/2. Shared lifecycle projection checks also pass for conversation ownership 1/1 and Protocol scheduler delivery 1/1.
- `packages/opencorvus` typecheck, root `docs:check`, and `git diff --check` pass.
- The delegated-worker horizontal checker initially exposed an obsolete TestHook placement and denormalized workflow-occurrence expectation; its fixture now installs the project-bound hook inside `Instance.provide`, uses the exact ingress/predecessor identity, and asserts the current normalized occurrence contract before passing 1/1.
- Repeat uninvolved read-only review confirmed the shared Protocol projector preserves exact descriptor schema/hash/agent/session-kind validation, fails closed when worker occurrence evidence is missing, reuses the active append transaction, and leaves `session.error` independent. No unresolved finding remains.
