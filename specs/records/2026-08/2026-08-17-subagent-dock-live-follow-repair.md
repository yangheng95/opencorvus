# Sub-agent dock live follow repair

## Recall

### User request

Repair the right dock's child-agent conversation so it automatically follows live output to the bottom again, then leave Git organized and publish the current branch according to repository policy.

### Acceptance criteria

- A selected child Session visibly consumes its real streamed `message.part.delta` output without waiting for the next persisted Part snapshot.
- While follow mode is active, each visible transcript growth schedules the shared scroll owner to land at the bottom.
- An upward input disables follow only after the scroll container actually moves upward; an overscroll gesture at the bottom cannot silently disable follow.
- Returning to the bottom restores follow, switching child Sessions starts at the latest content, and inactive/cleaned-up panels retain no live listener.
- Focused positive service tests, Overlay type checking, document checking, and real-page screenshot/manual inspection pass. No UI automation test is added, changed, or run.
- The repair is independently reviewed, committed without unrelated files, merged with upstream, reverified as required, and pushed.

### Hard constraints

- Preserve the backend child-transcript route as persisted hydration authority and the selected Task Server-Sent Events (SSE) stream as live-delivery authority; do not add polling, a second network stream, synthetic messages, or hidden content.
- Preserve the existing uncommitted Overlay stream-lifecycle/coalescing work and all unrelated dirty-worktree changes.
- Reuse the shared `setupAutoScroll` primitive used by both the main conversation and the child dock.
- All Large Language Model (LLM) interaction remains streamed.
- UI acceptance uses a real page and screenshots only; no UI automation test may be created, modified, or run.

### Material read and search evidence

- Read `SubagentConversationPanel`, `subagent-conversation`, `events`, `tree-writer`, `conversation-agents`, `dom-utils`, the Task child-transcript route, Protocol live replay, the Task message protocol bridge, Message delta publication, and the current Task control-plane architecture.
- Searched all definitions/callers of `setupAutoScroll`, `contentChanged`, `transcriptSequence`, `subagentConversationTranscriptRevision`, `message.part.delta`, `lastLiveSequence`, `dispatchEphemeral`, and child-session transcript projection.
- Git history shows the dock scroll controller and its call site were introduced in `65d0bfc9` and have no later committed edits. Recent commits changed surrounding runtime/event paths but did not replace the scroll owner.
- The Task protocol bridge publishes every child `message.part.delta` through the selected Task SSE with exact Session, Message, Part, field, delta, and live sequence. `tree-writer` consumes those deltas for the central conversation.
- `writeSelectedMessageToTree` deliberately excludes `message.part.delta` from `transcriptSequence`, while `SubagentConversationPanel` refreshes/project-renders only from the persisted child-transcript HTTP resource. Therefore the dock does not observe the only event carrying in-flight token growth.
- The child-transcript HTTP delta route rereads persisted Message/Part rows. Session streaming keeps delta text in memory and persists a complete Part only at natural boundaries, so more HTTP requests cannot make live deltas visible and would amplify work.
- `setupAutoScroll.onWheel` currently releases follow immediately on any negative wheel delta, before verifying that the scroll position moved. At-bottom overscroll can therefore disable follow without visible movement.
- Existing relevant tests in `packages/overlay/test/subagent-conversation-service.test.ts` exercise data/service contracts rather than browser/DOM UI automation and may be extended with positive live-projection cases.
- Independent agent feedback before implementation: none. The first repository-mandated uninvolved read-only review found two convergence gaps: a refreshed persisted base could replay an already-absorbed live delta, and a new live Message absent from the persisted base was not projected. Both findings were accepted and repaired before final verification.

## Analysis

### Observable phenomenon

The right dock can remain above the newest child-agent output while the selected child continues streaming. The central conversation can still show growth because it applies SSE deltas directly.

### Direct triggers

1. Child streaming emits `message.part.delta` events.
2. The central `tree-writer` mutates its card projection, but the dock explicitly does not advance its transcript revision for the same event.
3. The dock's resource therefore remains referentially and visibly unchanged, so its `props.conversation` effect never calls `contentChanged()` for token growth.
4. Separately, a negative wheel gesture releases follow before any upward movement is observed.

### Data/control-flow root cause

Persisted hydration and live projection were collapsed into one HTTP resource in the dock even though the runtime already defines them as two phases of one transcript: durable Message/Part snapshots plus ephemeral exact deltas. The central conversation implements both phases; the dock implements hydration only. This is not a missing scroll command: the scroll owner receives no content-change signal because the dock's data source never changes during the live delta phase.

The shared scroll controller also treats input intent as completed movement. That state transition is too early: only an actual upward scroll away from the bottom proves the operator wants to suspend follow.

### Why previous paths did not cure it

