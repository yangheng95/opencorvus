# Session Conversation History Visibility Repair

Date: 2026-08-26
Status: implemented, verified, and independently reviewed; delivery pending
Owner: Codex

## Recall

### User request

- Diagnose why the beginning of Mission Session `ses_-zUWdZaTdzzbPO5gmzsN` disappeared from the visible conversation.
- Repair the proven root cause.

### Acceptance criteria

1. Persisted messages outside the bounded initial tail remain reachable from a selected Mission or ordinary conversation Session.
2. Scrolling upward in a Session conversation uses the existing Session history endpoint and prepends the exact persisted page through the canonical conversation writer.
3. Task history behavior, bounded initial hydration, chronological card identity, scroll anchoring, and multi-project directory authority remain unchanged.
4. A focused positive non-UI contract check proves both Task and Session history paths from the same source-aware resolver.
5. The real Overlay page is inspected manually against a Session with more than 80 persisted messages; no UI automation is added, modified, or run.
6. Unrelated concurrent Skill Market, runtime, documentation, and test changes remain untouched and outside this delivery.

### Hard constraints

- Preserve the 80-message initial tail and the existing backend history contracts; do not replace bounded hydration with an unbounded transcript read.
- Keep `historyState` as the single frontend cursor owner and `tree-writer.ts` as the single rendered conversation writer.
- Do not add a Session-only fallback, duplicate history store, synthesized message, hidden message, or second pagination implementation.
- Preserve exact source identity and project-directory routing across Task and Session requests.
- Do not add, modify, or run UI automation. Visual acceptance must use the real page, real interaction, and screenshots reviewed manually.
- Preserve unrelated dirty-worktree changes and commit only this repair.

### Sources read

- `AGENTS.md`
- `specs/current/architecture/02-data.md`
- `specs/current/architecture/07-panel-reactivity.md`
- `specs/records/2026-08/2026-08-01-conversation-artifact-event-routing-repair.md`
- `specs/records/2026-08/2026-08-02-large-build-observation-and-interrupted-task-recovery.md`
- `packages/opencorvus/src/conversation/history-window.ts`
- `packages/opencorvus/src/conversation/view.ts`
- `packages/opencorvus/src/server/routes/session.ts`
- `packages/opencorvus/src/server/routes/orchestrator.ts`
- `packages/opencorvus/test/server/session-conversation-history.test.ts`
- `packages/overlay/src/components/Conversation.tsx`
- `packages/overlay/src/services/conversation.ts`
- `packages/overlay/src/services/session-debug.ts`
- `packages/overlay/src/services/tree-writer.ts`
- `packages/overlay/src/store/board.ts`
- the user-provided `opencorvus.debug.v2` bundle collected at 2026-08-26 02:41:30Z

### Whole-repository search evidence

- `rg -n "canLoadOlderConversationHistory|loadOlderConversationHistory|conversation/history|HistoryState|INITIAL_CONVERSATION_TAIL_LIMIT"`
- `rg -n "session.conversation.history|task.conversation.history|ConversationHistoryQuery"`
- `rg -n "conversation history|bounded tail|tail_limit|older history" specs/current specs/records/2026-08`
- `git blame` and `git log` over the Session conversation routes, history-window contract, and Overlay conversation loader.

The search found exactly two production history endpoints: Task and Session. Both return the same transcript/view/history shape. The Overlay owns one history cursor and one prepend writer, but its availability predicate, loader guard, request path, and diagnostic identity are Task-only. The Conversation scroll owner already calls this shared loader for the currently selected source, and `loadConversationHistoryUntilCard` already attempts the same loader for Session sources. No second Session history owner is required.

### Independent agent feedback

None before implementation. After first-pass implementation and verification, a previously uninvolved agent completed the mandatory read-only review, independently reran both focused tests and the target diff check, and reported no unresolved finding. The reviewer changed no files and performed no further delegation.

## Observed incident facts

- The raw root Session endpoint reported 96 persisted messages: 2 user and 94 assistant messages, including 34 Tool occurrences.
- The bounded Session conversation endpoint reported only the latest 80 messages: 0 user and 80 assistant messages, including 16 Tool occurrences.
- The excluded prefix therefore contained all 2 user messages, 12 successful assistant messages, 2 failed assistant messages, and 18 Tool occurrences.
- Sixty-nine completed assistant messages carried errors; the late error burst pushed the early Mission turns outside the 80-row initial tail.
- The rendered debug snapshot counted card kinds, not transcript rows. Its one Agent card can contain the returned assistant transcript and embedded Tool parts; `messages: 0` is not persistence evidence.
- The server stopped after bundle collection, so current live HTTP verification is unavailable and is treated as unknown rather than zero. The bundle captured both persisted planes successfully before shutdown.

