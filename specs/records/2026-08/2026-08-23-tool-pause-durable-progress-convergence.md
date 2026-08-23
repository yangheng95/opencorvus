# Tool pause durable-progress convergence

Status: implementation, focused verification, and independent review complete; fresh Mission rerun pending

## Recall

### User request

Run the seven-stage DeBERTa V3 ABSA Mission with exact model `openai/gpt-5.6-sol`, using only the built-in `research-studio`, `base`, and `advanced` Expert Squads. Long CUDA work may be considered stalled only after 20 minutes without any new durable Message, Tool part, workflow occurrence, Artifact revision, Git change, GPU sample, Task state, or Mission state. When the first real run stopped during Stage B, repair the Mission problem and rerun the complete case from a fresh isolated project; do not present a failed run as a website success.

### Acceptance criteria

1. A foreground Tool call that appends fresh live Tool progress before the configured Tool-pause inactivity deadline remains active beyond the absolute 15-minute wall-clock point.
2. A paused Tool call with no durable live metadata still terminates after the configured inactivity window; no forever-pause fallback is introduced.
3. Tool completion/error resumes the exact call-owned pause, and retry safety continues to refuse an in-message retry after a Tool effect began.
4. Activity is scoped by physical Session occurrence; one Project/Session cannot keep another Project/Session alive.
5. Config projection exposes one `session_tool_idle_ms` authority through the existing `assistant.activity` surface, with a 20-minute default matching the demonstration contract.
6. Task/Mission worker dispatch, recovery, serial and parallel workflow nodes, terminal convergence, restart recovery, and multi-Project isolation keep their existing durable contracts.
7. Focused tests, documentation checks, type checks, and a fresh real Web UI Mission demonstrate the repaired path. The failed Mission remains immutable failure evidence.

### Hard constraints

- All LLM calls remain streaming.
- Do not add a fallback, synthetic heartbeat, timer-fed activity, hidden message, workflow gate, or Host routing policy.
- Only a successfully committed append-only Tool progress fact can extend the paused Provider stream inactivity window.
- The Tool implementation's own timeout/lease remains the effect lifetime authority; Provider stream activity must not impose a second absolute wall-clock lifetime on a live Tool.
- Preserve `ProcessorUnsafeRetryError`: it is the correct effect-safety boundary once Tool execution began.
- UI acceptance uses the real page and manual screenshots only; no UI automation tests.
- Preserve unrelated untracked `packages/opencorvus/script/benchmark/` and ``.

### Sources read

- `AGENTS.md`
- `specs/current/architecture/task-control-plane.md`
- `specs/current/architecture/02-data.md`
- `specs/current/architecture/04-extensions.md`
- `packages/opencorvus/src/llm/activity.ts`
- `packages/opencorvus/src/util/stream-activity.ts`
- `packages/opencorvus/src/session/processor.ts`
- `packages/opencorvus/src/session/status.ts`
- `packages/opencorvus/src/session/loop.ts`
- `packages/opencorvus/src/tool/live-metadata-sink.ts`
- `packages/opencorvus/src/tool/bash.ts`
- `packages/opencorvus/src/engine/config.ts`
- `packages/opencorvus/src/config/config.ts`
- `packages/opencorvus/test/stream-activity-pause-bound.test.ts`
- `packages/opencorvus/test/session/processor-llm-activity-retry.test.ts`
- `packages/opencorvus/test/execution-progress-inactivity.test.ts`
- Real isolated runtime database, Web UI, Project Git history, Task Artifacts, and `dev.log` under `.opencorvus-deberta-builtins-mission-20260823`.

### Whole-repository search

- `rg` found the 180-second LLM chunk-idle authority in `engine/config.ts` and the 15-minute pause bound only in `DefaultLLMActivityPolicy.maxPauseMs`.
- `SessionProcessor` calls `run.pause(tool:<callID>)` at the accepted Tool call and resumes the exact owner on Tool result/error.
- `SessionLoop` routes live Tool metadata through `ToolLiveMetadataSink` and calls `Session.updatePart`, but the immutable Tool request reconciler accepts that later payload without changing the request fact. The apparent update neither writes a durable revision nor publishes a new Tool Part.
- `withStreamActivity.observe()` resets only the ordinary idle timer; while paused it does not reset the pause timer, making `maxPauseMs` an absolute Tool wall-clock limit.
- Bash already owns foreground timeout and background lease through `ProcessSupervisor`; MCP and other long tools own their own request/lifecycle timeouts. Removing their authority is out of scope.
- The scheduler and Orchestrator separately use `execution_progress_idle_ms`; neither should be replaced by Provider-stream pause handling.