- Refetching on non-delta transcript revisions only observes persisted boundaries.
- Refetching on every delta would still read stale persisted rows, increase request/parse/render load, and can advance cursors past content the response did not contain.
- Resize observation cannot detect content that the dock never renders.
- A second corrective animation frame only handles late layout after a known content change; it cannot create the missing live projection.

### Shared-mechanism and impact audit

- Production entries: Task child message update, Part snapshot, Part delta, Message/Part removal, initial child selection, child switch, inactive dock, Task switch, replay/recovery, and terminal child Sessions.
- Occurrences: every projected worker Session uses the same Task message bridge and selected Task SSE. The fix filters by exact selected Session and cannot cross Task/Project boundaries.
- Normal/terminal paths: persisted snapshots remain authoritative on initial/refetch; live full-Part events supersede earlier deltas; final persisted Part converges to the same visible content.
- Retry/restart: live projection is component-local and disposed with the panel. Reopening hydrates persisted state and resumes from newly delivered events; it does not invent replay or retain shadow state across targets.
- Concurrency: the existing bounded HTTP refresh controller remains the only refresh owner. Live event projection is synchronous, exact-target, and does no network work.
- Shared scroll consumers: main conversation and dock both use `setupAutoScroll`; the actual-movement rule is valid for both. Existing explicit `scrollToBottom`, Session-switch reset, at-bottom recovery, touch, keyboard, native scrollbar, and cleanup paths remain.
- Public contracts/persistence: no server route, SDK, schema, or transport shape changes.
- Tests/docs/delivery: add positive pure service coverage for snapshot-plus-live-delta projection and update the current Overlay live-delivery architecture.

### Known, inferred, and excluded

- Known: the dock excludes live deltas and therefore cannot render or follow their growth; the central tree consumes the same events.
- Known: wheel input disables tracking before actual movement.
- Inference: recent runtime changes made persisted Part boundaries less frequent or streaming intervals longer, making the pre-existing dock gap newly obvious; no recent commit changed the dock scroll call itself.
- Excluded: polling faster, persisting every token, duplicating the selected Task stream, forcing bottom after the operator intentionally scrolls upward, or replacing the backend transcript route.

## Implementation plan

1. Add one in-process listener on the existing selected Task message-event path and a pure child-transcript live projection that applies exact full-Part snapshots, deltas, and removals over persisted hydration.
2. Keep the live projection compact per Message/Part: a full Part snapshot supersedes earlier deltas, later deltas append by exact field, and projection remains idempotent over refreshed persisted bases.
3. Bind `SubagentConversationPanel` to that projection for the exact selected Session and feed its reactive result to the existing `SubagentConversationScroll`, preserving current bounded HTTP refresh work.
4. Change the shared scroll controller so wheel/keyboard intent releases follow only when a subsequent scroll event proves upward movement away from the bottom.
5. Add focused positive service tests, update current architecture, run checks, perform real-page screenshot/manual inspection, then commission independent review.

## Verification record

- `bun test packages/overlay/test/subagent-conversation-service.test.ts`: 13 passed, 0 failed, 28 expectations. Positive coverage includes persisted-base convergence without duplicate delta text and a new Message/Part/delta appearing over an empty persisted base.
- `bun run --cwd packages/overlay typecheck`: passed.
- `bun run docs:check`: passed with 332 operations across 25 groups.
- `bun run --cwd packages/overlay build:vite`: passed; the normal Vite dependency-directive and large-chunk warnings remain informational.
- `git diff --check`: passed for the worktree; Git reported only existing line-ending warnings on unrelated files.
- Real-page acceptance used an isolated production database, production Task transcript routes, the production selected-Task SSE stream, and a freshly built `/ui/` at `http://127.0.0.1:58881/ui/`. No Provider credential was used and no user-owned process/window was touched.
- A same-process production `Session.updatePartDelta` stream appended exact deltas to the selected child's final text Part. Across the final fresh build, the dock advanced from `review-370` through `review-521` without a persisted Part update. While tracking, measured bottom gap remained `-0.5px` as content grew.
- Manual Computer User Agent (CUA) interaction scrolled the dock upward. While live text advanced from `review-485` to `review-487`, `scrollTop` stayed exactly `2006.5`, proving the viewport was not pulled down. Scrolling back to the bottom restored follow; later output advanced through `review-503` with bottom gap still `-0.5px`.
- Browser console inspection contained only normal application log entries and no error entries. The manually reviewed final screenshot is [`2026-08-17-subagent-dock-live-follow.png`](../../artifacts/2026-08-17-subagent-dock-live-follow.png).
- No UI automation test was added, changed, or run.
- First independent read-only review: two valid findings, both repaired as described above. The same uninvolved reviewer completed a second read-only pass over the final diff, tests, documentation, and UI evidence with no unresolved findings; the reviewer independently reran the focused test (13 passed, 28 expectations) and Overlay typecheck.
