# Session Stream Message Cutover Convergence

Date: 2026-08-26
Status: implementation, focused acceptance, and independent review complete; delivery pending
Owner: Codex

## Recall

### User request

- Repair the class of defects where the first operator message in a newly created Work conversation is absent while Work Agent messages render.
- Cover equivalent first-connection and reconnect gaps instead of applying a Work-only presentation patch.

### Acceptance criteria

1. A newly created Work or Chat Session exposes the exact persisted first user Message even when it commits before the Session Server-Sent Events (SSE) subscription is attached.
2. A selected Session converges newly committed Messages and Parts missed while its transport is disconnected when the stream reconnects.
3. The same connection cutover works for ordinary conversation and Mission Session trees without synthesizing Messages, duplicating persistence, or clearing already rendered cards.
4. The canonical `message` / `part` tables remain the only message history source; `protocol_event` does not acquire message snapshots.
5. Task conversation hydrate, persisted Protocol replay, live replay, and live-replay-expiry recovery remain unchanged.
6. Focused positive non-User Interface (UI) checks prove the backend subscribe-before-snapshot cutover and the Overlay's idempotent snapshot merge, including exact `user` and `work` identities.
7. A real isolated development page is inspected manually to prove the persisted first Work user card and following Work Agent card render with their exact identities; the subscribe-before-snapshot timing contract is exercised through the production SSE route because Provider credential use is not authorized.

### Hard constraints

- Keep `tree-writer.ts` as the single rendered conversation writer and canonical `orderKey` as the only timeline axis.
- Do not create an optimistic or synthetic user bubble, persist message payloads into `protocol_event`, add a Work-only fallback, or introduce a second transcript store.
- Preserve all streaming Large Language Model (LLM) execution. This repair concerns the message transport cutover, not model-call shape.
- Preserve source identity: direct right-sidebar user Messages remain `role=user`, `author=user`, `agentID=work|chat`, `originSource=right-sidebar-conversation`, display stage `user`; assistant Messages retain their exact primary Agent identity.
- Do not add, modify, or run UI automation. Visual acceptance uses a real page, real interaction, screenshots, and manual review.
- Do not operate, restart, refresh, or close the user's running application. Use an isolated runtime for real-page acceptance.
- Preserve unrelated concurrent Browser, Computer, MCP, Expert Squad, Session-loop, test, and architecture-debt-record changes currently present in the shared worktree.

### Sources read

- `AGENTS.md`
- `specs/current/architecture/02-data.md`
- `specs/current/architecture/07-panel-reactivity.md`
- `specs/current/architecture/16-unified-teardown.md`
- `specs/current/architecture/17-code-work-agent-platform.md`
- `specs/records/2026-08/2026-08-10-session-card-ingress-projection-repair.md`
- `specs/records/2026-08/2026-08-14-session-message-projection-e2e.md`
- `specs/records/2026-08/2026-08-15-normalized-tool-part-bridge-and-diagnostic-copy-repair.md`
- `packages/overlay/src/main.tsx`
- `packages/overlay/src/services/conversation-session.ts`
- `packages/overlay/src/services/chat.ts`
- `packages/overlay/src/services/sse.ts`
- `packages/overlay/src/services/conversation.ts`
- `packages/overlay/src/services/tree-writer.ts`
- `packages/opencorvus/src/chat/session.ts`
- `packages/opencorvus/src/conversation/view.ts`
- `packages/opencorvus/src/orchestrator/protocol/message-bridge.ts`
- `packages/opencorvus/src/protocol/session-mirror.ts`
- `packages/opencorvus/src/protocol/store.ts`
- `packages/opencorvus/src/server/routes/session.ts`

### Whole-repository search results

- `rg -n 'startSSE|openStream|session.connected|session.heartbeat|subscribeEvents|listTaskLiveEventsAfter' packages/overlay/src packages/opencorvus/src`
- `rg -n 'message.updated|message.part.updated|dispatchEphemeral|Session.messages|latestAcrossSessions' packages/opencorvus/src`
- `rg -n 'session.events|performSessionSseReconnect|selected-task-stream-live-replay' packages/opencorvus/test packages/overlay/test`
- `rg -n -i 'Session.*SSE|SSE.*Session|replay|hydrate|reconnect' specs/current specs/records/2026-08`

The search found one selected-source stream owner in Overlay. Task and Session share the transport wrapper but have intentionally different recovery authorities. Task messages hydrate from the transcript and retain bounded in-memory live replay until the next persisted tail merge. Session messages also hydrate from the transcript initially, but the Session event route is live-only and the reconnect path only reopens it. Question and Permission interactions already close the same cutover by subscribing before rereading their canonical pending stores. No equivalent message/Part snapshot exists.

### Independent agent feedback

