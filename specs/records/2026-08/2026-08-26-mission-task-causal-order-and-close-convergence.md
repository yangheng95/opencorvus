# Mission Task causal-order and close convergence repair

## Recall

| Item | Record |
| --- | --- |
| User requirement | Diagnose whether the empty Mission panel was a recent regression, then repair the actual problems from a reasonable architecture rather than hiding symptoms. |
| Observable incident | Mission `chat-4db27c043190` was created at 23:02:58. At the 23:04:13 bundle its persisted Task list was genuinely empty while the Mission agent was still planning. It created Task `tsk_g00VTPpX6I00dm32FGTk` at 23:07:25. The first execution terminalized on `IMMUTABLE_CREATION_WORKSPACE_MISMATCH` after the live repository tree changed. The next same-Task acceptance occurrence persisted a creator Message after its Task-root control Message in visible time order and an assistant append failed `invalid Task-root continuation parent`. A later acceptance occurrence recovered the same Task and dispatched real workers. |
| Acceptance | (1) A fresh typed Task-root occurrence publishes its real creator Message and Orchestrator control Message as one atomic visibility cut, in causal order, before the runtime wake can create an assistant. (2) New Messages in one Session receive a strictly increasing persisted creation/order frontier even if the caller wall clock moves backward or concurrent processes submit Messages. (3) Every Task-root ingress kind, ordinary participant Message, retry/restart path, terminal conversation, and multi-project Session continues to use the same Session writer and Task-root reducer; no Orchestrator-local reorder fallback is added. (4) Two Mission close owners may contend, but after one writes `closed`, a successor that acquires the released lifecycle lease returns that terminal fact without invoking the physical close again. (5) Focused positive tests and an isolated real backend path verify the changed production boundaries. |
| Hard constraints | Preserve streaming Large Language Model calls, real participant Messages, immutable Task-root facts, one runtime contract, and the shared control lease. Do not parse prose, synthesize a placeholder Task, add a status mirror, sleep to manufacture order, relax the first-execution workspace-identity guard, restart the user's runtime, read credentials, run or modify User Interface automation tests, or modify the supplied production database. Preserve unrelated worktree changes. |
| Architecture read | `AGENTS.md`; `specs/current/architecture/task-control-plane.md`; `specs/current/architecture/task-runtime-directory.md`; Mission closure recovery P0; Mission Task publication convergence; Task-root ingress decision convergence; Task-root fact-reduction kernel; Session prompt/message storage; Task-root reducer, activation fence and reconciler; Mission execution closure and process recovery. |
| Whole-repository search | Production Message inserts converge through `Session.upsertMessageRow`/`persistMessageBundleRows`; Task-root participant delivery already advances the target Session frontier with `max(now, frontier + 1)`. Ordinary new Messages still persist caller wall-clock `time.created` directly, and `MessageStore.stream`, SessionLoop `lastUser`, runtime input checks, conversation pagination and timeline `orderKey` all sort by `(message.time_created, message.id)`. The fresh typed Task path writes creator and control through two separate transactions. Mission abort, archive and delete all converge through `closeMissionExecutionOperation`; the post-terminal lease release added by `0c4a9a1cd` lets a waiting owner acquire immediately, but the acquired branch does not re-read `closed` before calling the physical close. |
| Baseline verification | `bun test test/mission-process-recovery.test.ts test/orchestrator-initial-task-render.test.ts test/orchestrator-control-message.test.ts`: 14 pass, 1 fail. The deterministic failure expects one physical Mission close and observes two. The initial Task render and control identity contracts pass but do not exercise a backward wall clock or a transaction cut between creator and control. |
| Independent agent feedback | None before implementation. Post-implementation review found deferred top-level Message allocation, deferred composite owners, and the Task-root move writer as P1 cross-process gaps; it also found P2 gaps in architecture documentation, barrier diagnostics and canonical `orderKey` assertions. All were repaired. The final uninvolved read-only rereview reported no unresolved findings after independently running 19 Session/Mission/Orchestrator/agent-runner checks, 4 Task-root delivery checks, package typecheck and diff-check. |

## Facts, inference, and exclusions

### Observed facts

1. The original empty Task list was consistent across persisted root Session, persisted conversation tree and rendered Overlay snapshot. The Mission Session itself was active and had not called `panel.create_task`; zero is known for Tasks at that instant, not for Mission activity.
2. The first Task execution compared two different source-tree digests while the shared worktree was concurrently changing. `EngineGit.prepare` deliberately terminalizes epoch 1 on that mismatch, while later explicit operator/Mission acceptance opens a new epoch.
3. In the failed recovery occurrence, the control Message has persisted `time.created=1787757206390`; the creator Message has `time.created=1787757206615`. Session projection therefore selected the creator as the latest user input even though the active Task-root runtime contract was bound to the control occurrence.
4. The assistant activation fence correctly rejected an assistant whose parent was not the deterministic control Message for its exact `(ingress_id, predecessor_id)`.
5. The Mission close concurrency test reliably produces `closeCalls=2`. Both callers return the same one terminal closure fact, proving business fact convergence but duplicated physical effect.