### Independent agent feedback

None before implementation. A fresh uninvolved read-only review is mandatory after the first passing implementation and again after any review-driven repair.

## Failure evidence

Mission `15c5f2b04dd6b90b`, Stage B Task `tsk_g00VT4qKQn00cvONenyS`, used built-in Base workflow `planner-execution-verification` and exact `gpt-5.6-sol` for root and workers.

Two command-capable developer attempts crossed the hard 15-minute pause window:

- dependency installation ended in `ProcessorUnsafeRetryError` after live disk progress;
- the repair-v2 CUDA run reached 20/36 slots and then received a managed infrastructure continuation.

The second interruption left `R2-E0-C07-s37` after optimizer step 7 without contemporaneously persisted PyTorch allocator peaks. The same independent Base Tester verified all recoverable evidence, rejected inferred/substitute metrics, and the Task correctly ended `failed`. Because the frozen budget forbids retry/replacement, this run cannot be salvaged as a success.

## Root cause

The Provider stream correctly pauses ordinary LLM chunk-idle accounting while the SDK executes a Tool. However, the pause itself has an absolute 15-minute timer. `withStreamActivity.observe()` cannot renew that timer while paused, and live Tool metadata is not durable: the immutable Tool request fact deliberately does not rewrite when later metadata arrives. Therefore a healthy foreground command is aborted at 15 minutes even when it is emitting stdout, producing an `idle` retry classification after a Tool effect started; retry safety then correctly raises `ProcessorUnsafeRetryError`.

The shared root cause has two linked gaps: no append-only durable representation for running Tool progress, and no exact-Session bridge from such a committed fact to the paused activity monitor. Increasing a constant alone would only defer the same failure, and removing the pause bound would restore an unbounded hung-Tool path.

## Horizontal audit

| Surface | Evidence and disposition |
| --- | --- |
| Direct Chat/Work Session | Uses the same `SessionProcessor`, Tool progress fact writer, and `SessionLoop`; affected by the same absolute Tool pause and repaired by the same path. |
| Task root / projected worker | Uses the same processor and live metadata sink; both observed failures occurred here. Append-only progress also enters the Task durable-activity scope. |
| Mission root | Mission itself was not executing the long command, but receives the worker infrastructure outcome through the existing scheduler lifecycle. No Mission-specific fix. |
| Normal Tool result/error | Exact Tool-call owner resumes the pause in both cases; preserve. |
| Retry | Pre-effect semantic idle remains retryable; post-effect retry remains prohibited by `ProcessorUnsafeRetryError`; preserve. |
| Restart recovery | Process-local monitor disappears with the process; durable Tool request/progress/outcome and Provider/Task recovery remain authoritative. No replay heartbeat. |
| Serial/parallel workflows | Monitor registration is keyed by Session ID, so each worker occurrence observes only its own committed Tool progress. Focused isolation test passes. |
| Multi-Project | Session ID plus Project-bound persistence supplies isolation; no global activity broadcast. |
| Terminal convergence | Task failure and Mission blockage were correct downstream outcomes of missing evidence; do not weaken terminal acceptance. |
| Bash / MCP / other tools | Effect lifetime stays owned by each Tool timeout/lease. Changed live metadata appends one coalesced progress fact and only then renews Provider pause inactivity. Batch children use the same writer. |

## Design

1. Add `assistant.activity.session_tool_idle_ms` to the existing configuration authority with default `1_200_000` ms.
2. Make `withStreamActivity.observe()` renew the pause inactivity timer while paused. It must not resume the monitor or alter pause depth.
3. Add append-only `tool_part_progress` facts beneath the immutable Tool request, project the latest fact into the visible running Tool Part, include it in Task durable activity, and reject mutation/deletion or append after terminal settlement.
4. Add `SessionStatus.observeActivity(sessionID)` and call it only after the exact Tool progress append commits, including Batch child Tools.
5. Set the Session processor activity policy's `maxPauseMs` from `session_tool_idle_ms`.
6. Preserve the existing exact-owner `pause`/`resume`, Tool timeout/lease, retry, cancellation, and recovery contracts.