None before implementation. The first mandatory read-only review found four valid issues: an in-flight older-history request could overwrite the connection cursor; the document overstated a bounded additive cutover snapshot as full deletion/mutation reconciliation; the controlled persisted-row screenshot did not prove a Provider-backed fresh submission or reconnect timing; and the status line was stale. The history request is now explicitly aborted and invalidated before the snapshot cursor is installed, with a delayed-response check. The contract and evidence below are narrowed to the actual missed-creation-event repair; disconnected deletion and mutation outside the returned tail remain excluded rather than being mislabeled as converged. The screenshot is retained only as real rendering evidence, while the production route check owns the cutover-timing proof. The same uninvolved reviewer performed the required second read-only review after correction, reran the focused Overlay and backend checks, and reported no unresolved finding.

## Problem depth and impact

### Observable behavior

A fresh Work submission can render the Work Agent's assistant/tool output without the operator's first visible request. Reopening the Session can make the persisted request appear, proving the input was not lost.

### Direct trigger

`selectConversationSession` hydrates the empty Session, calls `startSSE`, and immediately returns. `startSSE` starts the transport but does not await its `onOpen`/`session.connected` boundary. The global Composer immediately calls the synchronous Session prompt route. If the first user Message commits before the backend Session event handler subscribes, its ephemeral `message.updated` and `message.part.updated` events have no subscriber.

The prompt route later returns only the completed assistant Message. Overlay synchronously projects that response, so the Work Agent output appears even though the corresponding user event was missed.

### Data and control-flow root cause

Message and Part tables are the correct single durable authority. Message events deliberately remain ephemeral to avoid a second full-message event log. The invariant therefore requires clients to reread the canonical transcript at every stream cutover. Task does so through its persisted hydrate/live-replay design. Session initial selection hydrates only *before* stream attachment, and Session reconnect reopens only the live subscription. The missing subscribe-before-snapshot handshake leaves a gap at both boundaries.

### Why earlier repairs did not cure it

- The public Session projection repair made the synchronous assistant response canonical; it did not return or merge the persisted input Message.
- The composer dispatch repair clears a submitted draft at the local dispatch boundary; it does not create message visibility authority.
- The bounded Session history repair made older pages reachable; it does not close events occurring after hydrate and before stream subscription.
- Pending Question/Permission snapshots solve only their own durable stores.
- Waiting for `onOpen` would narrow the first-send window but would not recover messages committed during a later disconnect, so it is not a complete repair.

### Shared-mechanism audit

| Surface | Current cutover | Impact and disposition |
| --- | --- | --- |
| New Work | empty hydrate -> unawaited Session stream -> immediate prompt | Directly affected; connection snapshot must merge the persisted `user` Message before/alongside live Work output. |
| New Chat | Same route and primary Session kind as Work | Equally affected; repaired by the same Session snapshot. |
| Existing Chat/Work | Reconnect reopens a live-only stream | Newly created Messages/Parts committed while disconnected are missed until full reselection; repaired by the same reconnect snapshot. |
| Mission Session | Selected through the same Session stream; initial open commonly occurs after wake/hydrate | Initial wake is usually covered by hydrate, but reconnect and any hydrate-to-subscribe window share the defect; snapshot the current Session tree. |
| Ordinary public Session | Same `/session/:id/events` contract | Same defect and repair. |
| Task conversation | Persisted hydrate + Protocol replay + bounded live replay + tail merge on expiry | Not affected; preserve unchanged. |
| Pending Question/Permission | Subscribe then reread canonical pending stores | Already convergent; preserve and use the same cutover ordering. |
| Restart/recovery | Message rows survive; Session stream has no cursor or transcript reread | A new selection hydrate is safe, but transport-only reconnect is not; connection snapshot repairs it. |
| Multi-project isolation | Route resolves exact Session through the request directory and active project | Preserve exact directory routing and project-scoped Session tree lookup. |

## Decision

Extend the existing `session.connected` handshake with one bounded connection snapshot derived directly from the canonical Session-tree Message/Part tables and projected by the existing conversation view:

1. Subscribe to Session protocol events first.
2. Read a bounded current transcript snapshot and canonical conversation view for the exact selected Session tree.
3. Emit that snapshot in `session.connected`.
4. Let Overlay validate and merge it through `prepareConversationView` / `commitPreparedConversationView` without clearing the Card Tree.
5. Permit overlap between the snapshot and already queued live events; stable Message, Part, card, and `orderKey` identities make the merge idempotent.
6. Abort and invalidate any older in-flight history request before replacing the selected Session history cursor with the cursor from the same connection window. If a disconnect accumulated more messages than the snapshot limit, the latest tail becomes visible immediately and older-page loading can continue from that tail to recover the middle segment. Stable message IDs make overlap with already loaded history idempotent.
7. Keep one live membership set for the selected Session tree. Seed it from the canonical tree snapshot and admit a newly attached child when its event carries a parent already in the set, so Mission/assistant child messages and pending Question/Permission rows follow the same tree boundary instead of being silently restricted to the root Session ID.