### Root-cause inference

- High confidence: Session causal order is currently encoded by a non-monotonic wall-clock column. The Task-root pair additionally crosses two transactions, so process loss or a competing invocation may expose only one participant before the other. The activation fence detects the consequence but cannot repair input order after visibility.
- High confidence: Mission close checks `closed` only while waiting for the lifecycle lease. A successor can acquire immediately after the first owner atomically writes `closed` and releases; that successful-acquisition branch skips the waiting-loop check and invokes `close` again.
- Unknown: the supplied runtime bundle alone cannot prove which exact physical interleaving produced the reversed Task-root pair. The repair therefore closes both admissible causes—non-monotonic persistence order and the two-transaction visibility cut—without attributing the incident to an unproved single commit.

### Explicit exclusions

- No Mission Board or Work Ledger renderer change: current backend status already projects the real Task. If an operator still sees an empty board against a non-empty status response, that is a separate rendered/runtime incident requiring a fresh real-page observation.
- No automatic replacement Task, placeholder lane record or synthetic progress Message.
- No automatic workspace rebaseline. The creation digest and first-execution digest remain distinct immutable evidence, and a mismatch remains the current typed terminal contract. Parallel writers must be coordinated or explicitly isolated; silently accepting a different source would destroy the capsule evidence boundary.

## Architecture repair

### 1. Session-owned causal Message frontier

The Session persistence transaction owns allocation of a new Message's durable creation frontier:

```text
persisted_created = max(requested_created, latest_session_message_created + 1)
```

The allocation happens only for a new Message and inside the same SQLite transaction as the Message row. Existing Message creation identity remains immutable. The persisted value, not the caller value, feeds Message events, `orderKey`, hydration and pagination. The first new Part is never assigned before its parent Message's persisted frontier. This reuses the exact rule already used when moving a Task-root participant Message into the Orchestrator Session and makes it the sole ordinary Message writer rule.

This column is already the repository's causal order authority. Making its allocator monotonic removes wall-clock rollback as an ordering writer without adding a second sequence/status column or a compatibility reader.

### 2. Atomic fresh Task-root participant pair

Add one SessionPrompt primitive for a bounded same-Session sequence of real `noReply` user Messages. It:

1. prepares every Message under the same installed runtime contract;
2. holds one runtime-contract message-write claim;
3. materializes the real creator and control participant payloads;
4. persists both Message/Part bundles in one immediate transaction using the Session-owned frontier;
5. applies each exact preflight in that transaction;
6. registers the control wake before that control's visibility effects;
7. releases the write claim only after both durable receipts are hydrated.

The fresh typed Orchestrator path uses this primitive only when both the creator and current control are required. Existing creator-only participant Turns and replay of an already durable control keep their current single-Message paths. A concurrent first publisher either commits the complete pair or causes the competing transaction to roll back on the existing exact identity/creator preflight; it cannot leave a second creator or a half pair.

### 3. Mission close post-acquire reduction

After acquiring the lifecycle lease, `closeMissionExecutionOperation` immediately re-reads the canonical closure fact. If it is already `closed`, the owner releases its just-acquired lease and returns the fact. Only an owner that still observes the same `closing` operation may call the physical close. The existing transaction continues to assert the lease, append/reuse `closed`, and release the lease atomically.

The business state remains `Reduce(Mission lifecycle facts, valid lifecycle lease)`. The new check is not a fallback or second close status; it is the required post-acquisition fence before an external effect.

## Horizontal impact audit

| Surface | Impact |
| --- | --- |
| Mission create/wake before first Task | No semantic change; zero Tasks remains a truthful planning projection. |
| Task creation and initial epoch | Fresh typed creator/control uses the atomic pair; immutable package, process binding, workspace digest and Task-root ingress remain unchanged. |
| Mission acceptance resume, process recovery, lifecycle delivery, wait wake and infrastructure recovery | All produce the same deterministic control occurrence and inherit Session monotonic order. Existing creator Sessions use the replay path. |
| Operator/root participant Messages | Single-Message persistence inherits the Session frontier; Task-root participant move keeps its current explicit frontier advancement. |
| Prose continuation and Tool-result continuation | No semantic change; assistant parent remains the exact control Message and one activation continues until a decision/boundary. |
| Cancellation, terminal Task conversation and reopen | Existing epoch/lease fences remain. New Message ordering is project/Session local and does not grant reopen authority. |
| Restart and competing processes | SQLite transaction serialization allocates one frontier and atomic pair; process-local maps remain hints only. Mission close re-reduces after cross-process lease acquisition. |
| Multiple Tasks/projects | Frontier query is constrained by exact Session; lifecycle target is exact Mission Session. No global ordering or owner is introduced. |
| Public API, SDK, Overlay and database transfer | No public schema is added. Persisted `time.created` and existing `orderKey` remain the published contract, now with a stronger monotonic invariant. |
| Workspace/capsule evidence | No change; mismatch remains typed terminal evidence and cannot be reclassified as a renderer failure. |

