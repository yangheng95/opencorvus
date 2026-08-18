# Mission wake activation fence P0 (batch 2)

## Recall

- User requirement: continue the second repair batch after the Mission closure recovery P0, using the existing
  isolated worktree.
- Acceptance: every Mission operator, scheduler-message, Automation, Event, and standalone process-recovery wake must
  use Mission closure admission. An admitted wake keeps the boundary until its physical Session prompt owner is
  observable; a non-operator wake targeting `closing|closed` records the exact closure failure and cannot reopen the
  occurrence. A non-operator wake also requires an existing `opened` occurrence, so Automation/Event cannot start a
  draft Mission. A concurrent close may establish `closing` and cancel the published owner; no admitted wake may start
  after close merely because its loop was deferred to a later microtask.
- Hard constraints: keep the first batch's durable dispositions and current architecture; do not redesign Provider
  retry, capacity queues, Task ingress, Task cancellation, Bus publication, or User Interface projections. Preserve
  streaming calls and one current implementation, add only positive non-UI contract tests, and preserve unrelated
  worktree state.
- Sources read: the first-batch Recall and implementation, `specs/current/architecture/task-control-plane.md`, Mission
  routes, panel `wake_mission`, Mission closure admission, scheduler delivery/recovery, Automation delay/recurrence,
  Event fire/recovery, standalone Mission process recovery, Session wake, Session loop entry, prompt-owner capture,
  prompt cancellation, Task root-wake destructive scope, Task occurrence claim and cancellation authority.
- Whole-repository search: HTTP operator dispatch/wake and panel `wake_mission` call Mission execution opening and
  `SessionWake` separately; scheduler materialization calls `wakeWithReceipt` inside admission but releases it before
  the deferred loop owns a prompt; delivered-wake recovery creates its runtime reservation inside admission but likewise
  schedules physical loop entry on a later microtask; process recovery has the same gap. Mission can invoke `wait` and
  session-scoped `schedule`, while Automation/Event validate only project lineage and directly wake the target Session,
  so both can target a Mission occurrence. Task ingress is excluded
  because `queued_operator_wake` claims the current occurrence, enters the process-local root wake queue, and Task
  cancellation holds a destructive scope plus prompt-start/settlement barriers before terminal commit. Provider retry
  is downstream of prompt ownership and remains unchanged.
- Independent agent feedback: the first uninvolved read-only review found the Automation/Event Mission target bypass,
  the optional process-recovery activation fallback, and missing production-entry tests. The second review confirmed
  those fixes and found that non-operator admission still treated a missing occurrence as active, allowing a draft
  Mission to start. The third review confirmed that lifecycle fix and found duplicate Event NamedError serialization
  plus a missing current-architecture statement for the draft contract. All findings were accepted and corrected; a
  final independent review is required after the latest change.

## Root cause and impact

The durable closure transaction is now correct, but Mission admission and physical execution admission are not one
continuous handoff. `startPersistedWakeLoop` reserves runtime settlement synchronously and invokes the loop from a
microtask. Callers receive only the eventual assistant completion Promise, so they either release Mission admission
immediately or would have to hold it for the entire model Turn. Releasing immediately leaves a start-before-cancel
race; holding it through completion would prevent close from acquiring admission and cancelling the Turn.

Operator entrances have an even wider version of the same gap: HTTP routes append `opened`, release admission, then
persist the configuration overlay and invoke `SessionWake.wake`; panel `wake_mission` invokes `SessionWake.wake`
without opening the execution occurrence at all. Abort can append `closing|closed` while an entrance is between
operations, after which the old operator request can still materialize and start a Turn.

Automation and Event have the lifecycle variant: their target may be the current Mission Session, but they previously
used only project-lineage and lease fencing. A durable delay, recurrence, or Event occurrence could therefore invoke
`SessionWake` after the Mission closure was already `closed`, or before an operator had established any `opened`
occurrence for a draft Mission.

## P0 design

1. Extend the Session wake receipt with an `activation` Promise. It resolves only when `SessionPromptState` publishes
   the exact prompt owner for the loop attempt; it rejects if the attempt fails before acquiring or attaching to an
   owner. Assistant completion remains a separate Promise and retains current semantics.
2. Add one Mission `open + wake activation` operation. Under `withMissionExecutionAdmission`, it validates/opens the
   execution, performs the caller's wake preparation, and awaits only the activation receipt. HTTP operator routes and
   panel `wake_mission` use this operation instead of opening and waking separately.
3. Newly materialized scheduler wakes, delivered-wake recovery, and process recovery await the same activation receipt
   before releasing Mission admission. Process recovery requires activation in its dependency contract; there is no
   optional compatibility path. These entrances do not await assistant completion while holding the lock.
4. Automation and Event inspect the real target Session. Ordinary Assistant targets keep existing execution semantics;
   Mission targets use one non-operator admission primitive that requires the current durable state to be `opened` and
   awaits activation. It never opens or reopens an occurrence. A missing occurrence returns a typed not-opened error;
   a `closing|closed` target returns a typed error containing the exact operation and closure event. Existing
   Automation/Event occurrence failure settlement records either error without changing retry policy.
5. Keep close unchanged after admission: once it wins, `closing` is durable, unanswered scheduler receipts are
   terminalized, and the now-observable prompt owner is cancelled and physically settled by the existing barrier.
6. Do not add retry branches or a second execution registry. Runtime settlement remains process-shutdown ownership;
   the activation receipt is only the bounded handoff between Mission lifecycle admission and the existing prompt
   owner.

## Verification

- Prompt-owner capture tests prove the Session-specific owner publication contract; wake receipt tests prove typed
  pre-activation failure, and the Mission admission test proves the lifecycle boundary releases at activation rather
  than assistant completion.
- Mission admission and panel-tool tests prove concurrent close observes `closing` only after the admitted operator
  wake publishes activation, and then converges to the same `closed` operation.
- A real scheduler delivery test gates both initial materialization and delivered-wake recovery at activation, then
  proves concurrent close writes the exact durable `mission_wake_closed` receipt. Process recovery fixtures all provide
  and await activation.
- Automation and Event production-path tests target both a closed Mission and a draft Mission. They assert durable
  failure facts contain either the exact closure identity or the typed not-opened result.
- Run complete touched test files, package typecheck, repository documentation check, and `git diff --check`.
- Obtain mandatory independent read-only review and repeat it after corrective changes until no finding remains.

## Progress

- [x] Remaining Mission and Task admission paths horizontally audited.
- [x] Batch-2 root cause and exclusions recorded.
- [x] Implementation complete.
- [x] Expanded focused verification complete: 118 tests across scheduler delivery, Mission process recovery and panel
      handoff, Mission routes and durable activity, prompt-owner capture, runtime settlement, Automation, and durable
      Event fire pass with 380 assertions. Package typecheck, documentation check, and `git diff --check` pass after
      the final review fix.
- [x] Auxiliary `panel-mission-terminal-authority.test.ts` execution reaches two pre-existing fixture parse failures
      because `visibleExpertSquadIDs` is absent, before either test enters `panel.start_mission`; this unrelated test
      fixture was not changed or masked by a compatibility path.
- [x] First, second, and third independent review findings implemented; fourth independent review reports no findings.
- [x] Commit, upstream merge, final verification, and push complete.
