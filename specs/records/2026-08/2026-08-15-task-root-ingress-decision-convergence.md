# Task-root ingress decision convergence

## Recall

- User request: investigate why the recent infrastructure refactor did not prevent the database-backed web-game Task from freezing and then repair the problem completely without adding another compensating queue, retry scanner, fallback, or parallel source of truth.
- Incident evidence: production Task `tsk_g00VSHnObM00F2wFQUaN` has one `agent_lifecycle_delivery` ingress at the FIFO head. Its first assistant Turn read and messaged about the lifecycle fact but committed no current Orchestrator decision Tool. Settlement correctly raised `TaskRootIngressSettlementError`; infrastructure recovery then retried the same ingress and deterministic control Message. The reused assistant reply is older than the new global Message fence, so every later attempt fails `is not the final assistant message for its invocation`. At the last read the durable `delivery_attempt` was 80 and two later accepted lifecycle ingresses remained blocked.
- Observable UI symptom: Task conversation appears frozen because the failed FIFO head never reaches a terminal disposition. Debug copy additionally waited for a fresh synchronous Board read before touching the clipboard, bypassed HostTransport for writes, and advertised a double-click action that was not bound to the title element.
- Acceptance:
  - a semantic-invalid assistant result terminalizes its exact decision attempt and creates one fresh visible Orchestrator control occurrence with a new identity;
  - the continuation can commit a current scheduling/lifecycle decision and then allows the next FIFO ingress to run;
  - semantic rejection never enters physical infrastructure retry, including after restart;
  - only an ownerless activation without an assistant receipt may consume a finite root physical budget; Provider/configuration/final assistant errors do not enter root retry;
  - every semantic continuation chain has a finite retry budget and a typed terminal exhausted result;
  - cancellation, terminal Task conversation, restart recovery, concurrent lifecycle delivery, and multi-project isolation retain one `task_root_ingress` authority;
  - debug copy can produce a diagnostic bundle from the currently rendered/persisted projection without requiring a fresh Board synchronization first;
  - focused tests, typecheck, documentation checks, real checker where credentials/model projection are available, real UI interaction and screenshot, and an uninvolved read-only review pass.
- Hard constraints: all Large Language Model interaction remains streaming; business serial/parallel choice remains model-owned; messages are real and visible; queues/timers are activation hints rather than business truth; no Host prose parsing or fabricated decision; no compatibility reader, fallback, dual write, or second workflow store; no UI automation test is created, modified, or run; the user's `.gitattributes`, `specs/README.md`, promotion-video record, and `.codex-tmp/` changes are preserved.
- Read material: the supplied workflow-engine analysis; `specs/current/architecture/task-control-plane.md`; `specs/current/architecture/02-data.md`; the August 11 scheduler systemic/liveness records; the v0.0.44 release record; `task-root-ingress.ts`; `task-root-ingress-delivery.ts`; Orchestrator event/control-message/session-loop code; active-operator and managed-lifecycle tests; Overlay debug-copy implementation.
- Repository search: `task_root_ingress` remains the sole durable Task-root input, but `delivery_failed` currently represents both semantic settlement rejection and transient execution failure. The FIFO head selector includes `delivery_failed`; terminal lifecycle recovery unconditionally schedules the same durable wake after the per-runtime window; exact control Message identity is derived only from the wake ID; the current tests prove rejection and retry ownership separately but do not prove semantic rejection-to-new-decision convergence.
- Recent-refactor finding: `8c23dd0e` deleted the Host Task Queue implementation but retained root-ingress claim/settlement/recovery machinery; `8ac1d921` added current-decision validation without a semantic failure transition; `91aef539` repaired already-committed dispatch receipt ordering only. Their individually valid contracts compose into the incident loop.
- Independent agent feedback: an uninvolved adversarial plan reviewer rejected the first design before implementation. It found four blocking defects: a newly appended continuation ingress would sort behind already accepted later lifecycle facts; `TaskRootIngressSettlementError` conflates semantic rejection with missing/corrupt/conflicting receipts; the successor-runtime retry is recursively unbounded rather than bounded; and adding only a settlement reducer would leave cancellation, claim, recovery, duplicate persistence, delivery, and retry as parallel state writers. It also required typed old-data reclassification, explicit blocked semantics, complete source-kind policy, cancellation/occurrence CAS, persisted attempt/activation identity, and native desktop clipboard transport. The revised design below incorporates those findings. A different uninvolved read-only review remains mandatory after the first verified implementation.

## Control model

`task_root_ingress` remains the single durable aggregate and retains its immutable FIFO position. It separates the business input, semantic decision attempt, and physical activation without adding another mailbox row or workflow table:

- the ingress owns the immutable lifecycle/recovery/wait/coordination fact and never changes FIFO ordinal;
- `decision_attempt` is a monotonic semantic ordinal inside that same payload. `(ingress artifact id, decision attempt)` derives one real visible control Message/Part identity and one exact assistant receipt scope;
- `activation_attempt` is the physical execution ordinal. Retrying a transient physical activation does not increment `decision_attempt` and must reconcile an already committed assistant before calling the Provider again;
- a typed `decision_required` result atomically advances the same ingress back to `accepted`, increments `decision_attempt`, records the rejected assistant Message and reason, and keeps the same FIFO head;
- the next visible Orchestrator-authored control Message re-renders the original authoritative ingress fact from its durable source plus the prior typed rejection. It does not rely on conversation-history survival or fabricate an assistant message;
- after the protocol-level decision budget is exhausted, the ingress reaches terminal `control_blocked`. It remains a visible Task blocker, stops automatic activation, and cannot be bypassed by later automatic ingress. Only an explicit operator Retry/Replan opens a new Task execution occurrence and resolves or terminalizes the blocker under the existing operator authority.

The decision budget is a protocol constant frozen into the ingress when accepted, not a mutable environment/config fallback. Physical retry budget and semantic decision budget are independent.

The one settlement boundary classifies outcomes:

| Outcome | Durable transition | Recovery owner |
| --- | --- | --- |
| valid current decision | `delivering -> delivered` | none |
| semantic settlement rejection | same ingress `delivering -> accepted`, increment `decision_attempt`; at budget: `control_blocked` | fresh visible attempt of the same FIFO head |
| transient root activation failure | same ingress `delivering -> delivery_failed` within durable total budget; at budget: `physical_exhausted` | one reducer-selected retry activation |
| cancellation/stale Task occurrence | `terminal_inapplicable` | none |
| committed receipt discovered after owner loss | current exact terminal result | reconciliation only |

The settlement validator returns a discriminated result rather than using one broad error type:

- `committed`: exact current decision receipt is valid;
- `decision_required`: a real completed assistant step proves that the current execution-control fact still lacks a completed decision;
- `assistant_execution_failed`: the physical invocation failed before a valid assistant receipt;
- `identity_conflict` or `corrupt_receipt`: parent, attempt, Tool completion, DispatchOutcome, or persistence integrity is invalid and must fail closed into a typed blocker rather than ask the model to repair storage.

Provider network/rate retry remains Provider-activity-owned. Authentication/configuration, execution-capsule identity, durable receipt corruption, and occurrence conflicts are non-retryable. Database commit with unknown outcome is reconciled from the exact persisted attempt; it is not replayed through another root-level retry. The recursive delayed successor-runtime retry owner is removed.

All state transitions use one pure `reduceTaskRootIngress(state, command)` function and one transactional `applyTaskRootIngressCommand` writer. Acceptance, duplicate acceptance, claim, assistant settlement, cancellation, stale occurrence, ownerless recovery, physical retry/exhaustion, semantic continuation/blocking, and terminal delivery are commands handled there. Existing direct label/payload writers and `delivery_failed -> accepted` reset functions are deleted in the same cutover.

Every command compares the current label, `task_occurrence_started_at`, cancellation authority, `decision_attempt`, and `activation_attempt`. Assistant Message metadata and runtime contracts carry the exact decision/activation identity. A cancellation or reopen winner fences stale commits; process-local owner maps remain physical liveness observations only.

Source-kind policy is exhaustive:

- real participant messages (`operator_message`, `orchestrator_message`, `mission_message`) retain prose-visible settlement and do not require decision continuation;
- execution-control facts (`task_creation`, `operator_intent`, `mission_acceptance_resume`, `coordination_request`, `infrastructure_recovery`, `dispatch_infrastructure_failure`, `agent_lifecycle_delivery`, `task_wait_activity`, `task_wait_wake`, `orchestrator_event`) use the same decision-attempt protocol;
- source kinds with no participant-authored input receive one real Orchestrator-authored control Message rendered from the exact persisted ingress fact for every semantic attempt.

## Implementation plan

