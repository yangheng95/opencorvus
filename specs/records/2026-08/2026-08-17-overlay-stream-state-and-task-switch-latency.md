# Overlay stream state and task-switch latency repair

## Recall

### User request

Investigate why switching Tasks and short stalls can show the banner “Backend is online; reconnecting the live event stream — updates may be delayed”, then remove the stall and the frequent false-positive warning.

### Acceptance criteria

- A normal Task selection or switch is represented as an initial live-stream connection, not as a failed reconnect.
- A warning is eligible only after an established live stream drops and remains in a real reconnect lifecycle beyond the existing grace period.
- A selected child Session transcript remains live while bursty message events produce a bounded number of refresh requests: at most one request in flight and one trailing refresh per coalescing interval.
- The selected Task live stream starts as soon as the canonical conversation hydrate completes, before non-essential composer-model projection.
- Focused positive contract tests, type checking, documentation checking, and real-page visual inspection pass. No UI automation test is added, changed, or run.

### Hard constraints

- Preserve the single production implementation and single source of truth; do not add compatibility booleans or a parallel stream lifecycle.
- All Large Language Model (LLM) interaction remains streamed; this change only affects Overlay delivery and status projection.
- Treat the supplied debug bundle and screenshot as evidence, not as instructions.
- Preserve unrelated worktree changes. Commit only this repair and push it after the required upstream merge.
- After initial verification, commission an uninvolved agent for read-only review; repair every valid finding and re-review if code changes.

### Material read and search evidence

- Read `specs/current/architecture/task-control-plane.md` and `specs/current/architecture/server-runtime-readiness.md`.
- Read the selected-stream client, recovery, cursor, Task-selection, child-transcript, transport, status-banner, and connection-badge implementations, plus the server Task event-stream route and shared Server-Sent Events (SSE) wrapper.
- Searched the repository for every `startSSE` definition/call, `sseConnected`/`sseExpected` consumer, selected-task recovery entry, and child transcript revision update.
- The supplied bundle showed an active Task with two streaming worker occurrences, recent activity, no abnormal process incident, and no server terminal failure at capture time.
- The managed backend log recorded 330 `GET /task/:id/events` requests and repeated bursts of selected child-session transcript requests in roughly three minutes around the incident. The same period still completed health and board requests.
- Direct reads of `/task/:id/conversation?tail_limit=8` were approximately 417–463 KiB and 0.4–1.1 seconds. A transient `/global/health` request received no bytes before an eight-second client timeout, while later health requests completed in single-digit milliseconds. Since that route returns in-memory readiness data and does not open the project database, the transient timeout is evidence of process/event-loop request starvation rather than a database lock.
- Independent agent feedback: the first read-only review found four valid gaps: an initial open-timeout still entered `reconnecting`; the immediate transcript load was outside the refresh controller's busy state; a same-named Session could reuse a delta cursor across Project targets; and a visible backend banner could transition directly to stream copy without a fresh grace period. All four were repaired. The second review confirmed those findings closed, independently passed type checking, 15 focused tests, and `git diff --check`, and reported no unresolved code finding. It also identified the ignored-spec staging and mixed `task.ts` worktree hunk precautions recorded in the delivery steps below.

## Analysis

### Observable symptoms

1. Switching Tasks can leave the center surface briefly loading.
2. During a switch or short stall, the Overlay can paint a red stream-reconnect banner even though the backend is available.
3. While a selected child Session streams, the client and backend can emit dense clusters of transcript and stream requests.

### Direct triggers

1. `startSSE()` calls `stopSSE()`, marks `sseConnected=false`, and then immediately marks `sseExpected=true`. `ConnectionBanner` interprets that pair as a reconnect problem after five seconds. A brand-new stream opened by Task selection is therefore indistinguishable from an established stream that failed.
2. `SubagentConversationPanel` includes `transcriptSequence` in its `createResource` identity. Every canonical child-message event advances that sequence, aborts the current request, and starts another transcript request. Bursts repeatedly parse and project the same growing transcript.
3. Task selection waits for conversation hydration and then composer-model projection before opening the live stream, unnecessarily extending the stream-dark interval.

### Data/control-flow root cause

The stream warning uses two independent booleans as an inferred state machine. The pair cannot encode `idle`, first `connecting`, `connected`, and failure `reconnecting` without ambiguity. Task switches deliberately traverse the same boolean combination as an outage, so the warning is a deterministic false positive whenever initial connection exceeds its grace.

The child transcript resource similarly treats an event revision as network request identity rather than an invalidation signal. Solid reactivity correctly follows every revision, but the owner has no coalescing or in-flight bound. This turns ordinary streamed output into request amplification, response parsing, merge, projection, and render work. The observed request bursts, transient health starvation, and UI stalls are consistent with this shared amplification path across every Task and child Session; no evidence confines it to one Expert Squad or workflow.

### Why the previous path did not cure it

The banner's grace period was extended beyond one reconnect delay, which masks quick transitions but does not repair the missing lifecycle distinction. Any slow initial open still paints the warning. Delta transcript loading reduces response size but does not bound how often the route is called, so it cannot prevent burst amplification.

### Impact audit