## Benchmark

### Task definition

Keep one streaming Provider occurrence safe and live while a command-capable Tool runs longer than its former absolute pause bound and persists real progress.

### Input -> output

- Input: accepted Tool call, paused Provider stream, repeated successfully committed append-only Tool progress facts.
- Output: no pause timeout while progress continues; after the final progress, a silent Tool still times out at the configured inactivity boundary; exact Tool result/error closes the pause.

### Environment

- Focused package tests run from `packages/opencorvus`.
- Real Provider/model projection comes from the isolated runtime copied without logging credential content.
- Real Web UI service runs against a fresh isolated project/runtime and exact `openai/gpt-5.6-sol`.

### Timeout

- Unit fixtures use millisecond-scale inactivity windows and real Tool progress fact appends.
- Real Mission uses 20 minutes without the enumerated durable activity as the stall threshold.
- No total training deadline is inferred from process start.

### Executable acceptance

- Focused activity/config/processor tests pass.
- Existing pause-bound, retry-safety, execution-inactivity, Task/Mission, and package workflow tests pass.
- A fresh seven-Task Mission progresses through Stage B without a 15-minute infrastructure interruption and only continues to C when Stage B independently passes.
- Final website eligibility remains conditional on all original A-G machine criteria.

## Implemented files

- `packages/opencorvus/src/config/config.ts`
- `packages/opencorvus/src/engine/config.ts`
- `packages/opencorvus/src/util/stream-activity.ts`
- `packages/opencorvus/src/session/status.ts`
- `packages/opencorvus/src/session/session.sql.ts`
- `packages/opencorvus/src/session/index.ts`
- `packages/opencorvus/src/session/tool-part-facts.ts`
- `packages/opencorvus/src/session/loop.ts`
- `packages/opencorvus/src/tool/batch.ts`
- `packages/opencorvus/src/engine/durable-activity.ts`
- `packages/opencorvus/src/storage/{schema,ddl,fact-kernel-migration}.ts`
- `packages/opencorvus/script/control-state-redundancy-check.ts`
- focused non-UI tests under `packages/opencorvus/test/**`
- `specs/current/architecture/task-control-plane.md`
- this record and both spec indexes

## Validation log

- Focused Bash truncation/bounded sampling/split UTF-8/Batch/activity/config/processor/command/SessionLoop/Tool fact/Task-Mission durable activity/migration/schema tests: `46 passed / 0 failed / 150 assertions`.
- Real SessionLoop `edit` Tool integration appended one `tool_part_progress` row, projected its metadata into the running Tool Part, and observed exactly the owning Session after commit.
- Pause isolation fixture: the progressed Session remained paused and live past the first deadline while the foreign silent Session timed out; the progressed Session timed out after its own renewed silent window.
- `bun run check:control-state-redundancy`: pass (`44 tables; 7 allowed fact classes`).
- Root `bun run typecheck`: pass (`8 successful`).
- `bun run docs:check`, `bun run script/sync-version.ts --check`, and `git diff --check`: pass; release-family version remains `0.0.52-beta`.
- First independent review found and the implementation accepted three valid gaps: Bash previews stopped changing beyond 30 KB, the ignored Recall file needed an explicit force-add, and Batch/cursor/old-schema migration lacked direct positive coverage. Bash now carries monotone real UTF-8 output bytes, all three paths have focused tests, and the exact Recall file is included in the staged-boundary plan.
- Second independent review found one valid performance gap: each chunk rescanned full output and repeated the truncated preview in an append-only row. Bash now increments raw process bytes in O(1), keeps a 4 KiB live prefix, and lets only a real output chunk crossing the five-second or 64-KiB evidence threshold publish; no timer can mint progress.
- Third independent review found one valid UTF-8 contract gap: terminal bytes were recomputed from independently decoded chunks and preview length was measured in JavaScript characters. One stream accumulator now owns raw bytes, split-safe UTF-8 decoding, terminal reuse, and UTF-8-byte-bounded preview; split-CJK coverage proves the contract.
- Fourth independent review returned `no findings` after independently probing split UTF-8 across both stdout/stderr, rerunning Bash/Batch tests and package typecheck, and confirming the 29-file staged boundary excludes unrelated files.
- Commit/push and fresh real Mission remain pending at this checkpoint.
