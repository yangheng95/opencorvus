# Mission stream interruption retry-budget repair

Status: completed

## Recall

| Item | Requirement or evidence |
| --- | --- |
| User request | Explain why the supplied task was interrupted and repair the problem. |
| Acceptance | Reconstruct the exact persisted/runtime timeline; distinguish the original provider interruption from later operator cancellation; keep all Large Language Model (LLM) calls streaming; recover a replay-safe Session turn through the observed `idle -> network -> idle` transient sequence; retain finite total and first-byte bounds plus the post-side-effect unsafe-retry fence; add focused positive non-UI coverage; complete independent read-only review, commit, upstream merge, validation, and push. |
| Hard constraints | Preserve the user-running Overlay/backend and its database; do not restart, stop, or reuse its credentials; do not add, modify, or run UI automation tests; use one shared LLM activity policy rather than Mission-specific fallback or Host workflow logic; preserve `ProcessorUnsafeRetryError`; modify only task-owned files. |
| Sources read | User Debug Bundle for Session `ses_-zUWfO12lzz8Zb7BWOja`; live `0.0.54-beta` health, listener ownership, Session messages, Provider activity facts, Session controls, and exact runtime log; `specs/current/architecture/15-agent-facts-and-turns.md`; `specs/current/architecture/task-control-plane.md`; `specs/records/2026-08/2026-08-25-v0.0.54-beta-release.md`; `packages/opencorvus/src/llm/activity.ts`; `packages/opencorvus/src/session/processor.ts`; focused activity and processor tests; Mission process-recovery code and tests. |
| Repository search | The ordinary Session processor uses `withLLMActivity` with the default policy; replay-safe title and Project Memory text collectors use the same default; Version Control System visible-delta generation explicitly uses `NonReplayableLLMActivityPolicy`. Task, Mission, and ordinary Chat Session turns therefore share the affected default. Provider connectivity checks and metric judging own separate streaming boundaries and are excluded. Tool execution is separately fenced before retry. |
| Starting state | Worktree clean on `arch-debt-remediation` at `a88f8e7e86b96b7f2a8f3cde141b067ff40dfd85`; upstream `origin/arch-debt-remediation`; divergence `0 0`. Port 7878 is owned by packaged `opencorvus.exe` PID 23580 launched by the desktop process, so investigation remains read-only against that runtime. |
| Independent agent feedback | First read-only review found that a transport-only stream also enters idle after its first physical chunk, so removing `idle: 1` alone would silently relax the prior request-start bound; it also found the ignored-spec delivery risk and an overbroad production-call-site statement. The implementation and record were corrected. The same uninvolved agent then re-reviewed the complete diff, independently reran the focused tests, and returned PASS with no P0-P3 findings. |

## Incident reconstruction

Observed durable and runtime facts:

1. The first operator message entered the standalone Mission Session at `2026-08-25T17:42:14Z`. Six assistant Tool-call steps completed. Two parallel `panel` calls failed at `17:42:51Z` because an exclusive Tool occurrence already owned that assistant turn; the containing assistant message nevertheless completed normally, so these errors were not the interruption trigger.
2. Assistant `msg_g0VTKcFiX00hp1XsZnhE` started its final provider stream at `17:43:19Z` using exact model `openai/gpt-5.6-sol`.
3. Attempt 0 last produced a text delta at `17:43:44Z`, then reached the 180-second semantic-idle threshold and retried at `17:46:44Z`.
4. Attempt 1 produced another text delta at `17:47:28Z`, then encountered a classified network failure and retried at `17:47:36Z`.
5. Attempt 2 again became semantically idle. At `17:51:22Z`, `withLLMActivity` emitted the terminal Provider activity fact `failed / idle`; the Session processor persisted `finish=error`, `MessageAbortedError`, and exact failure occurrence for that assistant message. No Tool was pending or running.
6. The operator sent `继续` at `17:58:46Z`. That reply entered its own Provider activity and recovered once from idle at `18:02:21Z`. At `18:04:02Z` it received a typed external cancellation whose durable reason is `Operator stopped the active Mission from the composer`; this second terminal message is a user cancellation, not evidence about the first failure.

Contradictions are projection timing, not competing authority: the Debug Bundle captured the Mission board as `active` while the first assistant occurrence was already terminal-error and the second was still incomplete. The Mission business execution remained open until the later explicit stop receipt, so an active Mission and a failed Session occurrence can coexist.

## Root cause and impact analysis