## Causal analysis

### Observable symptom

The selected Mission shows only later activity; its first user prompts and early Tool work cannot be revealed by scrolling upward.

### Direct trigger

The Session exceeded the bounded 80-message hydration tail. A dense late sequence of assistant error rows displaced the first 16 persisted messages from the initial response.

### Data and control-flow root cause

1. Session hydration correctly returns a bounded tail and sets `history.hasMore=true`.
2. The backend already exposes `/session/:sessionID/conversation/history` and proves it with a positive route test.
3. Overlay stores the returned cursor in the shared `historyState`.
4. `canLoadOlderConversationHistory` nevertheless requires `source.kind === "task"`.
5. `loadOlderConversationHistory` rejects Session sources and hard-codes `/task/:id/conversation/history`.
6. The scroll owner consequently never issues the available Session history request, so the excluded prefix cannot re-enter the canonical writer.

### Why the existing path did not cure it

The backend Session history route was added alongside bounded Session hydration, but the pre-existing Overlay loader remained Task-only. The backend test proves route pagination in isolation; no non-UI Overlay contract check covered source-aware route selection, and UI automation is prohibited. Missions with fewer than 81 persisted rows therefore appeared correct and masked the missing client connection.

### Shared-mechanism impact audit

- **Production entrances:** initial Task and Session hydration both remain bounded; upward scroll is the shared older-history entrance. Agent-rail exact-session loading remains Task-owned and is not changed.
- **Conversation families:** the defect affects Mission and ordinary conversation Sessions; Task conversations already page correctly.
- **Lifecycle:** running, idle, terminal, archived-read, retry, and restarted Sessions use the same persisted history cursor. Status does not own visibility and needs no branch.
- **Concurrency and projects:** active-source assertions, history epoch cancellation, and `conversationSourceDirectory` remain authoritative, so source switches and different project directories cannot merge pages.
- **Persistence and public contracts:** no schema, message, route, SDK, or generated contract changes are required.
- **Error burst:** the repeated `UnknownError` rows amplified the threshold crossing but are not the visibility root cause. Their underlying provider/runtime cause is outside this bounded repair because the debug bundle does not contain the original error payload.

## Decision

Generalize the one existing Overlay history loader over `BoardSource`:

- let the availability predicate accept the active Task or Session source;
- derive the canonical history URL from `source.kind`, exact source ID, existing directory, and existing history cursor;
- keep the same preparation, atomic writer commit, scroll anchor, cancellation, and history-state update path;
- report a failed page under the exact Task or Session diagnostic identity;
- add a focused non-UI route-contract test for the two positive source variants;
- record the bounded-tail-plus-page repair, evidence, and verification in this dated specification.

## Verification plan

- Focused non-UI route resolver test.
- Existing OpenCorvus Session history route test.
- Overlay TypeScript check and production build.
- Root documentation check and `git diff --check`.
- Real isolated development page with a Session exceeding 80 messages; use the conversation scroller's operator-facing keyboard interaction, capture the affected Conversation region, and manually verify that the earlier content appears without duplicate or reordered cards.
- Mandatory independent read-only review of the complete diff and evidence, followed by repair and re-verification of every valid finding.

## Progress

- [x] Incident bundle, repository contracts, history endpoints, Overlay loader, card debug semantics, and shared impact audited.
- [x] Root cause and repair design recorded before implementation.
- [x] Implementation complete: the shared history predicate accepts active Task and Session sources, and one source-aware path resolver selects the existing canonical backend route.
- [x] Focused and package verification complete: Overlay path tests (2 pass), OpenCorvus Session route test (1 pass), Overlay typecheck, production build plus renderer-surface check, root docs check, and diff whitespace check passed.
- [x] Real-page manual visual acceptance complete: an isolated Mission Session contained 96 persisted messages; initial hydration rendered messages 017-096, real PageUp interaction loaded messages 001-016, and the final rendered sequence contained exactly 96 unique messages in chronological order from 001 through 096. The reviewed screenshot showed the Mission at the restored oldest content without layout corruption.
- [x] Independent review reports no unresolved finding; the reviewer independently reran the Overlay path test, OpenCorvus Session route test, and target diff check.
- [ ] Scoped commit, upstream merge, final verification, and push complete.
