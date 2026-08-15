# Task-root multi-step assistant convergence

## Recall

- User request: repair the reported Mission creation anomaly using the attached `opencorvus.debug.v2` bundle.
- Acceptance:
  - a Mission-created Task whose projected Orchestrator performs one or more ordinary Tool calls continues under the same durable activation and reaches its next streamed Provider step without failing Message immutability;
  - the activation owns one visible assistant Message, with every Provider step and Tool result preserved in that Message until one final immutable completion boundary;
  - direct Mission creation, Task execution, normal completion, terminal failure notification, retry/restart recovery, serial and parallel Tasks, and project isolation continue to use the same Task-root fact reducer and activation fence;
  - focused positive tests and the real Task-control checker cover the production path; an uninvolved agent reviews the final diff and evidence.
- Hard constraints: all Large Language Model (LLM) calls remain streaming; no Host workflow gate or prose parsing is added; Message and Tool facts stay visible; the immutable Task-root ingress, activation lease, assistant Message, and Tool/Provider receipts remain the only authorities; no User Interface (UI) automation test is added, changed, or run.
- Incident evidence read:
  - attached debug bundle for Mission Session `ses_-zUXdw9tBzz2mhRoUg4j` and child Task `tsk_g00VSM46Ak0088lKHyrL`;
  - live read-only `/mission`, `/work-ledger`, root conversation, Task conversation, and Task event projections for the incident project;
  - application log `2026-08-15T090943-1944-1.log`;
  - `specs/current/architecture/task-control-plane.md`, especially prose continuation, activation consumption, and Tool/Provider effect rules;
  - Mission wake/session, Orchestrator Task processing, Session runtime contract, Session loop/processor, Message immutability, Task-root reducer/fence, and focused Task-control tests.
- Repository search:
  - `SessionProcessor.create` has three production callers: ordinary Session turns, compaction, and permission continuation recovery. Only ordinary projected-scheduler turns carry Task-root activation identity, so the new multi-step retention behavior must be explicitly requested at that caller and must not change compaction, native Chat/Work/Mission, projected worker, or permission recovery behavior;
  - `provider_activity_request` also incorrectly has a unique assistant-Message index, and `recordProviderActivityEvent` rejects a second activity ID for the same assistant. This duplicates the premature one-step boundary in storage even though request/outcome facts already have their own identities and the reducer already enumerates all Provider requests for the activation;
  - the Task-root activation fence intentionally permits exactly one assistant Message per activation and treats `finish="tool-calls"` with settled activity as an intermediate Provider step, not an activation boundary;
  - `SessionLoop.processTurn` already derives a deterministic assistant Message ID for projected Task schedulers, but always initializes a new in-memory Message and `SessionProcessor` always writes `time.completed` after every Provider step;
  - the normal loop then returns `continue`, sees the same Task-root user/control parent, derives the same deterministic Message ID, and attempts to overwrite its completed payload;
  - Mission is only the creator/notification surface in this incident. Directly created Tasks and every Expert Squad using the projected Orchestrator share the same defect; Mission-specific routing is not the root cause.
- Existing uncommitted work: permission continuation recovery changes are present in `permission/authority.ts`, `project/instance.ts`, `session/index.ts`, `session/loop.ts`, related tests, and specs. They are unrelated and must be preserved; this repair will touch only non-overlapping `session/loop.ts` regions plus its own processor/tests/docs.
- Independent agent feedback: none at design start. A read-only independent review is mandatory after the first verified implementation and after any review-driven repair.

## Observed facts and timeline

1. At `09:10:17.087Z`, Mission `ba0ec4be7d221f4e` and Session `ses_-zUXdw9tBzz2mhRoUg4j` were atomically created; `/mission/wake` returned HTTP 200.
2. At `09:11:18.834Z`, the Mission created Task `tsk_g00VSM46Ak0088lKHyrL`; its Orchestrator Session was `ses_-zUXdvsxUzzy56zpO5wk`.
3. Assistant Message `msg_hnxoNb3BlTdwwNFbf1vy` streamed text, completed `skill` and `artifact_search`, and was persisted at `09:11:55.021Z` with `finish="tool-calls"`.
4. The Session loop immediately entered step 1 at `09:11:55.034Z`. At `09:11:55.127Z`, it failed with `Completed assistant Message msg_hnxoNb3BlTdwwNFbf1vy is immutable`.
5. Task facts then recorded `task.failed`; the Mission received a real scheduler notification at `09:11:57.061Z` and eventually closed. The second root "user" entry in the debug summary is therefore an Orchestrator-authored scheduler Message, not operator input.
6. Persisted and public projections agree that the Task exists and failed. The debug bundle's rendered Overlay mini-snapshot (`total=1`, `messages=0`, `tools=0`) is non-atomic and insufficient to describe the child Task tree; it is not evidence that Mission creation itself failed.
7. Separate Overlay errors for `mission.execution.closing|closed` event ownership and unrelated anonymous-project cleanup failures were observed. They do not precede or cause this Task failure and are excluded from this repair.