- Direct trigger: the third physical Provider attempt crossed `assistant.activity.session_llm_idle_ms = 180000` after two earlier retryable failures.
- Data/control-flow root cause: the shared default policy has a one-hour total budget and a default transient retry ceiling of five, but release `0.0.54-beta` added `idle: 1`. This turns the second semantic-idle observation into terminal failure even when intervening attempts received real semantic output and another failure was independently classified as network. The activity runner and Session cleanup were otherwise functioning: each retry received a fresh stream, abandoned replay-safe Parts were removed, and the final error was persisted with exact Provider activity provenance.
- Why the old path was insufficient: the one-idle cap was introduced to bound a completely stalled stream, but it collapses transport-only silence with silence after real semantic progress. A request that receives only transport `start`/keepalive chunks must retain the first-byte one-retry boundary; after real text, reasoning, or Tool progress, the existing one-hour total deadline and shared transient ceiling already provide the finite end-to-end bound. Applying the transport-only cap to both cases prematurely exhausts otherwise replay-safe Chat, Task, and Mission turns.
- Shared impact: every ordinary Session processor and replay-safe text collector inherits the default policy. Standalone Mission was only the observed surface. Task root, worker Session, ordinary Chat, title generation, and Project Memory can terminate early under the same repeated-idle sequence. VCS visible-delta generation remains non-replayable and must continue to use zero retries.
- Safety exclusions: post-Tool execution retries remain rejected by `ProcessorUnsafeRetryError`; external cancellation, context overflow, authentication, client errors, Host faults, and unknown errors remain non-retryable; first-byte and transport-only idle recovery remain capped at one; the one-hour total deadline remains authoritative. No queue, scheduler, occurrence, Mission closure, UI, route, schema, or generated SDK contract changes.

## Implementation plan

1. Restore mid-stream semantic idle to the shared finite transient retry budget by removing the `idle: 1` override from `DefaultLLMActivityPolicy`, while making transport-only idle reuse the `first_byte` cap; keep `first_byte: 1`, `rate_limit: 15`, the default ceiling, and total deadline unchanged.
2. Replace the homogeneous one-idle budget test with a positive regression that reproduces `idle -> network -> idle -> success`, and retain focused typed contracts that first-byte and transport-only idle recovery are bounded to one retry.
3. Extend the Session processor retry test through the same mixed sequence and prove that the final persisted message contains only the recovered output with correct usage, while abandoned replay-safe attempt Parts are settled by the existing cleanup owner.
4. Run focused activity and processor tests, backend typecheck, formatting/document checks, and relevant route checks if documentation tooling requires them. Do not run UI automation tests.
5. Obtain an independent read-only review of the completed diff, tests, evidence, architecture alignment, and regression risk. Repair every valid finding and repeat review if code changes.
6. Update this record with final evidence, create a scoped commit, fetch and merge the upstream into the current branch without rebase, inspect the complete outgoing set, rerun affected validation, and push normally.

## Risk and verification boundary

The repair can lengthen a replay-safe turn when a provider emits real semantic output and later stalls repeatedly. That is intentional and remains finite: each idle attempt is bounded by the configured 180-second detector, the shared transient retry ceiling remains five, backoff is clamped to the remaining budget, and the activity has a one-hour total deadline. A stream with transport bytes but no semantic progress still settles after the first-byte policy's single retry, preserving the prior sub-ten-minute default boundary. The stronger regression is the exact mixed-class sequence from the incident, because a one-class fixture could pass while real interleaved provider failures still terminate early. No real Provider rerun is authorized in this task, so acceptance proves the production processor path with deterministic streams and records the absence of credentialed end-to-end evidence explicitly.

## Completion record

- Implementation: `DefaultLLMActivityPolicy` no longer gives semantic idle the transport-only one-retry override. At the retry decision, an idle whose attempt-local last heartbeat is only `first-byte` reuses the first-byte cap; text, reasoning, and Tool semantic heartbeats retain the shared default transient ceiling. `NonReplayableLLMActivityPolicy`, total deadline, error classification, external cancellation, and the Session processor's post-Tool `ProcessorUnsafeRetryError` fence remain unchanged.
- Positive runtime-path evidence: the activity contract reproduces `idle -> network -> idle -> success`; the production `SessionProcessor` fixture traverses the same four physical streams and persists only the recovered text and final token usage. Separate typed contracts prove transport-only idle and no-first-byte stalls each settle after one retry.
- Focused tests: `bun test packages/opencorvus/test/llm/activity.test.ts packages/opencorvus/test/session/processor-llm-activity-retry.test.ts --timeout 30000` passed 15 tests, 42 expectations, 0 failures. The independent reviewer reran the same files with the same result.
- Static and documentation verification: `bun run --cwd packages/opencorvus typecheck` passed; `bun run docs:check` passed with 332 operations across 25 groups; task-file Prettier check and `git diff --check` passed. Two historical documentation-test paths consulted from older records no longer exist in the current tree and were not used as acceptance evidence.
- Live boundary: the packaged `0.0.54-beta` desktop backend and its Provider credentials were observed read-only and never restarted, stopped, mutated, or reused. No real credentialed Provider rerun and no UI automation execution were performed.
- Independent review: the first review's two P2 and one P3 findings were fixed; the required second read-only review returned PASS with no unresolved P0-P3 finding.