1. Add frozen decision/activation identity and typed result variants to the current root-ingress payload. Implement the pure reducer and transactional apply writer, then route every Task-root ingress state mutation through it and delete the direct reset/retry writers.
2. Replace the broad throwing settlement validator with typed classification. Advance only proven `decision_required` results; fail closed on identity/corruption; give root physical activation a durable total budget and remove the recursive delayed retry owner.
3. Derive control Message/Part identities from `(ingress artifact id, decision attempt)`, carry decision/activation identity in Message metadata and runtime contract, query exact receipts by those identities, and remove the database-global Message fence.
4. Add a one-time idempotent current-epoch data-state upgrade before recovery. It revalidates every existing `delivery_failed` row from exact Message/Part evidence with the new classifier; only proven `decision_required` becomes decision attempt 2. Physical `delivery_attempt=80` is never interpreted as a semantic ordinal. After the upgrade, no compatibility runtime branch remains.
5. Define `control_blocked` and `physical_exhausted` in Board/debug projections and the explicit operator Retry/Replan recovery transaction. Update architecture documentation and focused positive tests for the complete source-kind policy, invalid-decision recovery, FIFO continuity, crash boundaries, cancellation/reopen, finite exhaustion, and multi-project isolation.
6. Add `clipboard.writeText` to the existing HostTransport abstraction: the Tauri adapter uses the installed native clipboard plugin and the browser adapter uses `navigator.clipboard`; business code uses only HostTransport. Remove fresh Board synchronization as a precondition for building the debug bundle. Verify real desktop copy/paste and screenshot without UI automation tests.
7. Run focused engine tests, package typecheck, documentation check, and the real Task-control checker if the configured Provider credentials and exact requested model projection are available. Perform the mandatory independent read-only review, resolve every valid finding, repeat verification, commit, merge upstream, inspect the outgoing commit set, and push.

## Risk and exclusions

- Mission close, Provider capacity, scheduler protocol inbox/outbox, and Bus publication are audited for shared retry/occurrence semantics but are not migrated to a new generic workflow table in this change. Creating a second framework beside `engine_artifact` would violate the single-source constraint. The Task-root vertical slice establishes the reducer semantics that those domains can adopt in later atomic cutovers.
- Existing persisted rows are upgraded before production readers/recovery run. Classification uses exact persisted Message, parent, attempt and Tool evidence; it never matches exception text or assumes every `TaskRootIngressSettlementError` is semantic.
- Repairing the currently running installed application requires loading the new binary/runtime. This task will not restart or close the user's active process without explicit authorization.

## Evidence ledger

- `bun run typecheck` passed in `packages/opencorvus`, `packages/overlay`, and `packages/transport-protocol`.
- `cargo check` passed in `packages/overlay/src-tauri` after the required embedded Overlay Server artifact was built with `bun run build --overlay-server`.
- Focused engine acceptance passed: four incident-path tests in `active-operator-wake-settlement.test.ts` cover missing assistant integrity blocking, same-ingress prose-only decision attempt 2, attempt-80 exact-evidence upgrade, and finite Provider-terminal exhaustion with a younger accepted FIFO item. The pure reducer tests cover same-aggregate semantic continuation and typed semantic/physical exhaustion.
- The transport protocol contract test passed with the new `clipboard.writeText` command.
- The complete 48-case `active-operator-wake-settlement.test.ts` file reached 47 passing Task-root/control cases on repeated serial runs. The remaining failure was not stable: Windows process-supervisor readiness failed while starting `git` in one run, while another run passed that case and failed only a global live-process assertion polluted by unrelated Tasks. The assertion was corrected to the existing Task-scoped metrics source; its focused six-case sequence then passed 6/6. A later full run again passed all 47 Task-root/control cases and failed only a different native `git` readiness startup. This toolchain instability is recorded rather than treated as a product-path pass.
- Cross-package verification passed: Task-root reducer 2/2, transport protocol 21/21, TypeScript typecheck in OpenCorvus/Overlay/transport protocol, Overlay Vite production build, Rust `cargo fmt --check` and `cargo check`, `docs:check`, and `git diff --check`.
- Real isolated `/ui` interaction on port 17891 initially reproduced both missing double-click binding and the named-project precondition. After rebuilding, a real named-project Chat title double-click projected `data-copy-feedback="copied"`; reading the browser clipboard returned a 2,793-byte `opencorvus.debug.v2` bundle containing the exact Session ID. Screenshot: `C:/Users/hengu/AppData/Local/Temp/opencorvus-ui-clipboard-20260815/clipboard-copy-success.png`.
- Native Tauri write transport is compiled and registered, but interacting with the user's already-running desktop window remains intentionally unperformed pending explicit authorization.
- `bun run check:task-control-real` reached its explicit authorization boundary and stopped before credential/model access because `TASK_CONTROL_CHECK_ALLOW_REAL_PROVIDER=1` was not provided. No real Provider call or credential projection was attempted.
- The first post-implementation read-only review found three P1 issues and one P2: missing attempt compare-and-set, cold-start cancellation replay consuming a later terminal conversation, durable outbox resume preceding the data-state upgrade, and missing blocker badge projection. The implementation now requires expected decision/activation identity on every attempt-sensitive reducer command and makes stale commands no-op inside the transaction; cold cancellation recovery is causally bounded before the cancellation event; upgrade runs after subscriber registration but before outbox resume; and all three blockers render a failed badge with their typed reason. Focused regressions for stale attempt 1 versus decision attempt 2 and cancellation → terminal message → recovery both pass.
- A second independent read-only review and final Git delivery remain pending.