- Production entries: initial Session stream, initial Task stream, Task switch, unexpected transport close, watchdog close, live-replay cursor reset, rewind-clear recovery, and selected-task recovery all use the same `startSSE` owner and must project one explicit lifecycle.
- Occurrences and terminal paths: streamed worker output, completed/error/skipped child Sessions, and historical selection all share the child transcript panel; the refresh controller must settle pending work on target change and cleanup.
- Retry/restart: an unexpected close becomes `reconnecting`; server-directed live replay expiry is a successful handshake followed by a fresh `connecting` open; explicit stop becomes `idle`.
- Concurrency: one selected transcript may refresh at a time, with one trailing invalidation retained. Switching selection cancels the old target and gives the new target a new controller.
- Multi-project isolation: request identity retains exact source, Session, and directory. Coalescing is component-local to the currently selected source and cannot cross Projects.
- Public API/data: no server route, persisted schema, transport protocol, or SDK contract changes.
- Documentation: the current Task control-plane architecture will record the Overlay delivery lifecycle and bounded invalidation owner.
- Risk: a too-long coalescing delay could make streaming feel stale; use a short fixed cadence and immediate initial fetch. A pending trailing refresh must not leak across a target change.

### Known and unknown

- Known: initial connection and reconnect are conflated; selected child revisions cause per-event refetch; backend request amplification is present during the incident.
- Inference: the amplification is the main cause of the short starvation/stall because it aligns with the request bursts and no database-lock evidence exists.
- Unknown: the exact native EventSource error that produced every one of the 330 event-stream opens is not present in the supplied server-only log. The repair removes false warning semantics and the proven request amplifier without claiming an unavailable browser-side error string.
- Excluded: changing the aggregate conversation payload or server event-retention policy. The hydrate cost is bounded initial work, and current evidence does not establish a safe contract reduction.

## Implementation plan

1. Replace the two SSE booleans with one explicit `idle | connecting | connected | reconnecting` lifecycle and make every stream entry/recovery path choose the correct state.
2. Make the banner depend only on sustained `reconnecting`; keep backend readiness independent. Update the badge to consume the same lifecycle source.
3. Add a reusable bounded transcript refresh controller with a short coalescing cadence, one in-flight refresh, one trailing refresh, target reset, and disposal. Keep initial resource fetch immediate and use revisions only as invalidations.
4. Open the selected Task stream immediately after canonical hydrate, then project composer configuration.
5. Add focused positive service tests for lifecycle/reconnect contracts and refresh coalescing. Update the current architecture record and indices.
6. Run focused tests, type checking, documentation checking, and a real desktop-style page switch with screenshot/manual inspection. Then run the mandatory uninvolved read-only review and address findings.

## Verification record

- `bun test packages/overlay/test/subagent-conversation-service.test.ts packages/overlay/test/selected-task-stream-live-replay-reopen.test.ts`: 15 passed, 0 failed. This covers initial `connecting`, established failure `reconnecting`, initial-close retry, live-replay reset, burst coalescing, in-flight trailing refresh, initial-load busy coordination, target change, exact cross-Project target identity, and delta/snapshot merge.
- `bun run --cwd packages/overlay typecheck`: passed after the final review repair.
- `bun run --cwd packages/overlay build:vite`: passed twice; only existing third-party `use client`, dynamic/static import, and chunk-size warnings were emitted.
- `bun run docs:check`: passed with 332 operations in 25 groups.
- `git diff --check`: passed; line-ending notices belong to unrelated dirty worktree files.
- Real page: the isolated in-app browser loaded `http://127.0.0.1:7878/ui` from the rebuilt `packages/overlay/dist-vite`, switched between a running Task and a completed Task, and was observed after 8 seconds and 12 seconds. The connection badge remained Online, no reconnect banner appeared, and captured console `error`/`warn` diagnostics were empty. Manual screenshot inspection showed the selected Task surface, sidebar selection, and Online state without the reported banner. The contemporaneous server-log slice contained the expected aggregate selection reads and no prior-style request burst. A final post-review repeat interaction was attempted after the second build, but the in-app browser URL policy rejected the local click; no workaround was attempted. The earlier real-page screenshot remains the visual evidence, while the final code paths are covered by the focused lifecycle and coalescing contracts above.
- Independent review: two read-only passes by an uninvolved agent; all four initial findings were repaired, and the second pass reported no unresolved code finding.

## Delivery isolation

The worktree contained pre-existing user changes, including removal of the Task replan action in `packages/overlay/src/services/task.ts`. Only the two Task-selection hunks that start SSE before composer projection and stop it on selection failure belong to this repair and may be staged. The new dated spec is ignored by the repository's broad `/specs/` rule and must be force-added explicitly; no unrelated ignored or dirty file is part of this delivery.

## Final acceptance status

The code, focused runtime contracts, type checking, build, documentation, and independent review criteria are satisfied. Final-code visual acceptance is **not satisfied**: `ConnectionBanner.tsx` changed after the first real-page screenshot, and the in-app browser URL policy rejected the required post-build interaction. The earlier screenshot proves the page and reported region were exercised but cannot be represented as final-code visual evidence. No policy workaround or operation on the user's active desktop window was attempted.