## Verification matrix

- two new Messages submitted with a decreasing requested wall clock persist in submission/transaction order and project matching increasing order keys;
- a Message Part created under a rolled-back clock does not precede its persisted parent frontier;
- fresh typed Task ingress exposes creator then control, one Task-root assistant parented to that control, and one resolved ingress;
- injected control preflight failure rolls back the complete fresh pair rather than publishing a creator-only half;
- exact control replay remains idempotent and compact-identity conflicts remain typed;
- two process-style Mission close owners produce one physical close and one terminal fact;
- close failure releases the lease and permits a later owner to perform the one successful close;
- Mission closing/closed recovery, scheduler wake fencing and panel wake activation continue to pass;
- package typecheck, control-state redundancy checker, documentation check and `git diff --check` pass;
- no UI automation test is created, modified or run;
- isolated production-path integration uses a temporary SQLite database/project and the real Session, Orchestrator and Mission persistence/control code; Provider generation remains stubbed because this repair does not change Provider behavior and no real credential was authorized.

## Progress

- [x] Incident reconstruction, architecture read, repository-wide search and baseline focused tests complete.
- [x] Repair design and impact audit recorded before implementation.
- [x] Session causal frontier and atomic Task-root pair implemented.
- [x] Mission close post-acquire reduction implemented.
- [x] Focused production-path integration, package typecheck, control-state redundancy, documentation and diff checks complete. The four primary focused files report 18 passing tests, including rollback-and-retry atomic-cut and two-process shared-SQLite composite-owner frontier contracts. The agent-runner authority test adds 1 passing production-callsite contract and the Task-root move/fence group adds 4 passing contracts; no live Provider or User Interface claim is made.
- [x] Independent read-only review complete with no unresolved finding.
- [x] Scoped implementation commit `fe9fdd842` created and upstream fetch/merge audit complete. The branch is 0 behind and 117 commits ahead of `origin/v0.0.55beta`; because that outgoing set includes many unrelated commits that this Task cannot prove authorized, verified and independently reviewed, push is intentionally blocked rather than exporting the entire set. This tracked review record is committed separately as the final local evidence update.

## Independent review correction

- The first read-only review rejected the checkpoint because the Session frontier allocator read the latest Message inside a deferred top-level SQLite transaction, so two backend processes could read the same frontier before either obtained a writer reservation; the single-process decreasing-clock test could not prove the stated cross-process invariant. Follow-up horizontal review found that an inner immediate call becomes only a savepoint under a deferred owner, and separately found the Task-root participant move as the one existing-Message frontier writer outside `upsertMessageRow`.
- Corrective contract: every top-level transaction that can allocate or move onto a Session Message frontier must acquire SQLite's writer reservation before its first read. Direct Message upsert, atomic Message bundle, compaction checkpoint, snapshot import, worker descriptor-plus-Message commit, Session fork and Task-root participant move therefore use the existing `Database.immediateTransaction` primitive; nested calls remain savepoints under the caller's already-reserved owner. No process-local lock or retry fallback is introduced.
- Corrective acceptance: two independent Bun backend processes start against the same real test database and Session, release from one barrier with the same requested creation time, and both return successfully with two distinct strictly increasing persisted frontiers. The existing backward-clock, atomic rollback/retry, typed Task ingress and Mission close checks remain green. This ignored record and the new cross-process fixture are explicitly force-added to the scoped delivery.
- Cross-process evidence: the fixture explicitly wraps the exact Message+Part composite bundle in the same immediate-owner pattern used by production and proves the SQLite allocation mechanism with two independent Bun processes. The actual agent-runner callsite is covered separately by `agent-runner-fresh-session-authority.test.ts` plus code review; the two-process fixture does not claim to execute the full agent runner. The causal-frontier file passed three consecutive standalone runs; one resource-concurrent run exceeded SQLite's five-second busy timeout, while the independent reviewer reran the five-file group successfully. That non-stable validation history is recorded as scheduling/resource noise, not hidden or promoted to deterministic production evidence.

## Concurrent workspace delivery note

While the focused tests were being added, other authorized Tasks committed the shared worktree as `c6e1569e8` and `90fe41845`, capturing the already-written production repair and first test checkpoint together with their own delivery history. No reset, amend, rebase or history rewrite was used. The remaining cross-process/outer-owner repair is isolated in `fe9fdd842`, and this record discloses the mixed pre-existing commit boundary rather than presenting either captured commit as a clean single-task commit.