This uses one message authority, one connection handshake, one writer, and one current implementation. It does not add a second event replay store or a client-created message.

The bounded snapshot is intentionally additive. It repairs missed creation events—the class that makes a first user Message absent while later Agent output is visible—and refreshes rows included in its current tail. It is not an authoritative manifest for every Message ever loaded by the client: absence from the tail cannot prove deletion, and a changed Part older than the tail is not reread until that history region is loaded again. Full disconnected deletion/tail-external mutation reconciliation would require a canonical removal/change coordination contract and is not claimed by this repair.

## Verification plan

- Backend route-level positive check: persist a direct Work user Message before stream attachment, open the production Session SSE route, parse `session.connected`, and prove the bounded snapshot contains the exact user identity, Part, view stage, and Work Session owner.
- Backend cutover checks: prove a Message persisted before stream attachment is present in `session.connected`; prove a disconnect-sized 82-message transcript returns the latest bounded 80-message tail with a history cursor that reaches the preceding segment. The code-order assertion remains subscribe first, then snapshot.
- Overlay service-level positive checks: deliver `session.connected` with a persisted user/Work snapshot twice and prove it converges to one exact user card while retaining an older-history continuation; start an older-history request, install a newer connection cursor, then release the delayed old response and prove it cannot overwrite that cursor.
- Existing focused Session history and public Session projection checks.
- Overlay and OpenCorvus typechecks, Overlay production build, root documentation check, and task-owned diff check.
- Real isolated Work page: use an isolated runtime and project with controlled persisted user/assistant rows (no Provider credentials), inspect a screenshot showing the exact first user request followed by `work`, and verify the page console has no warnings/errors. This proves the actual UI renders the repaired canonical identities, not the fresh-submit or reconnect timing sequence. The real Provider submission path is not exercised because credential use was not authorized; the production SSE route check owns the cutover timing proof.
- Mandatory independent read-only review; repair every valid finding and rerun affected acceptance until no unresolved finding remains.

## Progress

- [x] Observable symptom, direct trigger, persisted authority, old repair gaps, and shared impact audited.
- [x] Repair design recorded before implementation.
- [x] Backend subscribe-before-snapshot handshake implemented.
- [x] Overlay snapshot merge and history-cursor convergence implemented, including invalidation of an older in-flight history request.
- [x] Focused route/projection/history/origin tests, package typechecks, documentation checks, architecture index, diff check, and Overlay production build passed.
- [x] Real-page rendering acceptance completed against an isolated runtime; screenshot: [`../../artifacts/session-stream/2026-08-26-work-first-message-visible.png`](../../artifacts/session-stream/2026-08-26-work-first-message-visible.png). DOM and screenshot show `User` / `第一条 Work 用户消息应该完整显示`, followed by `work` / `这是 Work Agent 的消息；它应显示在用户消息之后。`; browser warning/error log was empty. This is rendering evidence only; the route test proves the connection race.
- [x] Independent review complete with no unresolved finding.
- [ ] Scoped commit created, upstream merged, complete push set verified, and push completed.

## Verification evidence

- `bun test test/server/session-event-connection-snapshot.test.ts` in `packages/opencorvus`: 3 passed (first Work prompt, 82-message reconnect window, and dynamic child-Session membership).
- `bun test test/session-connection-snapshot.test.ts` in `packages/overlay`: 2 passed, including rejection of a delayed history response after a newer connection cursor is installed.
- `bun test test/server/session-conversation-history.test.ts test/mission-message-origin-projection.test.ts` in `packages/opencorvus`: 4 passed.
- `bun run typecheck` in `packages/opencorvus`: passed.
- `bun run typecheck` in `packages/overlay`: passed.
- `bun run build:vite` in `packages/overlay`: passed (existing Rollup chunk-size and mixed static/dynamic-import warnings only).
- `bun run docs:check`: passed, 338 operations and 25 groups.
- `bun run check:architecture-index`: passed, 26 current documents indexed.
- Prettier passed for both newly added focused test files, `packages/opencorvus/src/engine/model.ts`, and `packages/overlay/src/services/conversation.ts`. The pre-existing `packages/opencorvus/src/server/routes/session.ts` and `packages/overlay/src/services/sse.ts` are not whole-file Prettier-clean; unrelated formatting hunks were deliberately not retained.
- `git diff --check`: passed.
- `bun run build` in `packages/opencorvus`: blocked in native executable compilation because Bun resolved `@octokit/core@5.2.2` from its global cache but could not resolve five declared transitive dependencies. A frozen install and an offline frozen install were both attempted; the registry layer returned bulk `ConnectionClosed` errors, so the dependency graph could not be rebuilt. This is an explicit unmet build check, not a source verdict; Overlay build and both package typechecks remain passing.