## Root cause

The direct trigger is a second streamed Provider step after the first step produced ordinary Tool results.

The data/control-flow root cause is an inconsistent assistant Turn boundary:

- Task-root architecture and the activation fence define one assistant Message per physical activation and keep intermediate Tool-call Provider steps inside that Message.
- `SessionProcessor` nevertheless finalized the assistant after every Provider step.
- `SessionLoop` correctly kept the activation alive and derived the same deterministic assistant Message ID, but rebuilt a fresh zero-value payload for the next step.
- The immutable Message store correctly rejected that overwrite.

The earlier publication repair ensured the runtime contract existed before initial Task messages and made Mission Task creation an immediate parked boundary. It did not exercise an Orchestrator activation containing multiple ordinary Tool/Provider steps, so it could not detect this later boundary mismatch.

## Implementation

1. Add an explicit processor option used only by projected Task schedulers: when a Provider step returns the ordinary `continue` disposition, persist its streamed parts, usage and finish reason but retain the assistant as the open activation-owned Turn. All stop, park, error, compaction, coordination and permission paths still perform the single immutable completion write.
2. On the next loop step for that activation, reuse the exact persisted incomplete assistant Message instead of constructing a new zero-value payload. Validate session, parent, activation, model, and assistant identity before reuse.
3. Make Provider activity requests a natural one-to-many child fact of the assistant Message. Keep each request and outcome immutable and uniquely identified; replace the accidental unique Message index with an ordered non-unique lookup index through one atomic current-schema migration.
4. Keep deterministic ID allocation for the first step and the existing Task-root activation fence. Do not add a second Message, status row, compatibility reader, fallback, or Mission-specific branch.
5. Add positive tests that stream an intermediate Tool-call step followed by a final step, then assert one completed assistant Turn containing both Provider request/outcome pairs, step histories and cumulative usage. Cover the production projected-scheduler loop so deterministic reuse and processor completion deferral are verified together.

## Horizontal audit

- Production entries: direct Task creation, Mission-created Tasks, retry/replan/lifecycle control ingress, and recovered pending Task-root ingress all install the same projected-scheduler runtime contract and therefore receive the same fix.
- Occurrences: Task execution epoch and activation identity remain unchanged; Mission execution occurrence only observes Task lifecycle notification and requires no new state.
- Normal/terminal paths: final prose, typed decision, immediate park, error, cancellation and terminal-conversation paths still close the assistant exactly once. Only an ordinary intermediate `continue` is retained.
- Retry/restart: an incomplete deterministic assistant remains the activation-owned durable Turn. Existing recovery terminalizes ownerless incomplete Messages after process loss; the reducer then allocates a successor activation/control edge rather than mutating a completed Message.
- Serial/parallel and project isolation: the behavior is Session/activation-local and uses existing Project Instance plus Task-root ownership fences; no global cache or cross-project lookup is introduced.
- Mission closure and Overlay event rendering: read-only evidence excludes them as causes of the Task failure. They remain separate issues unless focused verification shows this change affects them.

## Verification plan

- Focused processor/Session loop positive test for one Task-root activation with intermediate and final streamed steps.
- Existing Task initial render, Task-root reducer/fence, Task-control reconciliation, Mission Task publication, Mission process recovery, and permission continuation tests relevant to touched contracts.
- `bun run check:task-control-real` against an isolated real Task path if the checker can run without using private credentials beyond existing local configuration.
- Package typecheck and repository `docs:check`.
- Independent read-only review of the complete diff and verification evidence; repair and repeat until no findings remain.

## Verification evidence

- Focused multi-step processor, projected-scheduler integration, Provider activity storage, and current-schema migration: 10 passed, 0 failed through the package's official `script/run-tests.ts` runner, which executes every selected file in its own isolated process. A direct multi-file `bun test` invocation is not valid evidence for these global Instance/database tests because their teardown can race across files.
- Task-root fact store/reducer, Task-control reconciliation, Mission process recovery, and Mission terminal authority horizontal audit: 23 passed, 0 failed.
- `packages/opencorvus` typecheck: passed.
- Repository `docs:check`: passed (`332` operations, `25` groups).
- `check:mission-task-duplex-e2e` stopped before any model call because `MISSION_TASK_DUPLEX_E2E_ALLOW_REAL_PROVIDER=1` was not authorized.
- `check:task-control-real` stopped before any model call because `TASK_CONTROL_CHECK_ALLOW_REAL_PROVIDER=1` was not authorized.
- Independent review found that the projected-scheduler integration test did not assert the loop-to-processor retention option. The positive contract now records both production-loop calls and requires `retainAssistantOnToolContinuation: true` for each step. Repeat review confirmed that contract, identified the invalid direct multi-file Bun invocation, and the same four-file set then passed through the repository's required isolated test runner. Final independent review reports no unresolved findings.
